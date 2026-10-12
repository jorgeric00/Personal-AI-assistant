package com.lifeos.fitness;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Ejercicio del catálogo del usuario. */
@Entity
@Table(name = "exercise")
public class Exercise {

    public enum MuscleGroup {
        CHEST, BACK, LEGS, SHOULDERS, ARMS, CORE, FULL_BODY, CARDIO
    }

    /** Qué se anota al hacerlo: peso y repeticiones, solo repeticiones, tiempo, o tiempo y distancia. */
    public enum Type {
        STRENGTH, BODYWEIGHT, TIMED, CARDIO
    }

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "muscle_group", nullable = false)
    private MuscleGroup muscleGroup;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    private String equipment;

    private String instructions;

    private String safety;

    private boolean archived;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Exercise() {
    }

    public Exercise(UUID userId, String name, MuscleGroup muscleGroup, Type type, String equipment,
            String instructions, String safety, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.createdAt = now;
        update(name, muscleGroup, type, equipment, instructions, safety, false, now);
    }

    public void update(String name, MuscleGroup muscleGroup, Type type, String equipment, String instructions,
            String safety, boolean archived, Instant now) {
        this.name = name;
        this.muscleGroup = muscleGroup;
        this.type = type;
        this.equipment = equipment;
        this.instructions = instructions;
        this.safety = safety;
        this.archived = archived;
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

    public MuscleGroup getMuscleGroup() {
        return muscleGroup;
    }

    public Type getType() {
        return type;
    }

    public String getEquipment() {
        return equipment;
    }

    public String getInstructions() {
        return instructions;
    }

    public String getSafety() {
        return safety;
    }

    public boolean isArchived() {
        return archived;
    }
}
