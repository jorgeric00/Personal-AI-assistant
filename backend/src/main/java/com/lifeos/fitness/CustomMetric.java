package com.lifeos.fitness;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Indicador de evolución definido por el usuario: nombre, unidad y cuántos decimales admite. */
@Entity
@Table(name = "custom_metric")
public class CustomMetric {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String name;

    private String unit;

    @Column(nullable = false)
    private short decimals;

    @Column(nullable = false)
    private boolean archived;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CustomMetric() {
    }

    public CustomMetric(UUID userId, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.createdAt = now;
    }

    void update(String name, String unit, int decimals, boolean archived, Instant now) {
        this.name = name;
        this.unit = unit;
        this.decimals = (short) decimals;
        this.archived = archived;
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getUnit() {
        return unit;
    }

    public int getDecimals() {
        return decimals;
    }

    public boolean isArchived() {
        return archived;
    }
}
