package com.lifeos.fitness;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.hibernate.annotations.BatchSize;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.Table;

/** Registro de evolución física de un día: solo los valores que se quisieron anotar. */
@Entity
@Table(name = "body_measurement")
public class BodyMeasurement {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private LocalDate date;

    @Column(name = "weight_kg")
    private BigDecimal weightKg;

    @Column(name = "body_fat_pct")
    private BigDecimal bodyFatPct;

    @Column(name = "waist_cm")
    private BigDecimal waistCm;

    @Column(name = "chest_cm")
    private BigDecimal chestCm;

    @Column(name = "hip_cm")
    private BigDecimal hipCm;

    @Column(name = "arm_cm")
    private BigDecimal armCm;

    @Column(name = "thigh_cm")
    private BigDecimal thighCm;

    private String notes;

    /** Valores de los indicadores propios, por id de indicador. */
    @ElementCollection
    @CollectionTable(name = "custom_metric_value", joinColumns = @JoinColumn(name = "measurement_id"))
    @MapKeyColumn(name = "metric_id")
    @Column(name = "value", nullable = false)
    @BatchSize(size = 100)
    private Map<UUID, BigDecimal> custom = new HashMap<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected BodyMeasurement() {
    }

    public BodyMeasurement(UUID userId, FitnessDtos.MeasurementRequest request, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.createdAt = now;
        update(request, now);
    }

    void update(FitnessDtos.MeasurementRequest request, Instant now) {
        this.date = request.date();
        this.weightKg = request.weightKg();
        this.bodyFatPct = request.bodyFatPct();
        this.waistCm = request.waistCm();
        this.chestCm = request.chestCm();
        this.hipCm = request.hipCm();
        this.armCm = request.armCm();
        this.thighCm = request.thighCm();
        this.notes = FitnessDtos.blankToNull(request.notes());
        this.custom.clear();
        this.custom.putAll(request.customValues());
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public LocalDate getDate() {
        return date;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public BigDecimal getBodyFatPct() {
        return bodyFatPct;
    }

    public BigDecimal getWaistCm() {
        return waistCm;
    }

    public BigDecimal getChestCm() {
        return chestCm;
    }

    public BigDecimal getHipCm() {
        return hipCm;
    }

    public BigDecimal getArmCm() {
        return armCm;
    }

    public BigDecimal getThighCm() {
        return thighCm;
    }

    public String getNotes() {
        return notes;
    }

    public Map<UUID, BigDecimal> getCustom() {
        return custom;
    }
}
