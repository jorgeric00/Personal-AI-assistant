package com.lifeos.reports;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

/** Periodos de los informes: semanas de lunes a domingo y meses naturales. */
public enum ReportPeriod {
    WEEK, MONTH;

    LocalDate startOf(LocalDate date) {
        return this == WEEK ? date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)) : date.withDayOfMonth(1);
    }

    LocalDate endOf(LocalDate start) {
        return this == WEEK ? start.plusDays(6) : start.with(TemporalAdjusters.lastDayOfMonth());
    }

    LocalDate previousStart(LocalDate start) {
        return this == WEEK ? start.minusWeeks(1) : start.minusMonths(1);
    }
}
