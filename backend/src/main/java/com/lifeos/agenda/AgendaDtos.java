package com.lifeos.agenda;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.lifeos.tasks.Recurrence;
import com.lifeos.tasks.TaskDtos.RecurrenceDto;

/** Peticiones y respuestas de la agenda. Fechas y horas locales del usuario. */
public final class AgendaDtos {

    private AgendaDtos() {
    }

    public record CategoryRequest(
            @NotBlank(message = "{agenda.category.name.required}")
            @Size(max = 50, message = "{agenda.category.name.too-long}") String name,
            @NotNull(message = "{agenda.category.color.invalid}")
            @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "{agenda.category.color.invalid}") String color,
            Boolean archived) {
    }

    /** {@code inUse}: tiene actividades, así que no se puede borrar (sí archivar). */
    public record CategoryResponse(UUID id, String name, String color, boolean archived, boolean inUse) {

        static CategoryResponse from(ActivityCategory c, boolean inUse) {
            return new CategoryResponse(c.getId(), c.getName(), c.getColor(), c.isArchived(), inUse);
        }
    }

    public record CategoryRef(UUID id, String name, String color) {

        static CategoryRef from(ActivityCategory c) {
            return new CategoryRef(c.getId(), c.getName(), c.getColor());
        }
    }

    /** Sin horas = todo el día. La repetición se ancla en {@code startDate}. */
    public record ActivityRequest(
            @NotBlank(message = "{agenda.activity.title.required}")
            @Size(max = 200, message = "{agenda.text.too-long}") String title,
            @NotNull(message = "{agenda.activity.category.required}") UUID categoryId,
            @NotNull(message = "{agenda.activity.start.required}") LocalDate startDate,
            LocalTime startTime,
            @NotNull(message = "{agenda.activity.end.required}") LocalDate endDate,
            LocalTime endTime,
            @Size(max = 2000, message = "{agenda.text.too-long}") String description,
            @Size(max = 200, message = "{agenda.text.too-long}") String location,
            @Valid RecurrenceDto recurrence,
            @Min(value = 0, message = "{task.notification.invalid}")
            @Max(value = 10080, message = "{task.notification.invalid}") Integer reminderMinutesBefore) {
    }

    public record ActivityResponse(UUID id, String title, CategoryRef category, LocalDate startDate,
            LocalTime startTime, LocalDate endDate, LocalTime endTime, String description, String location,
            RecurrenceDto recurrence, Integer reminderMinutesBefore) {

        static ActivityResponse from(Activity a) {
            Recurrence r = a.recurrence();
            return new ActivityResponse(a.getId(), a.getTitle(), CategoryRef.from(a.getCategory()), a.getStartDate(),
                    a.getStartTime(), a.getEndDate(), a.getEndTime(), a.getDescription(), a.getLocation(),
                    r == null ? null : new RecurrenceDto(r.frequency(), r.interval(), r.weekdays(), r.until()),
                    a.getReminderMinutesBefore());
        }
    }

    public record StatusRequest(@NotNull(message = "{agenda.status.required}") ActivityStatus status) {
    }

    public enum ItemKind {
        /** Aparición de una actividad. */
        ACTIVITY,
        /** Entrenamiento registrado en el módulo de entreno. */
        WORKOUT,
        /** Día en que toca una rutina y todavía no hay entrenamiento registrado. */
        ROUTINE
    }

    /**
     * Elemento de la agenda. {@code id} es la actividad, el entrenamiento o la rutina según {@code kind};
     * {@code date} es la fecha de inicio de la aparición.
     */
    public record AgendaItem(ItemKind kind, UUID id, LocalDate date, String title, CategoryRef category,
            LocalDate startDate, LocalTime startTime, LocalDate endDate, LocalTime endTime, String location,
            ActivityStatus status, boolean recurring) {
    }
}
