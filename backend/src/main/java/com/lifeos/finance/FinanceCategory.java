package com.lifeos.finance;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "finance_category")
public class FinanceCategory {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MovementKind kind;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String color;

    private boolean archived;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected FinanceCategory() {
    }

    public FinanceCategory(UUID userId, MovementKind kind, String name, String color, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.kind = kind;
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

    public MovementKind getKind() {
        return kind;
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
