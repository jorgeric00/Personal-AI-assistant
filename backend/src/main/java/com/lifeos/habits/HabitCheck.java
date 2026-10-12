package com.lifeos.habits;

import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Un día en que se cumplió un hábito. */
@Entity
@Table(name = "habit_check")
public class HabitCheck {

    @Embeddable
    public record Key(@Column(name = "habit_id") UUID habitId, @Column(name = "date") LocalDate date)
            implements Serializable {
    }

    @EmbeddedId
    private Key key;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected HabitCheck() {
    }

    public HabitCheck(UUID habitId, LocalDate date, Instant now) {
        this.key = new Key(habitId, date);
        this.createdAt = now;
    }

    public UUID getHabitId() {
        return key.habitId();
    }

    public LocalDate getDate() {
        return key.date();
    }
}
