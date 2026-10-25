package com.lifeos.habits;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Hábito con su frecuencia esperada. Los días cumplidos están en habit_check. */
@Entity
@Table(name = "habit")
public class Habit {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String color;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private HabitFrequency frequency;

    private String weekdays;

    @Column(name = "times_per_week")
    private Integer timesPerWeek;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private boolean archived;

    /** Hora del aviso en los días que toca; null si no se avisa. */
    @Column(name = "reminder_time")
    private LocalTime reminderTime;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Habit() {
    }

    public Habit(UUID userId, LocalDate startDate, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.startDate = startDate;
        this.createdAt = now;
    }

    /** DAILY guarda los días (vacío = todos) y WEEKLY las veces por semana; lo que no aplica se descarta. */
    public void update(String name, String color, HabitFrequency frequency, Set<DayOfWeek> weekdays,
            Integer timesPerWeek, boolean archived, LocalTime reminderTime, Instant now) {
        this.name = name;
        this.color = color;
        this.frequency = frequency;
        boolean daily = frequency == HabitFrequency.DAILY;
        this.weekdays = !daily || weekdays == null || weekdays.isEmpty() || weekdays.size() == 7 ? null
                : EnumSet.copyOf(weekdays).stream().map(DayOfWeek::name).collect(Collectors.joining(","));
        this.timesPerWeek = daily ? null : timesPerWeek;
        this.archived = archived;
        this.reminderTime = reminderTime == null ? null : reminderTime.withSecond(0).withNano(0);
        this.updatedAt = now;
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

    public HabitFrequency getFrequency() {
        return frequency;
    }

    public LocalTime getReminderTime() {
        return reminderTime;
    }

    /** Días en que toca (solo DAILY); vacío = todos. */
    public Set<DayOfWeek> getWeekdays() {
        if (weekdays == null || weekdays.isBlank()) {
            return EnumSet.noneOf(DayOfWeek.class);
        }
        return Arrays.stream(weekdays.split(",")).map(DayOfWeek::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(DayOfWeek.class)));
    }

    public Integer getTimesPerWeek() {
        return timesPerWeek;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public boolean isArchived() {
        return archived;
    }
}
