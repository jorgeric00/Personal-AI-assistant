package com.lifeos.tasks;

import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "task_completion")
public class TaskCompletion {

    @Embeddable
    public record Key(@Column(name = "task_id") UUID taskId, @Column(name = "occurrence_date") LocalDate occurrenceDate)
            implements Serializable {
    }

    @EmbeddedId
    private Key key;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    protected TaskCompletion() {
    }

    public TaskCompletion(UUID taskId, LocalDate occurrenceDate, Instant completedAt) {
        this.key = new Key(taskId, occurrenceDate);
        this.completedAt = completedAt;
    }

    public UUID taskId() {
        return key.taskId();
    }

    public LocalDate occurrenceDate() {
        return key.occurrenceDate();
    }

    public Instant completedAt() {
        return completedAt;
    }
}
