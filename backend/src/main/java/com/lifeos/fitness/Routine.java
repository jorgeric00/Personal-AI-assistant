package com.lifeos.fitness;

import java.time.DayOfWeek;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/** Rutina de entrenamiento: ejercicios en orden y, si se quiere, los días de la semana en que toca. */
@Entity
@Table(name = "routine")
public class Routine {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String name;

    private String notes;

    /** Días separados por comas (MONDAY,THURSDAY); null si no tiene días fijos. */
    private String weekdays;

    @OneToMany(mappedBy = "routine", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    private List<RoutineExercise> exercises = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Routine() {
    }

    public Routine(UUID userId, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.createdAt = now;
    }

    public void update(String name, String notes, Set<DayOfWeek> weekdays, List<RoutineExercise> items, Instant now) {
        this.name = name;
        this.notes = notes;
        this.weekdays = weekdays == null || weekdays.isEmpty() ? null
                : EnumSet.copyOf(weekdays).stream().map(DayOfWeek::name).collect(Collectors.joining(","));
        this.exercises.clear();
        for (int i = 0; i < items.size(); i++) {
            RoutineExercise item = items.get(i);
            item.attach(this, i);
            this.exercises.add(item);
        }
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public String getNotes() {
        return notes;
    }

    public Set<DayOfWeek> getWeekdays() {
        if (weekdays == null || weekdays.isBlank()) {
            return EnumSet.noneOf(DayOfWeek.class);
        }
        return Arrays.stream(weekdays.split(",")).map(DayOfWeek::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(DayOfWeek.class)));
    }

    public List<RoutineExercise> getExercises() {
        return exercises;
    }
}
