package com.lifeos.nutrition;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Comida planificada para un día. No es lo comido: pasa al diario solo al registrarla. */
@Entity
@Table(name = "planned_meal")
public class PlannedMeal {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Meal meal;

    @Column(nullable = false)
    private String title;

    @Column(name = "saved_meal_id")
    private UUID savedMealId;

    private String notes;

    @Column(name = "prep_date")
    private LocalDate prepDate;

    @Column(nullable = false)
    private boolean prepared;

    @Column(name = "logged_at")
    private Instant loggedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PlannedMeal() {
    }

    public PlannedMeal(UUID userId, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(LocalDate date, Meal meal, String title, UUID savedMealId, String notes, LocalDate prepDate,
            Instant now) {
        this.date = date;
        this.meal = meal;
        this.title = title;
        this.savedMealId = savedMealId;
        this.notes = notes;
        if (prepDate == null) {
            this.prepared = false;
        }
        this.prepDate = prepDate;
        this.updatedAt = now;
    }

    public void setPrepared(boolean prepared, Instant now) {
        this.prepared = prepared;
        this.updatedAt = now;
    }

    public void markLogged(Instant now) {
        this.loggedAt = now;
        this.updatedAt = now;
    }

    /** Copia para otra fecha, sin preparar ni registrar. */
    public PlannedMeal copyTo(LocalDate newDate, LocalDate newPrepDate, Instant now) {
        PlannedMeal copy = new PlannedMeal(userId, now);
        copy.update(newDate, meal, title, savedMealId, notes, newPrepDate, now);
        return copy;
    }

    public UUID getId() {
        return id;
    }

    public LocalDate getDate() {
        return date;
    }

    public Meal getMeal() {
        return meal;
    }

    public String getTitle() {
        return title;
    }

    public UUID getSavedMealId() {
        return savedMealId;
    }

    public String getNotes() {
        return notes;
    }

    public LocalDate getPrepDate() {
        return prepDate;
    }

    public boolean isPrepared() {
        return prepared;
    }

    public Instant getLoggedAt() {
        return loggedAt;
    }
}
