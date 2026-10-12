package com.lifeos.habits;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class HabitDtos {

    private HabitDtos() {
    }

    public record HabitRequest(
            @NotBlank(message = "{habits.name.required}")
            @Size(max = 80, message = "{habits.name.too-long}") String name,
            @NotNull(message = "{habits.color.invalid}")
            @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "{habits.color.invalid}") String color,
            @NotNull(message = "{habits.frequency.required}") HabitFrequency frequency,
            Set<DayOfWeek> weekdays,
            @Min(value = 1, message = "{habits.times.invalid}")
            @Max(value = 7, message = "{habits.times.invalid}") Integer timesPerWeek,
            Boolean archived) {
    }

    /** checks: días cumplidos dentro del rango pedido. */
    public record HabitResponse(UUID id, String name, String color, HabitFrequency frequency, List<DayOfWeek> weekdays,
            Integer timesPerWeek, LocalDate startDate, boolean archived, List<LocalDate> checks) {

        static HabitResponse from(Habit h, List<LocalDate> checks) {
            return new HabitResponse(h.getId(), h.getName(), h.getColor(), h.getFrequency(),
                    List.copyOf(h.getWeekdays()), h.getTimesPerWeek(), h.getStartDate(), h.isArchived(), checks);
        }
    }
}
