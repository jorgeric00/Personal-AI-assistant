package com.lifeos.agenda;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.agenda.AgendaDtos.ActivityRequest;
import com.lifeos.agenda.AgendaDtos.ActivityResponse;
import com.lifeos.agenda.AgendaDtos.AgendaItem;
import com.lifeos.agenda.AgendaDtos.CategoryRef;
import com.lifeos.agenda.AgendaDtos.CategoryRequest;
import com.lifeos.agenda.AgendaDtos.CategoryResponse;
import com.lifeos.agenda.AgendaDtos.ItemKind;
import com.lifeos.common.config.LifeosProperties;
import com.lifeos.common.error.ConflictException;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.fitness.FitnessCalendar;
import com.lifeos.fitness.FitnessCalendar.CalendarWorkout;
import com.lifeos.tasks.Recurrence;
import com.lifeos.tasks.TaskDtos.RecurrenceDto;

/** Agenda: actividades con sus categorías y estados, junto con los entrenamientos del módulo de entreno. */
@Service
public class AgendaService {

    /** Rango máximo que se puede pedir de una vez (una cuadrícula mensual son 42 días). */
    static final int MAX_RANGE_DAYS = 62;

    /** Duración máxima de una aparición (un viaje largo, por ejemplo). */
    static final int MAX_ACTIVITY_DAYS = 60;

    private static final UUID NONE = new UUID(0, 0);

    private final ActivityCategoryRepository categories;
    private final ActivityRepository activities;
    private final ActivityOccurrenceRepository occurrences;
    private final AgendaSetupService setup;
    private final FitnessCalendar fitness;
    private final LifeosProperties properties;
    private final Clock clock;

    public AgendaService(ActivityCategoryRepository categories, ActivityRepository activities,
            ActivityOccurrenceRepository occurrences, AgendaSetupService setup, FitnessCalendar fitness,
            LifeosProperties properties, Clock clock) {
        this.categories = categories;
        this.activities = activities;
        this.occurrences = occurrences;
        this.setup = setup;
        this.fitness = fitness;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<AgendaItem> agenda(UUID userId, LocalDate from, LocalDate to) {
        new FieldValidationException.Collector()
                .add(to.isBefore(from) || ChronoUnit.DAYS.between(from, to) >= MAX_RANGE_DAYS, "to",
                        "agenda.range.invalid")
                .throwIfAny();
        List<Activity> candidates = activities.findCandidates(userId, from, to);
        Map<UUID, Map<LocalDate, ActivityStatus>> statuses = occurrences
                .findByActivityIds(candidates.stream().map(Activity::getId).toList()).stream()
                .collect(Collectors.groupingBy(ActivityOccurrence::getActivityId,
                        Collectors.toMap(ActivityOccurrence::getDate, ActivityOccurrence::getStatus)));
        List<AgendaItem> items = new ArrayList<>();
        for (Activity a : candidates) {
            for (LocalDate start : a.occurrencesTouching(from, to)) {
                ActivityStatus status = statuses.getOrDefault(a.getId(), Map.of()).getOrDefault(start,
                        ActivityStatus.PLANNED);
                items.add(new AgendaItem(ItemKind.ACTIVITY, a.getId(), start, a.getTitle(),
                        CategoryRef.from(a.getCategory()), start, a.getStartTime(), start.plusDays(a.extraDays()),
                        a.getEndTime(), a.getLocation(), status, a.recurrence() != null));
            }
        }
        LocalDate today = today();
        for (CalendarWorkout w : fitness.between(userId, from, to, properties.timezone())) {
            boolean logged = w.workoutId() != null;
            ActivityStatus status = logged
                    ? (w.finishedAt() != null ? ActivityStatus.DONE : ActivityStatus.CONFIRMED)
                    : (w.date().isBefore(today) ? ActivityStatus.MISSED : ActivityStatus.PLANNED);
            items.add(new AgendaItem(logged ? ItemKind.WORKOUT : ItemKind.ROUTINE,
                    logged ? w.workoutId() : w.routineId(), w.date(), w.name(), null, w.date(), null, w.date(), null,
                    null, status, !logged));
        }
        items.sort(Comparator.comparing(AgendaItem::date)
                .thenComparing(AgendaItem::startTime, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(AgendaItem::title, String.CASE_INSENSITIVE_ORDER));
        return items;
    }

    @Transactional(readOnly = true)
    public ActivityResponse activity(UUID userId, UUID id) {
        return ActivityResponse.from(load(userId, id));
    }

    @Transactional
    public ActivityResponse create(UUID userId, ActivityRequest request) {
        setup.ensureCategories(userId);
        Activity activity = new Activity(userId, clock.instant());
        apply(userId, activity, request);
        return ActivityResponse.from(activities.save(activity));
    }

    /** Editar una actividad repetida cambia toda la serie; los estados guardados siguen ligados a su fecha. */
    @Transactional
    public ActivityResponse update(UUID userId, UUID id, ActivityRequest request) {
        Activity activity = load(userId, id);
        apply(userId, activity, request);
        activities.flush();
        return ActivityResponse.from(activity);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        activities.delete(load(userId, id));
    }

    /** Guarda el estado de una aparición; volver a «planificada» borra el estado guardado. */
    @Transactional
    public void setStatus(UUID userId, UUID id, LocalDate date, ActivityStatus status) {
        Activity activity = load(userId, id);
        if (!activity.occurrencesTouching(date, date).contains(date)) {
            throw new NotFoundException();
        }
        ActivityOccurrence.Key key = new ActivityOccurrence.Key(id, date);
        if (status == ActivityStatus.PLANNED) {
            occurrences.deleteById(key);
            return;
        }
        occurrences.findById(key).ifPresentOrElse(o -> o.setStatus(status, clock.instant()),
                () -> occurrences.save(new ActivityOccurrence(id, date, status, clock.instant())));
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> categories(UUID userId) {
        setup.ensureCategories(userId);
        Set<UUID> used = categories.findUsedIds(userId);
        return categories.findByUserIdOrderByNameAsc(userId).stream()
                .map(c -> CategoryResponse.from(c, used.contains(c.getId()))).toList();
    }

    @Transactional
    public CategoryResponse createCategory(UUID userId, CategoryRequest request) {
        setup.ensureCategories(userId);
        String name = request.name().strip();
        checkCategoryName(userId, name, NONE);
        ActivityCategory category = new ActivityCategory(userId, name, request.color().toLowerCase(),
                clock.instant());
        return CategoryResponse.from(categories.save(category), false);
    }

    @Transactional
    public CategoryResponse updateCategory(UUID userId, UUID id, CategoryRequest request) {
        ActivityCategory category = loadCategory(userId, id);
        String name = request.name().strip();
        checkCategoryName(userId, name, id);
        category.update(name, request.color().toLowerCase(), Boolean.TRUE.equals(request.archived()));
        return CategoryResponse.from(category, categories.findUsedIds(userId).contains(id));
    }

    /** Una categoría con actividades no se borra (se quedarían sin categoría); se puede archivar. */
    @Transactional
    public void deleteCategory(UUID userId, UUID id) {
        ActivityCategory category = loadCategory(userId, id);
        if (categories.findUsedIds(userId).contains(id)) {
            throw new ConflictException("activity-category-in-use");
        }
        categories.delete(category);
    }

    private void apply(UUID userId, Activity activity, ActivityRequest request) {
        LocalDate startDate = request.startDate();
        LocalDate endDate = request.endDate();
        LocalTime startTime = request.startTime();
        LocalTime endTime = request.endTime();
        RecurrenceDto r = request.recurrence();
        ActivityCategory category = categories.findByIdAndUserId(request.categoryId(), userId).orElse(null);
        // Una categoría archivada solo vale si la actividad ya la tenía.
        boolean categoryUsable = category != null && (!category.isArchived()
                || (activity.getCategory() != null && activity.getCategory().getId().equals(category.getId())));
        boolean hasWeekdays = r != null && r.weekdays() != null && !r.weekdays().isEmpty();
        new FieldValidationException.Collector()
                .add(!categoryUsable, "categoryId", "agenda.activity.category.required")
                .add((startTime == null) != (endTime == null), startTime == null ? "startTime" : "endTime",
                        "agenda.activity.time.both")
                .add(endDate.isBefore(startDate)
                        || (endDate.equals(startDate) && startTime != null && endTime != null
                                && !endTime.isAfter(startTime)),
                        "endDate", "agenda.activity.end.before-start")
                .add(ChronoUnit.DAYS.between(startDate, endDate) > MAX_ACTIVITY_DAYS, "endDate",
                        "agenda.activity.too-long")
                .add(hasWeekdays && r.frequency() != Recurrence.Frequency.WEEKLY, "recurrence",
                        "task.recurrence.weekdays-only-weekly")
                .add(r != null && r.until() != null && r.until().isBefore(startDate), "recurrence",
                        "task.recurrence.until-before-start")
                .throwIfAny();
        Recurrence recurrence = r == null ? null
                : new Recurrence(r.frequency(), r.interval(), r.weekdays(), startDate, r.until());
        activity.update(request.title().strip(), category, startDate, startTime, endDate, endTime,
                blankToNull(request.description()), blankToNull(request.location()), recurrence,
                request.reminderMinutesBefore(), clock.instant());
    }

    private void checkCategoryName(UUID userId, String name, UUID excludeId) {
        new FieldValidationException.Collector()
                .add(categories.existsByName(userId, name, excludeId), "name", "agenda.category.name.duplicate")
                .throwIfAny();
    }

    private Activity load(UUID userId, UUID id) {
        return activities.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }

    private ActivityCategory loadCategory(UUID userId, UUID id) {
        return categories.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(properties.timezone()));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
