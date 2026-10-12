package com.lifeos.nutrition;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Objetivos diarios que fija el usuario. La app no los calcula ni los propone. */
@Entity
@Table(name = "nutrition_target")
public class NutritionTarget {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    private Integer calories;

    @Column(name = "protein_g")
    private BigDecimal proteinG;

    @Column(name = "carbs_g")
    private BigDecimal carbsG;

    @Column(name = "fat_g")
    private BigDecimal fatG;

    @Column(name = "water_ml")
    private Integer waterMl;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected NutritionTarget() {
    }

    public NutritionTarget(UUID userId) {
        this.userId = userId;
    }

    public void update(Integer calories, BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG, Integer waterMl,
            Instant now) {
        this.calories = calories;
        this.proteinG = proteinG;
        this.carbsG = carbsG;
        this.fatG = fatG;
        this.waterMl = waterMl;
        this.updatedAt = now;
    }

    public Integer getCalories() {
        return calories;
    }

    public BigDecimal getProteinG() {
        return proteinG;
    }

    public BigDecimal getCarbsG() {
        return carbsG;
    }

    public BigDecimal getFatG() {
        return fatG;
    }

    public Integer getWaterMl() {
        return waterMl;
    }
}
