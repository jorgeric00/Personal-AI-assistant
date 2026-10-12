package com.lifeos.tasks;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.lifeos.tasks.Task.Kind;
import com.lifeos.tasks.Task.Priority;
import com.lifeos.tasks.Task.Status;

public final class TaskDtos {

    private TaskDtos() {
    }

    public record RecurrenceDto(
            @NotNull(message = "{task.recurrence.frequency.required}") Recurrence.Frequency frequency,
            @NotNull(message = "{task.recurrence.interval.invalid}")
            @Min(value = 1, message = "{task.recurrence.interval.invalid}")
            @Max(value = 365, message = "{task.recurrence.interval.invalid}") Integer interval,
            Set<DayOfWeek> weekdays,
            LocalDate until) {

        static RecurrenceDto from(Recurrence recurrence) {
            return recurrence == null ? null
                    : new RecurrenceDto(recurrence.frequency(), recurrence.interval(), recurrence.weekdays(),
                            recurrence.until());
        }
    }

    public record TaskRequest(
            @NotNull(message = "{task.kind.required}") Kind kind,
            @NotBlank(message = "{task.title.required}") @Size(max = 200, message = "{task.title.too-long}") String title,
            @Size(max = 5000, message = "{task.description.too-long}") String description,
            LocalDate dueDate,
            LocalTime dueTime,
            LocalDate deadline,
            @NotNull(message = "{task.priority.required}") Priority priority,
            UUID categoryId,
            @Valid RecurrenceDto recurrence,
            @Min(value = 0, message = "{task.notification.invalid}")
            @Max(value = 10080, message = "{task.notification.invalid}") Integer reminderMinutesBefore) {
    }

    public record CategoryResponse(UUID id, String name, String color) {

        static CategoryResponse from(TaskCategory category) {
            return category == null ? null
                    : new CategoryResponse(category.getId(), category.getName(), category.getColor());
        }
    }

    public record CategoryRequest(
            @NotBlank(message = "{task.category.name.required}")
            @Size(max = 50, message = "{task.category.name.too-long}") String name,
            @NotNull(message = "{task.category.color.invalid}")
            @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "{task.category.color.invalid}") String color) {
    }

    public record TaskResponse(UUID id, Kind kind, String title, String description, LocalDate dueDate,
            LocalTime dueTime, LocalDate deadline, Priority priority, CategoryResponse category, Status status,
            RecurrenceDto recurrence, Integer reminderMinutesBefore, boolean overdue, Instant completedAt,
            Instant createdAt, Instant updatedAt) {
    }

    /** Aparición a completar o reabrir; null en las tareas sin fecha. */
    public record OccurrenceRequest(LocalDate occurrenceDate) {
    }

    public record PostponeRequest(@NotNull(message = "{task.postpone.date.required}") LocalDate date) {
    }

    public record CalendarEntry(UUID taskId, LocalDate date, LocalTime time, String title, Kind kind,
            Priority priority, CategoryResponse category, boolean done, boolean recurring) {
    }

    /** Referencia corta a una tarea desde otros módulos (por ejemplo, las notas). */
    public record TaskRef(UUID id, String title, Kind kind, Status status, LocalDate dueDate) {
    }
}
