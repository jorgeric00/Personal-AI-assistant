package com.lifeos.habits;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.habits.HabitDtos.HabitRequest;
import com.lifeos.habits.HabitDtos.HabitResponse;

/** Hábitos y los días en que se cumplen. Las estadísticas se calculan en la app a partir de las marcas. */
@Service
public class HabitService {

    /** Rango máximo de marcas por consulta (unas 17 semanas de historial). */
    static final int MAX_RANGE_DAYS = 120;

    private static final UUID NONE = new UUID(0, 0);

    private final HabitRepository habits;
    private final HabitCheckRepository checks;
    private final LifeosProperties properties;
    private final Clock clock;

    public HabitService(HabitRepository habits, HabitCheckRepository checks, LifeosProperties properties,
            Clock clock) {
        this.habits = habits;
        this.checks = checks;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<HabitResponse> list(UUID userId, LocalDate from, LocalDate to) {
        new FieldValidationException.Collector()
                .add(to.isBefore(from) || ChronoUnit.DAYS.between(from, to) >= MAX_RANGE_DAYS, "to",
                        "habits.range.invalid")
                .throwIfAny();
        List<Habit> all = habits.findByUserIdOrderByCreatedAtAsc(userId);
        if (all.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<LocalDate>> byHabit = checks.findBetween(all.stream().map(Habit::getId).toList(), from, to)
                .stream().collect(Collectors.groupingBy(HabitCheck::getHabitId,
                        Collectors.mapping(HabitCheck::getDate, Collectors.toList())));
        return all.stream().map(h -> HabitResponse.from(h, byHabit.getOrDefault(h.getId(), List.of()))).toList();
    }

    @Transactional
    public HabitResponse create(UUID userId, HabitRequest request) {
        Habit habit = new Habit(userId, today(), clock.instant());
        apply(userId, habit, request, NONE);
        return HabitResponse.from(habits.save(habit), List.of());
    }

    @Transactional
    public HabitResponse update(UUID userId, UUID id, HabitRequest request) {
        Habit habit = load(userId, id);
        apply(userId, habit, request, id);
        return HabitResponse.from(habit, List.of());
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        habits.delete(load(userId, id));
    }

    /** Marca un día como cumplido. Repetir la marca no hace nada. */
    @Transactional
    public void check(UUID userId, UUID id, LocalDate date) {
        Habit habit = load(userId, id);
        new FieldValidationException.Collector()
                .add(date.isAfter(today()), "date", "habits.date.future")
                .throwIfAny();
        HabitCheck.Key key = new HabitCheck.Key(habit.getId(), date);
        if (!checks.existsById(key)) {
            checks.save(new HabitCheck(habit.getId(), date, clock.instant()));
        }
    }

    @Transactional
    public void uncheck(UUID userId, UUID id, LocalDate date) {
        Habit habit = load(userId, id);
        checks.deleteById(new HabitCheck.Key(habit.getId(), date));
    }

    private void apply(UUID userId, Habit habit, HabitRequest request, UUID excludeId) {
        String name = request.name().strip();
        new FieldValidationException.Collector()
                .add(habits.existsByName(userId, name, excludeId), "name", "habits.name.duplicate")
                .add(request.frequency() == HabitFrequency.WEEKLY && request.timesPerWeek() == null, "timesPerWeek",
                        "habits.times.invalid")
                .throwIfAny();
        habit.update(name, request.color().toLowerCase(), request.frequency(), request.weekdays(),
                request.timesPerWeek(), Boolean.TRUE.equals(request.archived()), clock.instant());
    }

    private Habit load(UUID userId, UUID id) {
        return habits.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(properties.timezone()));
    }
}
