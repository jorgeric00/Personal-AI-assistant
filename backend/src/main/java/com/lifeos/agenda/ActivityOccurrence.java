package com.lifeos.agenda;

import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** Estado guardado de una aparición concreta de una actividad. */
@Entity
@Table(name = "activity_occurrence")
public class ActivityOccurrence {

    @Embeddable
    public record Key(@Column(name = "activity_id") UUID activityId,
            @Column(name = "occurrence_date") LocalDate occurrenceDate) implements Serializable {
    }

    @EmbeddedId
    private Key key;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ActivityStatus status;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ActivityOccurrence() {
    }

    public ActivityOccurrence(UUID activityId, LocalDate date, ActivityStatus status, Instant now) {
        this.key = new Key(activityId, date);
        this.status = status;
        this.updatedAt = now;
    }

    public void setStatus(ActivityStatus status, Instant now) {
        this.status = status;
        this.updatedAt = now;
    }

    public UUID getActivityId() {
        return key.activityId();
    }

    public LocalDate getDate() {
        return key.occurrenceDate();
    }

    public ActivityStatus getStatus() {
        return status;
    }
}
