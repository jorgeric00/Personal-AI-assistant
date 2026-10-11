package com.lifeos.fitness;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Perfil físico del usuario. Todos los datos son opcionales. */
@Entity
@Table(name = "fitness_profile")
public class FitnessProfile {

    public enum Goal {
        LOSE_FAT, GAIN_MUSCLE, MAINTAIN, ENDURANCE, CUSTOM
    }

    public enum ActivityLevel {
        SEDENTARY, LIGHT, MODERATE, ACTIVE, VERY_ACTIVE
    }

    public enum Experience {
        BEGINNER, INTERMEDIATE, ADVANCED
    }

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "height_cm")
    private BigDecimal heightCm;

    @Column(name = "start_weight_kg")
    private BigDecimal startWeightKg;

    @Enumerated(EnumType.STRING)
    private Goal goal;

    @Column(name = "goal_details")
    private String goalDetails;

    @Enumerated(EnumType.STRING)
    @Column(name = "activity_level")
    private ActivityLevel activityLevel;

    @Enumerated(EnumType.STRING)
    private Experience experience;

    @Column(name = "days_per_week")
    private Short daysPerWeek;

    @Column(name = "minutes_per_session")
    private Short minutesPerSession;

    @Column(name = "food_preferences")
    private String foodPreferences;

    @Column(name = "food_avoid")
    private String foodAvoid;

    private String equipment;

    private String notes;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected FitnessProfile() {
    }

    public FitnessProfile(UUID userId) {
        this.userId = userId;
    }

    void update(FitnessDtos.ProfileRequest request, Instant now) {
        this.birthDate = request.birthDate();
        this.heightCm = request.heightCm();
        this.startWeightKg = request.startWeightKg();
        this.goal = request.goal();
        this.goalDetails = FitnessDtos.blankToNull(request.goalDetails());
        this.activityLevel = request.activityLevel();
        this.experience = request.experience();
        this.daysPerWeek = request.daysPerWeek() == null ? null : request.daysPerWeek().shortValue();
        this.minutesPerSession = request.minutesPerSession() == null ? null : request.minutesPerSession().shortValue();
        this.foodPreferences = FitnessDtos.blankToNull(request.foodPreferences());
        this.foodAvoid = FitnessDtos.blankToNull(request.foodAvoid());
        this.equipment = FitnessDtos.blankToNull(request.equipment());
        this.notes = FitnessDtos.blankToNull(request.notes());
        this.updatedAt = now;
    }

    public UUID getUserId() {
        return userId;
    }

    public LocalDate getBirthDate() {
        return birthDate;
    }

    public BigDecimal getHeightCm() {
        return heightCm;
    }

    public BigDecimal getStartWeightKg() {
        return startWeightKg;
    }

    public Goal getGoal() {
        return goal;
    }

    public String getGoalDetails() {
        return goalDetails;
    }

    public ActivityLevel getActivityLevel() {
        return activityLevel;
    }

    public Experience getExperience() {
        return experience;
    }

    public Short getDaysPerWeek() {
        return daysPerWeek;
    }

    public Short getMinutesPerSession() {
        return minutesPerSession;
    }

    public String getFoodPreferences() {
        return foodPreferences;
    }

    public String getFoodAvoid() {
        return foodAvoid;
    }

    public String getEquipment() {
        return equipment;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
