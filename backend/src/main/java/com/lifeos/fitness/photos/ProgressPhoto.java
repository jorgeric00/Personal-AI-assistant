package com.lifeos.fitness.photos;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Metadatos de una foto de progreso. Los bytes viven en progress_photo_data. */
@Entity
@Table(name = "progress_photo")
public class ProgressPhoto {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "taken_on", nullable = false)
    private LocalDate takenOn;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PhotoPose pose;

    private String notes;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProgressPhoto() {
    }

    public ProgressPhoto(UUID userId, int width, int height, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.width = width;
        this.height = height;
        this.createdAt = now;
    }

    public void update(LocalDate takenOn, PhotoPose pose, String notes, Instant now) {
        this.takenOn = takenOn;
        this.pose = pose;
        this.notes = notes;
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public LocalDate getTakenOn() {
        return takenOn;
    }

    public PhotoPose getPose() {
        return pose;
    }

    public String getNotes() {
        return notes;
    }

    public int getWidth() {
        return width;
    }

    public int getHeight() {
        return height;
    }
}
