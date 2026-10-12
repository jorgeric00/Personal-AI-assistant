package com.lifeos.nutrition;

import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Agua bebida y notas de cada comida de un día. */
@Entity
@Table(name = "nutrition_day")
public class NutritionDay {

    @Embeddable
    public record Key(@Column(name = "user_id") UUID userId, @Column(name = "date") LocalDate date)
            implements Serializable {
    }

    @EmbeddedId
    private Key key;

    @Column(name = "water_ml", nullable = false)
    private int waterMl;

    @Column(name = "breakfast_note")
    private String breakfastNote;

    @Column(name = "lunch_note")
    private String lunchNote;

    @Column(name = "dinner_note")
    private String dinnerNote;

    @Column(name = "snack_note")
    private String snackNote;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected NutritionDay() {
    }

    public NutritionDay(UUID userId, LocalDate date, Instant now) {
        this.key = new Key(userId, date);
        this.updatedAt = now;
    }

    public LocalDate getDate() {
        return key.date();
    }

    public int getWaterMl() {
        return waterMl;
    }

    public void setWaterMl(int waterMl, Instant now) {
        this.waterMl = waterMl;
        this.updatedAt = now;
    }

    public String note(Meal meal) {
        return switch (meal) {
            case BREAKFAST -> breakfastNote;
            case LUNCH -> lunchNote;
            case DINNER -> dinnerNote;
            case SNACK -> snackNote;
        };
    }

    public void setNote(Meal meal, String note, Instant now) {
        switch (meal) {
            case BREAKFAST -> breakfastNote = note;
            case LUNCH -> lunchNote = note;
            case DINNER -> dinnerNote = note;
            case SNACK -> snackNote = note;
        }
        this.updatedAt = now;
    }
}
