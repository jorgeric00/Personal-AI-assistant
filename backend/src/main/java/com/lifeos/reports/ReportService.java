package com.lifeos.reports;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.finance.RecurringService;
import com.lifeos.habits.HabitFrequency;
import com.lifeos.reports.ReportDtos.BodyChange;
import com.lifeos.reports.ReportDtos.CategoryAmount;
import com.lifeos.reports.ReportDtos.Finance;
import com.lifeos.reports.ReportDtos.HabitSummary;
import com.lifeos.reports.ReportDtos.Nutrition;
import com.lifeos.reports.ReportDtos.ReportResponse;
import com.lifeos.reports.ReportDtos.Tasks;
import com.lifeos.reports.ReportDtos.Training;

/**
 * Resumen de un periodo a partir de lo que el usuario ha registrado en cada módulo. Solo cuenta datos reales: lo
 * planificado y no hecho no suma, y no se sacan conclusiones de las cifras.
 */
@Service
public class ReportService {

    /** Columnas de las medidas corporales, con el nombre que usa el cliente. */
    private static final List<String[]> BODY_METRICS = List.of(new String[] { "weight_kg", "weightKg" },
            new String[] { "body_fat_pct", "bodyFatPct" }, new String[] { "waist_cm", "waistCm" },
            new String[] { "chest_cm", "chestCm" }, new String[] { "hip_cm", "hipCm" },
            new String[] { "arm_cm", "armCm" }, new String[] { "thigh_cm", "thighCm" });

    private final JdbcTemplate jdbc;
    private final RecurringService recurring;
    private final Clock clock;
    private final LifeosProperties properties;

    public ReportService(JdbcTemplate jdbc, RecurringService recurring, Clock clock,
            LifeosProperties properties) {
        this.jdbc = jdbc;
        this.recurring = recurring;
        this.clock = clock;
        this.properties = properties;
    }

    private record Range(LocalDate from, LocalDate to) {
    }

    @Transactional(readOnly = true)
    public ReportResponse report(UUID userId, ReportPeriod period, LocalDate date) {
        LocalDate today = LocalDate.now(clock.withZone(properties.timezone()));
        new FieldValidationException.Collector()
                .add(date.isAfter(today), "date", "reports.date.future")
                .add(date.isBefore(today.minusYears(20)), "date", "reports.date.invalid")
                .throwIfAny();
        LocalDate start = period.startOf(date);
        LocalDate end = period.endOf(start);
        boolean partial = end.isAfter(today);
        Range current = new Range(start, partial ? today : end);
        LocalDate previousStart = period.previousStart(start);
        LocalDate previousEnd = period.endOf(previousStart);
        // Un periodo en curso se compara con los mismos días del anterior
        LocalDate previousTo = partial
                ? min(previousStart.plusDays(ChronoUnit.DAYS.between(start, today)), previousEnd)
                : previousEnd;
        Range previous = new Range(previousStart, previousTo);

        recurring.generateDue(userId);
        return new ReportResponse(period, start, end, current.to(), partial, previous.from(), previous.to(),
                new Tasks(completedTasks(userId, current), completedTasks(userId, previous)),
                finance(userId, current, previous), training(userId, current, previous),
                nutrition(userId, current, previous), habits(userId, current, previous, today),
                body(userId, current));
    }

    private int completedTasks(UUID userId, Range range) {
        String zone = properties.timezone().getId();
        Integer single = jdbc.queryForObject("""
                select count(*) from task
                where user_id = ? and recurrence_frequency is null and status = 'DONE'
                  and (completed_at at time zone ?)::date between ? and ?""", Integer.class,
                userId, zone, sql(range.from()), sql(range.to()));
        Integer repeated = jdbc.queryForObject("""
                select count(*) from task_completion c join task t on t.id = c.task_id
                where t.user_id = ? and (c.completed_at at time zone ?)::date between ? and ?""", Integer.class,
                userId, zone, sql(range.from()), sql(range.to()));
        return single + repeated;
    }

    private Finance finance(UUID userId, Range current, Range previous) {
        List<String> currencies = jdbc.queryForList("select currency from finance_settings where user_id = ?",
                String.class, userId);
        if (currencies.isEmpty()) {
            return new Finance(null, 0, 0, 0, 0, List.of());
        }
        String currency = currencies.getFirst();
        long[] now = totals(userId, currency, current);
        long[] before = totals(userId, currency, previous);
        List<CategoryAmount> top = jdbc.query("""
                select c.id, c.name, c.color, sum(m.amount_cents) as total
                from finance_movement m join finance_category c on c.id = m.category_id
                where m.user_id = ? and m.currency = ? and m.kind = 'EXPENSE' and m.date between ? and ?
                group by c.id, c.name, c.color order by total desc, c.name limit 5""",
                (rs, i) -> new CategoryAmount(rs.getObject("id", UUID.class), rs.getString("name"),
                        rs.getString("color"), rs.getLong("total")),
                userId, currency, sql(current.from()), sql(current.to()));
        return new Finance(currency, now[0], now[1], before[0], before[1], top);
    }

    /** Ingresos y gastos en céntimos. */
    private long[] totals(UUID userId, String currency, Range range) {
        return jdbc.queryForObject("""
                select coalesce(sum(amount_cents) filter (where kind = 'INCOME'), 0) as income,
                       coalesce(sum(amount_cents) filter (where kind = 'EXPENSE'), 0) as expense
                from finance_movement where user_id = ? and currency = ? and date between ? and ?""",
                (rs, i) -> new long[] { rs.getLong("income"), rs.getLong("expense") },
                userId, currency, sql(range.from()), sql(range.to()));
    }

    private Training training(UUID userId, Range current, Range previous) {
        int[] now = workouts(userId, current);
        int[] before = workouts(userId, previous);
        return new Training(now[0], before[0], now[1], before[1]);
    }

    /** Sesiones terminadas y series hechas en ellas. */
    private int[] workouts(UUID userId, Range range) {
        return jdbc.queryForObject("""
                select count(distinct w.id) as workouts, count(s.id) filter (where s.done) as sets
                from workout w
                left join workout_exercise e on e.workout_id = w.id
                left join workout_set s on s.workout_exercise_id = e.id
                where w.user_id = ? and w.finished_at is not null and w.date between ? and ?""",
                (rs, i) -> new int[] { rs.getInt("workouts"), rs.getInt("sets") },
                userId, sql(range.from()), sql(range.to()));
    }

    private Nutrition nutrition(UUID userId, Range current, Range previous) {
        Object[] now = calories(userId, current);
        Object[] before = calories(userId, previous);
        return new Nutrition((int) now[0], (int) before[0], (Integer) now[1], (Integer) before[1], (boolean) now[2]);
    }

    /** Días con alimentos, media de calorías de los días que las tienen y si alguna es estimada. */
    private Object[] calories(UUID userId, Range range) {
        return jdbc.queryForObject("""
                select count(*) as days,
                       round(avg(kcal) filter (where kcal is not null))::int as average,
                       coalesce(bool_or(estimated_kcal), false) as estimated
                from (select date, sum(calories) as kcal,
                             bool_or(estimated and calories is not null) as estimated_kcal
                      from food_entry where user_id = ? and date between ? and ? group by date) d""",
                (rs, i) -> new Object[] { rs.getInt("days"), rs.getObject("average", Integer.class),
                        rs.getBoolean("estimated") },
                userId, sql(range.from()), sql(range.to()));
    }

    private record HabitRow(UUID id, String name, String color, HabitFrequency frequency, String weekdays,
            Integer timesPerWeek, LocalDate startDate) {
    }

    private List<HabitSummary> habits(UUID userId, Range current, Range previous, LocalDate today) {
        List<HabitRow> rows = jdbc.query("""
                select id, name, color, frequency, weekdays, times_per_week, start_date from habit
                where user_id = ? and not archived and start_date <= ? order by created_at""",
                (rs, i) -> new HabitRow(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("color"),
                        HabitFrequency.valueOf(rs.getString("frequency")), rs.getString("weekdays"),
                        rs.getObject("times_per_week", Integer.class), rs.getDate("start_date").toLocalDate()),
                userId, sql(current.to()));
        List<HabitSummary> result = new ArrayList<>();
        for (HabitRow habit : rows) {
            Set<LocalDate> checks = new HashSet<>(jdbc.queryForList(
                    "select date from habit_check where habit_id = ? and date between ? and ?", LocalDate.class,
                    habit.id(), sql(previous.from()), sql(current.to())));
            int[] now = progress(habit, checks, current, today);
            int[] before = progress(habit, checks, previous, today);
            boolean daily = habit.frequency() == HabitFrequency.DAILY;
            result.add(new HabitSummary(habit.id(), habit.name(), habit.color(), habit.frequency(),
                    habit.timesPerWeek(), now[0], daily ? now[1] : null, before[0], daily ? before[1] : null));
        }
        return result;
    }

    /**
     * Días marcados y días que tocaban. Hoy solo cuenta como esperado si ya está marcado; en los diarios solo cuentan
     * las marcas de los días que tocaban.
     */
    private static int[] progress(HabitRow habit, Set<LocalDate> checks, Range range, LocalDate today) {
        boolean daily = habit.frequency() == HabitFrequency.DAILY;
        Set<DayOfWeek> weekdays = !daily || habit.weekdays() == null || habit.weekdays().isBlank()
                ? EnumSet.allOf(DayOfWeek.class)
                : EnumSet.copyOf(Arrays.stream(habit.weekdays().split(",")).map(DayOfWeek::valueOf).toList());
        int done = 0;
        int expected = 0;
        for (LocalDate day = range.from(); !day.isAfter(range.to()); day = day.plusDays(1)) {
            boolean scheduled = !day.isBefore(habit.startDate()) && weekdays.contains(day.getDayOfWeek());
            boolean checked = checks.contains(day);
            if (checked && (scheduled || !daily)) {
                done++;
            }
            if (scheduled && (checked || day.isBefore(today))) {
                expected++;
            }
        }
        return new int[] { done, expected };
    }

    private List<BodyChange> body(UUID userId, Range range) {
        List<BodyChange> changes = new ArrayList<>();
        for (String[] metric : BODY_METRICS) {
            String column = metric[0];
            List<Object[]> values = jdbc.query("select date, " + column + " as v from body_measurement"
                    + " where user_id = ? and date between ? and ? and " + column + " is not null order by date",
                    (rs, i) -> new Object[] { rs.getDate("date").toLocalDate(), rs.getBigDecimal("v") },
                    userId, sql(range.from()), sql(range.to()));
            if (values.isEmpty()) {
                continue;
            }
            Object[] first = values.getFirst();
            Object[] last = values.getLast();
            changes.add(new BodyChange(metric[1], (LocalDate) first[0], (BigDecimal) first[1], (LocalDate) last[0],
                    (BigDecimal) last[1], values.size()));
        }
        return changes;
    }

    private static Date sql(LocalDate date) {
        return Date.valueOf(date);
    }

    private static LocalDate min(LocalDate a, LocalDate b) {
        return a.isBefore(b) ? a : b;
    }
}
