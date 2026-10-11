package com.lifeos.tasks;

import static java.time.DayOfWeek.MONDAY;
import static java.time.DayOfWeek.THURSDAY;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.lifeos.tasks.Recurrence.Frequency;

class RecurrenceTest {

    private static LocalDate d(String value) {
        return LocalDate.parse(value);
    }

    @Test
    void dailyWithInterval() {
        var every3Days = new Recurrence(Frequency.DAILY, 3, Set.of(), d("2026-10-01"), null);
        assertThat(every3Days.nextAfter(d("2026-10-01"))).isEqualTo(d("2026-10-04"));
        assertThat(every3Days.nextAfter(d("2026-10-02"))).isEqualTo(d("2026-10-04"));
        assertThat(every3Days.firstOnOrAfter(d("2026-10-07"))).isEqualTo(d("2026-10-07"));
        assertThat(every3Days.firstOnOrAfter(d("2026-09-01"))).isEqualTo(d("2026-10-01"));
    }

    @Test
    void weeklyOnAnchorDay() {
        // 2026-10-05 es lunes
        var weekly = new Recurrence(Frequency.WEEKLY, 1, Set.of(), d("2026-10-05"), null);
        assertThat(weekly.nextAfter(d("2026-10-05"))).isEqualTo(d("2026-10-12"));
        assertThat(weekly.nextAfter(d("2026-10-07"))).isEqualTo(d("2026-10-12"));
    }

    @Test
    void weeklyOnSeveralDaysEveryTwoWeeks() {
        var custom = new Recurrence(Frequency.WEEKLY, 2, Set.of(MONDAY, THURSDAY), d("2026-10-05"), null);
        assertThat(custom.occurrencesBetween(d("2026-10-05"), d("2026-10-01"), d("2026-10-31")))
                .containsExactly(d("2026-10-05"), d("2026-10-08"), d("2026-10-19"), d("2026-10-22"));
    }

    @Test
    void monthlyKeepsDayOfMonthFromAnchor() {
        var monthly = new Recurrence(Frequency.MONTHLY, 1, Set.of(), d("2026-01-31"), null);
        assertThat(monthly.nextAfter(d("2026-01-31"))).isEqualTo(d("2026-02-28"));
        assertThat(monthly.nextAfter(d("2026-02-28"))).isEqualTo(d("2026-03-31"));
        assertThat(monthly.nextAfter(d("2026-03-31"))).isEqualTo(d("2026-04-30"));
    }

    @Test
    void monthlyEveryThreeMonths() {
        var quarterly = new Recurrence(Frequency.MONTHLY, 3, Set.of(), d("2026-01-15"), null);
        assertThat(quarterly.nextAfter(d("2026-01-15"))).isEqualTo(d("2026-04-15"));
        assertThat(quarterly.firstOnOrAfter(d("2026-05-01"))).isEqualTo(d("2026-07-15"));
    }

    @Test
    void stopsAfterUntil() {
        var limited = new Recurrence(Frequency.DAILY, 1, Set.of(), d("2026-10-01"), d("2026-10-03"));
        assertThat(limited.nextAfter(d("2026-10-02"))).isEqualTo(d("2026-10-03"));
        assertThat(limited.nextAfter(d("2026-10-03"))).isNull();
        assertThat(limited.occurrencesBetween(d("2026-10-01"), d("2026-09-01"), d("2026-12-31"))).hasSize(3);
    }

    @Test
    void weekdaysRoundTripAsString() {
        var custom = new Recurrence(Frequency.WEEKLY, 1, Set.of(THURSDAY, MONDAY), d("2026-10-05"), null);
        assertThat(Recurrence.parseWeekdays(custom.weekdaysAsString())).containsExactlyInAnyOrder(MONDAY, THURSDAY);
    }
}
