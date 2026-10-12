package com.lifeos.agenda;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import com.lifeos.tasks.Recurrence;

/**
 * Actividad de la agenda. Si se repite, la regla se ancla en la fecha de inicio y cada aparición dura lo mismo que
 * la primera. Sin horas, ocupa días completos.
 */
@Entity
@Table(name = "activity")
public class Activity {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String title;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id")
    private ActivityCategory category;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "end_time")
    private LocalTime endTime;

    private String description;

    private String location;

    @Enumerated(EnumType.STRING)
    @Column(name = "recurrence_frequency")
    private Recurrence.Frequency recurrenceFrequency;

    @Column(name = "recurrence_interval")
    private Integer recurrenceInterval;

    @Column(name = "recurrence_weekdays")
    private String recurrenceWeekdays;

    @Column(name = "recurrence_until")
    private LocalDate recurrenceUntil;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Activity() {
    }

    public Activity(UUID userId, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.createdAt = now;
    }

    public void update(String title, ActivityCategory category, LocalDate startDate, LocalTime startTime,
            LocalDate endDate, LocalTime endTime, String description, String location, Recurrence recurrence,
            Instant now) {
        this.title = title;
        this.category = category;
        this.startDate = startDate;
        this.startTime = startTime;
        this.endDate = endDate;
        this.endTime = endTime;
        this.description = description;
        this.location = location;
        this.recurrenceFrequency = recurrence == null ? null : recurrence.frequency();
        this.recurrenceInterval = recurrence == null ? null : recurrence.interval();
        this.recurrenceWeekdays = recurrence == null || recurrence.weekdays().isEmpty() ? null
                : recurrence.weekdaysAsString();
        this.recurrenceUntil = recurrence == null ? null : recurrence.until();
        this.updatedAt = now;
    }

    public Recurrence recurrence() {
        return recurrenceFrequency == null ? null
                : new Recurrence(recurrenceFrequency, recurrenceInterval,
                        Recurrence.parseWeekdays(recurrenceWeekdays), startDate, recurrenceUntil);
    }

    /** Días que ocupa cada aparición más allá del primero (0 si empieza y acaba el mismo día). */
    public long extraDays() {
        return ChronoUnit.DAYS.between(startDate, endDate);
    }

    /** Fechas de inicio de las apariciones que tocan algún día entre {@code from} y {@code to}. */
    public List<LocalDate> occurrencesTouching(LocalDate from, LocalDate to) {
        LocalDate earliestStart = from.minusDays(extraDays());
        Recurrence recurrence = recurrence();
        if (recurrence == null) {
            return startDate.isAfter(to) || startDate.isBefore(earliestStart) ? List.of() : List.of(startDate);
        }
        return recurrence.occurrencesBetween(startDate, earliestStart, to);
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getTitle() {
        return title;
    }

    public ActivityCategory getCategory() {
        return category;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public String getDescription() {
        return description;
    }

    public String getLocation() {
        return location;
    }
}
