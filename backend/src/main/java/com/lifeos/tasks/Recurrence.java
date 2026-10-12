package com.lifeos.tasks;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Regla de repetición. Las apariciones se calculan siempre a partir de la fecha ancla (la primera aparición),
 * así que posponer o completar tarde una aparición no desplaza las siguientes.
 *
 * @param interval cada cuántos días, semanas o meses (1 = todos)
 * @param weekdays días de la semana para la repetición semanal; vacío = el día de la semana del ancla
 * @param until    última fecha posible (incluida), o null si no termina
 */
public record Recurrence(Frequency frequency, int interval, Set<DayOfWeek> weekdays, LocalDate anchor,
        LocalDate until) {

    public enum Frequency {
        DAILY, WEEKLY, MONTHLY
    }

    private static final int MAX_ITERATIONS = 5_000;

    public Recurrence {
        weekdays = weekdays == null || weekdays.isEmpty() ? EnumSet.noneOf(DayOfWeek.class) : EnumSet.copyOf(weekdays);
    }

    /** Primera aparición estrictamente posterior a {@code date}, o null si ya no hay más. */
    public LocalDate nextAfter(LocalDate date) {
        return firstOnOrAfter(date.plusDays(1));
    }

    /** Primera aparición en {@code date} o después, o null si ya no hay más. */
    public LocalDate firstOnOrAfter(LocalDate date) {
        LocalDate from = date.isBefore(anchor) ? anchor : date;
        LocalDate candidate = switch (frequency) {
            case DAILY -> {
                long days = ChronoUnit.DAYS.between(anchor, from);
                long steps = (days + interval - 1) / interval;
                yield anchor.plusDays(steps * interval);
            }
            case WEEKLY -> nextWeekly(from);
            case MONTHLY -> nextMonthly(from);
        };
        return candidate == null || (until != null && candidate.isAfter(until)) ? null : candidate;
    }

    /** Apariciones entre {@code from} y {@code to} (ambas incluidas), empezando a contar en {@code start}. */
    public List<LocalDate> occurrencesBetween(LocalDate start, LocalDate from, LocalDate to) {
        List<LocalDate> result = new ArrayList<>();
        LocalDate next = firstOnOrAfter(start.isAfter(from) ? start : from);
        while (next != null && !next.isAfter(to) && result.size() < MAX_ITERATIONS) {
            result.add(next);
            next = nextAfter(next);
        }
        return result;
    }

    private LocalDate nextWeekly(LocalDate from) {
        Set<DayOfWeek> days = weekdays.isEmpty() ? EnumSet.of(anchor.getDayOfWeek()) : weekdays;
        LocalDate anchorWeek = anchor.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate candidate = from;
        for (int i = 0; i < 7 * interval + 7; i++) {
            LocalDate week = candidate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            long weeks = ChronoUnit.WEEKS.between(anchorWeek, week);
            if (weeks % interval == 0 && days.contains(candidate.getDayOfWeek())) {
                return candidate;
            }
            candidate = candidate.plusDays(1);
        }
        return null;
    }

    private LocalDate nextMonthly(LocalDate from) {
        long months = ChronoUnit.MONTHS.between(anchor.withDayOfMonth(1), from.withDayOfMonth(1));
        long step = Math.max(0, months / interval);
        for (int i = 0; i < MAX_ITERATIONS; i++) {
            // Siempre desde el ancla: el día 31 pasa a ser el último día en meses más cortos y vuelve al 31 después.
            LocalDate candidate = anchor.plusMonths((step + i) * interval);
            if (!candidate.isBefore(from)) {
                return candidate;
            }
        }
        return null;
    }

    public String weekdaysAsString() {
        return weekdays.stream().map(DayOfWeek::name).sorted().collect(Collectors.joining(","));
    }

    public static Set<DayOfWeek> parseWeekdays(String value) {
        if (value == null || value.isBlank()) {
            return EnumSet.noneOf(DayOfWeek.class);
        }
        return Arrays.stream(value.split(",")).map(String::trim).map(DayOfWeek::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(DayOfWeek.class)));
    }
}
