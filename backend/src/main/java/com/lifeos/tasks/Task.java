package com.lifeos.tasks;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
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

@Entity
@Table(name = "task")
public class Task {

    public enum Kind {
        TASK, REMINDER
    }

    public enum Priority {
        LOW, MEDIUM, HIGH
    }

    public enum Status {
        PENDING, POSTPONED, DONE
    }

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Kind kind;

    @Column(nullable = false)
    private String title;

    private String description;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "due_time")
    private LocalTime dueTime;

    private LocalDate deadline;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Priority priority;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private TaskCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Enumerated(EnumType.STRING)
    @Column(name = "recurrence_frequency")
    private Recurrence.Frequency recurrenceFrequency;

    @Column(name = "recurrence_interval")
    private Integer recurrenceInterval;

    @Column(name = "recurrence_weekdays")
    private String recurrenceWeekdays;

    @Column(name = "recurrence_anchor")
    private LocalDate recurrenceAnchor;

    @Column(name = "recurrence_until")
    private LocalDate recurrenceUntil;

    @Column(name = "reminder_minutes_before")
    private Integer reminderMinutesBefore;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Task() {
    }

    public Task(UUID userId, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.status = Status.PENDING;
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** Sustituye los datos editables. La regla de repetición se ancla en la fecha indicada. */
    public void update(Kind kind, String title, String description, LocalDate dueDate, LocalTime dueTime,
            LocalDate deadline, Priority priority, TaskCategory category, Recurrence recurrence,
            Integer reminderMinutesBefore, Instant now) {
        this.kind = kind;
        this.title = title;
        this.description = description;
        this.dueDate = dueDate;
        this.dueTime = dueTime;
        this.deadline = deadline;
        this.priority = priority;
        this.category = category;
        setRecurrence(recurrence);
        this.reminderMinutesBefore = reminderMinutesBefore;
        this.updatedAt = now;
    }

    private void setRecurrence(Recurrence recurrence) {
        if (recurrence == null) {
            recurrenceFrequency = null;
            recurrenceInterval = null;
            recurrenceWeekdays = null;
            recurrenceAnchor = null;
            recurrenceUntil = null;
            return;
        }
        recurrenceFrequency = recurrence.frequency();
        recurrenceInterval = recurrence.interval();
        recurrenceWeekdays = recurrence.weekdays().isEmpty() ? null : recurrence.weekdaysAsString();
        recurrenceAnchor = recurrence.anchor();
        recurrenceUntil = recurrence.until();
    }

    public Recurrence recurrence() {
        if (recurrenceFrequency == null) {
            return null;
        }
        return new Recurrence(recurrenceFrequency, recurrenceInterval, Recurrence.parseWeekdays(recurrenceWeekdays),
                recurrenceAnchor, recurrenceUntil);
    }

    public boolean isRecurring() {
        return recurrenceFrequency != null;
    }

    public void markDone(Instant now) {
        status = Status.DONE;
        completedAt = now;
        updatedAt = now;
    }

    public void reopen(LocalDate dueDate, Instant now) {
        this.status = Status.PENDING;
        this.dueDate = dueDate;
        this.completedAt = null;
        this.updatedAt = now;
    }

    /** Pasa a la siguiente aparición de una tarea recurrente. */
    public void advanceTo(LocalDate nextDate, Instant now) {
        this.dueDate = nextDate;
        this.status = Status.PENDING;
        this.updatedAt = now;
    }

    public void postpone(LocalDate newDate, Instant now) {
        this.dueDate = newDate;
        this.status = Status.POSTPONED;
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public Kind getKind() {
        return kind;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public LocalTime getDueTime() {
        return dueTime;
    }

    public LocalDate getDeadline() {
        return deadline;
    }

    public Priority getPriority() {
        return priority;
    }

    public TaskCategory getCategory() {
        return category;
    }

    public Status getStatus() {
        return status;
    }

    public Integer getReminderMinutesBefore() {
        return reminderMinutesBefore;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
