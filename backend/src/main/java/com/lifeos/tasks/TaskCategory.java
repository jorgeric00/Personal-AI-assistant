package com.lifeos.tasks;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "task_category")
public class TaskCategory {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String color;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected TaskCategory() {
    }

    public TaskCategory(UUID userId, String name, String color, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.name = name;
        this.color = color;
        this.createdAt = now;
    }

    public void update(String name, String color) {
        this.name = name;
        this.color = color;
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
}
