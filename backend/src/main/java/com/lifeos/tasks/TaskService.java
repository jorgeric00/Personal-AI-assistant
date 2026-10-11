package com.lifeos.tasks;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.common.error.ConflictException;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.tasks.Task.Kind;
import com.lifeos.tasks.Task.Priority;
import com.lifeos.tasks.Task.Status;
import com.lifeos.tasks.TaskDtos.CalendarEntry;
import com.lifeos.tasks.TaskDtos.CategoryResponse;
import com.lifeos.tasks.TaskDtos.RecurrenceDto;
import com.lifeos.tasks.TaskDtos.TaskRequest;
import com.lifeos.tasks.TaskDtos.TaskResponse;

@Service
public class TaskService {

    public enum View {
        TODAY, UPCOMING, ALL, DONE
    }

    /** Filtros opcionales del listado. */
    public record Filter(UUID categoryId, Priority priority, Kind kind, Status status) {
    }

    static final int MAX_CALENDAR_DAYS = 62;
    private static final int DONE_LIMIT = 200;

    private final TaskRepository tasks;
    private final TaskCategoryRepository categories;
    private final TaskCompletionRepository completions;
    private final LifeosProperties properties;
    private final Clock clock;

    public TaskService(TaskRepository tasks, TaskCategoryRepository categories, TaskCompletionRepository completions,
            LifeosProperties properties, Clock clock) {
        this.tasks = tasks;
        this.categories = categories;
        this.completions = completions;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> list(UUID userId, View view, Filter filter) {
        LocalDate today = today();
        List<Task> source = view == View.DONE ? tasks.findDone(userId, Limit.of(DONE_LIMIT)) : tasks.findOpen(userId);
        return source.stream()
                .filter(task -> switch (view) {
                    case TODAY -> task.getDueDate() != null && !task.getDueDate().isAfter(today);
                    case UPCOMING -> task.getDueDate() != null && task.getDueDate().isAfter(today);
                    case ALL, DONE -> true;
                })
                .filter(task -> filter.categoryId() == null
                        || (task.getCategory() != null && task.getCategory().getId().equals(filter.categoryId())))
                .filter(task -> filter.priority() == null || task.getPriority() == filter.priority())
                .filter(task -> filter.kind() == null || task.getKind() == filter.kind())
                .filter(task -> filter.status() == null || task.getStatus() == filter.status())
                .map(task -> toResponse(task, today))
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskResponse get(UUID userId, UUID taskId) {
        return toResponse(load(userId, taskId), today());
    }

    @Transactional
    public TaskResponse create(UUID userId, TaskRequest request) {
        Task task = new Task(userId, now());
        apply(task, request);
        tasks.save(task);
        return toResponse(task, today());
    }

    @Transactional
    public TaskResponse update(UUID userId, UUID taskId, TaskRequest request) {
        Task task = load(userId, taskId);
        apply(task, request);
        return toResponse(task, today());
    }

    @Transactional
    public void delete(UUID userId, UUID taskId) {
        tasks.delete(load(userId, taskId));
    }

    /**
     * Completa la aparición indicada. En una tarea recurrente se guarda en el historial y la tarea pasa a la
     * siguiente aparición; si había apariciones atrasadas se saltan hasta hoy.
     */
    @Transactional
    public TaskResponse complete(UUID userId, UUID taskId, LocalDate occurrenceDate) {
        Task task = load(userId, taskId);
        if (task.getStatus() == Status.DONE || !Objects.equals(task.getDueDate(), occurrenceDate)) {
            throw new ConflictException("task-occurrence-mismatch");
        }
        Instant now = now();
        if (!task.isRecurring()) {
            task.markDone(now);
            return toResponse(task, today());
        }
        completions.save(new TaskCompletion(task.getId(), occurrenceDate, now));
        Recurrence recurrence = task.recurrence();
        LocalDate today = today();
        LocalDate next = recurrence.nextAfter(occurrenceDate);
        if (next != null && next.isBefore(today)) {
            next = recurrence.firstOnOrAfter(today);
        }
        if (next == null) {
            task.markDone(now);
        } else {
            task.advanceTo(next, now);
        }
        return toResponse(task, today);
    }

    /** Deshace una compleción (por ejemplo desde el aviso «Deshacer»). */
    @Transactional
    public TaskResponse uncomplete(UUID userId, UUID taskId, LocalDate occurrenceDate) {
        Task task = load(userId, taskId);
        if (task.isRecurring()) {
            var key = new TaskCompletion.Key(task.getId(), occurrenceDate);
            if (!completions.existsById(key)) {
                throw new ConflictException("task-occurrence-mismatch");
            }
            completions.deleteById(key);
            task.reopen(occurrenceDate, now());
        } else {
            if (task.getStatus() != Status.DONE) {
                throw new ConflictException("task-occurrence-mismatch");
            }
            task.reopen(task.getDueDate(), now());
        }
        return toResponse(task, today());
    }

    @Transactional
    public TaskResponse postpone(UUID userId, UUID taskId, LocalDate date) {
        Task task = load(userId, taskId);
        if (task.getStatus() == Status.DONE) {
            throw new ConflictException("task-already-done");
        }
        new FieldValidationException.Collector()
                .add(date.isBefore(today()), "date", "task.postpone.past")
                .throwIfAny();
        task.postpone(date, now());
        return toResponse(task, today());
    }

    /** Apariciones entre dos fechas, incluidas las futuras de las tareas recurrentes y las ya completadas. */
    @Transactional(readOnly = true)
    public List<CalendarEntry> calendar(UUID userId, LocalDate from, LocalDate to) {
        new FieldValidationException.Collector()
                .add(to.isBefore(from), "to", "task.calendar.invalid-range")
                .add(ChronoUnit.DAYS.between(from, to) > MAX_CALENDAR_DAYS, "to", "task.calendar.range-too-long")
                .throwIfAny();

        List<CalendarEntry> entries = new ArrayList<>();
        for (Task task : tasks.findOpen(userId)) {
            if (task.getDueDate() == null || task.getDueDate().isAfter(to)) {
                continue;
            }
            if (!task.getDueDate().isBefore(from)) {
                entries.add(entry(task, task.getDueDate(), false));
            }
            if (task.isRecurring()) {
                task.recurrence().occurrencesBetween(task.getDueDate().plusDays(1), from, to)
                        .forEach(date -> entries.add(entry(task, date, false)));
            }
        }
        for (Task task : tasks.findDoneBetween(userId, from, to)) {
            if (!task.isRecurring()) {
                entries.add(entry(task, task.getDueDate(), true));
            }
        }
        List<TaskCompletion> done = completions.findBetween(userId, from, to);
        Map<UUID, Task> doneTasks = tasks.findAllById(done.stream().map(TaskCompletion::taskId).distinct().toList())
                .stream().collect(Collectors.toMap(Task::getId, Function.identity()));
        for (TaskCompletion completion : done) {
            Task task = doneTasks.get(completion.taskId());
            if (task != null) {
                entries.add(entry(task, completion.occurrenceDate(), true));
            }
        }
        entries.sort(Comparator.comparing(CalendarEntry::date)
                .thenComparing(CalendarEntry::time, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(CalendarEntry::title));
        return entries;
    }

    private void apply(Task task, TaskRequest request) {
        TaskCategory category = null;
        var errors = new FieldValidationException.Collector();
        if (request.categoryId() != null) {
            category = categories.findByIdAndUserId(request.categoryId(), task.getUserId()).orElse(null);
            errors.add(category == null, "categoryId", "task.category.not-found");
        }
        RecurrenceDto recurrenceDto = request.recurrence();
        boolean hasWeekdays = recurrenceDto != null && recurrenceDto.weekdays() != null
                && !recurrenceDto.weekdays().isEmpty();
        errors.add(request.dueTime() != null && request.dueDate() == null, "dueTime", "task.due-time.requires-date")
                .add(request.kind() == Kind.REMINDER && (request.dueDate() == null || request.dueTime() == null),
                        "dueTime", "task.reminder.requires-datetime")
                .add(request.reminderMinutesBefore() != null && request.dueTime() == null, "reminderMinutesBefore",
                        "task.notification.requires-time")
                .add(recurrenceDto != null && request.dueDate() == null, "recurrence",
                        "task.recurrence.requires-date")
                .add(hasWeekdays && recurrenceDto.frequency() != Recurrence.Frequency.WEEKLY, "recurrence",
                        "task.recurrence.weekdays-only-weekly")
                .add(recurrenceDto != null && recurrenceDto.until() != null && request.dueDate() != null
                        && recurrenceDto.until().isBefore(request.dueDate()), "recurrence",
                        "task.recurrence.until-before-start")
                .throwIfAny();

        LocalDate dueDate = request.dueDate();
        Recurrence recurrence = null;
        if (recurrenceDto != null) {
            Recurrence previous = task.recurrence();
            boolean sameSchedule = previous != null && previous.frequency() == recurrenceDto.frequency()
                    && previous.interval() == recurrenceDto.interval()
                    && previous.weekdays().equals(new Recurrence(recurrenceDto.frequency(), 1,
                            recurrenceDto.weekdays(), dueDate, null).weekdays())
                    && Objects.equals(task.getDueDate(), dueDate);
            // Si no cambia la regla ni la fecha, se conserva el ancla original (importante para «cada mes el día 31»).
            LocalDate anchor = sameSchedule ? previous.anchor() : dueDate;
            recurrence = new Recurrence(recurrenceDto.frequency(), recurrenceDto.interval(), recurrenceDto.weekdays(),
                    anchor, recurrenceDto.until());
            dueDate = recurrence.firstOnOrAfter(dueDate);
            new FieldValidationException.Collector()
                    .add(dueDate == null, "recurrence", "task.recurrence.until-before-start")
                    .throwIfAny();
        }

        task.update(request.kind(), request.title().trim(), blankToNull(request.description()), dueDate,
                request.dueTime(), request.deadline(), request.priority(), category, recurrence,
                request.reminderMinutesBefore(), now());
    }

    private Task load(UUID userId, UUID taskId) {
        return tasks.findByIdAndUserId(taskId, userId).orElseThrow(NotFoundException::new);
    }

    private TaskResponse toResponse(Task task, LocalDate today) {
        boolean overdue = task.getStatus() != Status.DONE && task.getDueDate() != null
                && task.getDueDate().isBefore(today);
        return new TaskResponse(task.getId(), task.getKind(), task.getTitle(), task.getDescription(),
                task.getDueDate(), task.getDueTime(), task.getDeadline(), task.getPriority(),
                CategoryResponse.from(task.getCategory()), task.getStatus(), RecurrenceDto.from(task.recurrence()),
                task.getReminderMinutesBefore(), overdue, task.getCompletedAt(), task.getCreatedAt(),
                task.getUpdatedAt());
    }

    private static CalendarEntry entry(Task task, LocalDate date, boolean done) {
        return new CalendarEntry(task.getId(), date, task.getDueTime(), task.getTitle(), task.getKind(),
                task.getPriority(), CategoryResponse.from(task.getCategory()), done, task.isRecurring());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    LocalDate today() {
        return LocalDate.now(clock.withZone(properties.timezone()));
    }

    private Instant now() {
        return clock.instant();
    }
}
