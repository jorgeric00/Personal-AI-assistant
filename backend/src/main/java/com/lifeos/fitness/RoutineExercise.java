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

/** Ejercicio dentro de una rutina con su objetivo (series, repeticiones, peso, tiempo o distancia y descanso). */
@Entity
@Table(name = "routine_exercise")
public class RoutineExercise {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "routine_id")
    private Routine routine;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id")
    private Exercise exercise;

    @Column(nullable = false)
    private Short position;

    @Column(nullable = false)
    private Short sets;

    @Column(name = "reps_min")
    private Short repsMin;

    @Column(name = "reps_max")
    private Short repsMax;

    @Column(name = "weight_kg")
    private BigDecimal weightKg;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "distance_km")
    private BigDecimal distanceKm;

    @Column(name = "rest_seconds")
    private Short restSeconds;

    private String notes;

    protected RoutineExercise() {
    }

    public RoutineExercise(Exercise exercise, int sets, Integer repsMin, Integer repsMax, BigDecimal weightKg,
            Integer durationSeconds, BigDecimal distanceKm, Integer restSeconds, String notes) {
        this.id = UUID.randomUUID();
        this.exercise = exercise;
        this.sets = (short) sets;
        this.repsMin = toShort(repsMin);
        this.repsMax = toShort(repsMax);
        this.weightKg = weightKg;
        this.durationSeconds = durationSeconds;
        this.distanceKm = distanceKm;
        this.restSeconds = toShort(restSeconds);
        this.notes = notes;
    }

    private static Short toShort(Integer value) {
        return value == null ? null : value.shortValue();
    }

    private static Integer toInteger(Short value) {
        return value == null ? null : value.intValue();
    }

    void attach(Routine routine, int position) {
        this.routine = routine;
        this.position = (short) position;
    }

    public UUID getId() {
        return id;
    }

    public Exercise getExercise() {
        return exercise;
    }

    public int getSets() {
        return sets;
    }

    public Integer getRepsMin() {
        return toInteger(repsMin);
    }

    public Integer getRepsMax() {
        return toInteger(repsMax);
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

    public Integer getRestSeconds() {
        return toInteger(restSeconds);
    }

    public String getNotes() {
        return notes;
    }
}
