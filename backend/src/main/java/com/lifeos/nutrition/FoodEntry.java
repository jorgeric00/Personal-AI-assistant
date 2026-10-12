package com.lifeos.nutrition;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Alimento anotado en una comida de un día. */
@Entity
@Table(name = "food_entry")
public class FoodEntry {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Meal meal;

    @Embedded
    private Food food;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected FoodEntry() {
    }

    public FoodEntry(UUID userId, LocalDate date, Meal meal, Food food, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.createdAt = now;
        update(date, meal, food, now);
    }

    public void update(LocalDate date, Meal meal, Food food, Instant now) {
        this.date = date;
        this.meal = meal;
        this.food = food;
        this.updatedAt = now;
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

    public Food getFood() {
        return food;
    }
}
