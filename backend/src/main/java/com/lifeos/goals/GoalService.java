package com.lifeos.goals;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.goals.GoalDtos.GoalRequest;
import com.lifeos.goals.GoalDtos.GoalResponse;

/** Objetivos personales. Valida que cada tipo tenga lo que necesita para calcular su progreso. */
@Service
public class GoalService {

    private static final BigDecimal SEVEN = BigDecimal.valueOf(7);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final GoalRepository goals;
    private final JdbcTemplate jdbc;
    private final LifeosProperties properties;
    private final Clock clock;

    public GoalService(GoalRepository goals, JdbcTemplate jdbc, LifeosProperties properties, Clock clock) {
        this.goals = goals;
        this.jdbc = jdbc;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<GoalResponse> list(UUID userId) {
        return goals.findByUserIdOrderByCreatedAtAsc(userId).stream().map(GoalResponse::from).toList();
    }

    @Transactional
    public GoalResponse create(UUID userId, GoalRequest request) {
        LocalDate today = today();
        new FieldValidationException.Collector()
                .add(request.targetDate() != null && request.targetDate().isBefore(today), "targetDate",
                        "goals.target-date.past")
                .throwIfAny();
        Goal goal = new Goal(userId, today, clock.instant());
        apply(userId, goal, request);
        return GoalResponse.from(goals.save(goal));
    }

    @Transactional
    public GoalResponse update(UUID userId, UUID id, GoalRequest request) {
        Goal goal = goals.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
        new FieldValidationException.Collector()
                .add(request.targetDate() != null && request.targetDate().isBefore(goal.getStartDate()), "targetDate",
                        "goals.target-date.before-start")
                .throwIfAny();
        apply(userId, goal, request);
        return GoalResponse.from(goal);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        goals.delete(goals.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new));
    }

    private void apply(UUID userId, Goal goal, GoalRequest request) {
        GoalKind kind = request.kind();
        BigDecimal target = request.targetValue();
        boolean needsTarget = kind != GoalKind.CUSTOM;
        boolean wholeNumber = target == null || target.stripTrailingZeros().scale() <= 0;
        new FieldValidationException.Collector()
                .add(kind == GoalKind.BODY && request.metric() == null, "metric", "goals.metric.required")
                .add(needsTarget && target == null, "targetValue", "goals.target.required")
                .add(kind == GoalKind.TRAINING && target != null
                        && (!wholeNumber || target.compareTo(SEVEN) > 0), "targetValue", "goals.target.days")
                .add((kind == GoalKind.HABIT || kind == GoalKind.MEAL_PLAN) && target != null
                        && (!wholeNumber || target.compareTo(HUNDRED) > 0), "targetValue", "goals.target.percent")
                .add(kind == GoalKind.EXERCISE && !owns("exercise", request.exerciseId(), userId), "exerciseId",
                        "goals.exercise.required")
                .add(kind == GoalKind.HABIT && !owns("habit", request.habitId(), userId), "habitId",
                        "goals.habit.required")
                .throwIfAny();
        String notes = request.notes() == null || request.notes().isBlank() ? null : request.notes().strip();
        goal.update(request.title().strip(), kind, request.metric(), target, request.exerciseId(), request.habitId(),
                request.targetDate(), notes, clock.instant());
        goal.setStatus(request.status() == null ? GoalStatus.ACTIVE : request.status(), today(), clock.instant());
    }

    /** El ejercicio o el hábito existe y es del usuario. */
    private boolean owns(String table, UUID id, UUID userId) {
        if (id == null) {
            return false;
        }
        Integer count = jdbc.queryForObject("select count(*) from " + table + " where id = ? and user_id = ?",
                Integer.class, id, userId);
        return count != null && count > 0;
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(properties.timezone()));
    }
}
