-- Avisos de la agenda (minutos antes de que empiece una actividad con hora) y de los hábitos (a una hora del día
-- en que tocan, si aún no están marcados). Como en las tareas, cada aparición se avisa una sola vez.
ALTER TABLE activity ADD COLUMN reminder_minutes_before INT
    CHECK (reminder_minutes_before BETWEEN 0 AND 10080);
ALTER TABLE activity ADD CONSTRAINT activity_reminder_needs_time
    CHECK (reminder_minutes_before IS NULL OR start_time IS NOT NULL);

CREATE TABLE activity_notification (
    activity_id     UUID        NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
    occurrence_date DATE        NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (activity_id, occurrence_date)
);

ALTER TABLE habit ADD COLUMN reminder_time TIME;

CREATE TABLE habit_notification (
    habit_id UUID        NOT NULL REFERENCES habit (id) ON DELETE CASCADE,
    date     DATE        NOT NULL,
    sent_at  TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (habit_id, date)
);
