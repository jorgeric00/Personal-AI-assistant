package com.lifeos.fitness;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/** Sesión de entrenamiento. Está en curso mientras no tenga fecha de fin. */
@Entity
@Table(name = "workout")
public class Workout {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "routine_id")
    private UUID routineId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private LocalDate date;

    @Column(name = "finished_at")
    private Instant finishedAt;

    private Short effort;

    private String notes;

    @OneToMany(mappedBy = "workout", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    private List<WorkoutExercise> exercises = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Workout() {
    }

    public Workout(UUID userId, UUID routineId, String name, LocalDate date, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.routineId = routineId;
        this.name = name;
        this.date = date;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(String name, LocalDate date, Integer effort, String notes, boolean finished,
            List<WorkoutExercise> items, Instant now) {
        this.name = name;
        this.date = date;
        this.effort = effort == null ? null : effort.shortValue();
        this.notes = notes;
        if (!finished) {
            this.finishedAt = null;
        } else if (this.finishedAt == null) {
            this.finishedAt = now;
        }
        replaceExercises(items);
        this.updatedAt = now;
    }

    void replaceExercises(List<WorkoutExercise> items) {
        this.exercises.clear();
        for (int i = 0; i < items.size(); i++) {
            WorkoutExercise item = items.get(i);
            item.attach(this, i);
            this.exercises.add(item);
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getRoutineId() {
        return routineId;
    }

    public String getName() {
        return name;
    }

    public LocalDate getDate() {
        return date;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public Integer getEffort() {
        return effort == null ? null : effort.intValue();
    }

    public String getNotes() {
        return notes;
    }

    public List<WorkoutExercise> getExercises() {
        return exercises;
    }
}
