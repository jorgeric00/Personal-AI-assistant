package com.lifeos.goals;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Objetivo personal. Guarda la meta; el progreso se calcula con los registros. */
@Entity
@Table(name = "goal")
public class Goal {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GoalKind kind;

    @Enumerated(EnumType.STRING)
    private BodyMetric metric;

    @Column(name = "target_value")
    private BigDecimal targetValue;

    @Column(name = "exercise_id")
    private UUID exerciseId;

    @Column(name = "habit_id")
    private UUID habitId;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "target_date")
    private LocalDate targetDate;

    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GoalStatus status;

    @Column(name = "achieved_on")
    private LocalDate achievedOn;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Goal() {
    }

    public Goal(UUID userId, LocalDate startDate, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.startDate = startDate;
        this.status = GoalStatus.ACTIVE;
        this.createdAt = now;
    }

    /** Solo se guarda lo que el tipo usa; lo demás se descarta. */
    public void update(String title, GoalKind kind, BodyMetric metric, BigDecimal targetValue, UUID exerciseId,
            UUID habitId, LocalDate targetDate, String notes, Instant now) {
        this.title = title;
        this.kind = kind;
        this.metric = kind == GoalKind.BODY ? metric : null;
        this.targetValue = kind == GoalKind.CUSTOM ? null : targetValue;
        this.exerciseId = kind == GoalKind.EXERCISE ? exerciseId : null;
        this.habitId = kind == GoalKind.HABIT ? habitId : null;
        this.targetDate = targetDate;
        this.notes = notes;
        this.updatedAt = now;
    }

    public void setStatus(GoalStatus status, LocalDate today, Instant now) {
        if (status != this.status) {
            this.achievedOn = status == GoalStatus.ACHIEVED ? today : null;
        }
        this.status = status;
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public GoalKind getKind() {
        return kind;
    }

    public BodyMetric getMetric() {
        return metric;
    }

    public BigDecimal getTargetValue() {
        return targetValue;
    }

    public UUID getExerciseId() {
        return exerciseId;
    }

    public UUID getHabitId() {
        return habitId;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getTargetDate() {
        return targetDate;
    }

    public String getNotes() {
        return notes;
    }

    public GoalStatus getStatus() {
        return status;
    }

    public LocalDate getAchievedOn() {
        return achievedOn;
    }
}
