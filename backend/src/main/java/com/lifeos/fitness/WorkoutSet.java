package com.lifeos.fitness;

import java.math.BigDecimal;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Serie de un ejercicio. Solo cuenta como hecha si se marcó como tal. */
@Entity
@Table(name = "workout_set")
public class WorkoutSet {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workout_exercise_id")
    private WorkoutExercise workoutExercise;

    @Column(nullable = false)
    private Short position;

    private Short reps;

    @Column(name = "weight_kg")
    private BigDecimal weightKg;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "distance_km")
    private BigDecimal distanceKm;

    private boolean done;

    protected WorkoutSet() {
    }

    public WorkoutSet(Integer reps, BigDecimal weightKg, Integer durationSeconds, BigDecimal distanceKm,
            boolean done) {
        this.id = UUID.randomUUID();
        this.reps = reps == null ? null : reps.shortValue();
        this.weightKg = weightKg;
        this.durationSeconds = durationSeconds;
        this.distanceKm = distanceKm;
        this.done = done;
    }

    void attach(WorkoutExercise workoutExercise, int position) {
        this.workoutExercise = workoutExercise;
        this.position = (short) position;
    }

    public UUID getId() {
        return id;
    }

    public Integer getReps() {
        return reps == null ? null : reps.intValue();
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public Integer getDurationSeconds() {
        return durationSeconds;
    }

    public BigDecimal getDistanceKm() {
        return distanceKm;
    }

    public boolean isDone() {
        return done;
    }
}
