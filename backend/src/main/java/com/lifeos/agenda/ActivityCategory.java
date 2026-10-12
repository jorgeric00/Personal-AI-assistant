package com.lifeos.agenda;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Categoría de actividad (gimnasio, amigos, viajes…). Se archiva en lugar de borrarse si tiene actividades. */
@Entity
@Table(name = "activity_category")
public class ActivityCategory {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String color;

    private boolean archived;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ActivityCategory() {
    }

    public ActivityCategory(UUID userId, String name, String color, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.name = name;
        this.color = color;
        this.createdAt = now;
    }

    public void update(String name, String color, boolean archived) {
        this.name = name;
        this.color = color;
        this.archived = archived;
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

    public String getColor() {
        return color;
    }

    public boolean isArchived() {
        return archived;
    }
}
