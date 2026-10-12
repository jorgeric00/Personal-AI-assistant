package com.lifeos.fitness;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/** Ejercicio de un entrenamiento con el objetivo que tenía en la rutina y las series hechas. */
@Entity
@Table(name = "workout_exercise")
public class WorkoutExercise {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workout_id")
    private Workout workout;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id")
    private Exercise exercise;

    @Column(nullable = false)
    private Short position;

    @Column(name = "target_sets")
    private Short targetSets;

    @Column(name = "target_reps_min")
    private Short targetRepsMin;

    @Column(name = "target_reps_max")
    private Short targetRepsMax;

    @Column(name = "target_weight_kg")
    private BigDecimal targetWeightKg;

    @Column(name = "target_duration_seconds")
    private Integer targetDurationSeconds;

    @Column(name = "target_distance_km")
    private BigDecimal targetDistanceKm;

    @Column(name = "rest_seconds")
    private Short restSeconds;

    private String notes;

    @OneToMany(mappedBy = "workoutExercise", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    private List<WorkoutSet> sets = new ArrayList<>();

    protected WorkoutExercise() {
    }

    public WorkoutExercise(Exercise exercise, Integer targetSets, Integer targetRepsMin, Integer targetRepsMax,
            BigDecimal targetWeightKg, Integer targetDurationSeconds, BigDecimal targetDistanceKm,
            Integer restSeconds, String notes, List<WorkoutSet> sets) {
        this.id = UUID.randomUUID();
        this.exercise = exercise;
        this.targetSets = toShort(targetSets);
        this.targetRepsMin = toShort(targetRepsMin);
        this.targetRepsMax = toShort(targetRepsMax);
        this.targetWeightKg = targetWeightKg;
        this.targetDurationSeconds = targetDurationSeconds;
        this.targetDistanceKm = targetDistanceKm;
        this.restSeconds = toShort(restSeconds);
        this.notes = notes;
        for (int i = 0; i < sets.size(); i++) {
            WorkoutSet set = sets.get(i);
            set.attach(this, i);
            this.sets.add(set);
        }
    }

    /** Copia el ejercicio de la rutina con su objetivo y tantas series vacías como indique. */
    static WorkoutExercise fromRoutine(RoutineExercise item) {
        List<WorkoutSet> sets = new ArrayList<>();
        for (int i = 0; i < item.getSets(); i++) {
            sets.add(new WorkoutSet(null, null, null, null, false));
        }
        return new WorkoutExercise(item.getExercise(), item.getSets(), item.getRepsMin(), item.getRepsMax(),
                item.getWeightKg(), item.getDurationSeconds(), item.getDistanceKm(), item.getRestSeconds(),
                item.getNotes(), sets);
    }

    private static Short toShort(Integer value) {
        return value == null ? null : value.shortValue();
    }

    private static Integer toInteger(Short value) {
        return value == null ? null : value.intValue();
    }

    void attach(Workout workout, int position) {
        this.workout = workout;
        this.position = (short) position;
    }

    public UUID getId() {
        return id;
    }

    public Workout getWorkout() {
        return workout;
    }

    public Exercise getExercise() {
        return exercise;
    }

    public Integer getTargetSets() {
        return toInteger(targetSets);
    }

    public Integer getTargetRepsMin() {
        return toInteger(targetRepsMin);
    }

    public Integer getTargetRepsMax() {
        return toInteger(targetRepsMax);
    }

    public BigDecimal getTargetWeightKg() {
        return targetWeightKg;
    }

    public Integer getTargetDurationSeconds() {
        return targetDurationSeconds;
    }

    public BigDecimal getTargetDistanceKm() {
        return targetDistanceKm;
    }

    public Integer getRestSeconds() {
        return toInteger(restSeconds);
    }

    public String getNotes() {
        return notes;
    }

    public List<WorkoutSet> getSets() {
        return sets;
    }
}
