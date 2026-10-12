-- Objetivos personales con fecha objetivo opcional. El progreso no se guarda: la app lo calcula a partir de los
-- registros reales (medidas, entrenamientos, récords, hábitos, plan de comidas). Los CUSTOM se marcan a mano.
CREATE TABLE goal (
    id           UUID PRIMARY KEY,
    user_id      UUID          NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    title        VARCHAR(120)  NOT NULL,
    kind         VARCHAR(12)   NOT NULL CHECK (kind IN ('BODY', 'TRAINING', 'EXERCISE', 'HABIT', 'MEAL_PLAN', 'CUSTOM')),
    metric       VARCHAR(14) CHECK (metric IN ('WEIGHT_KG', 'BODY_FAT_PCT', 'WAIST_CM', 'CHEST_CM', 'HIP_CM', 'ARM_CM',
                                               'THIGH_CM')),
    target_value NUMERIC(7, 2),
    exercise_id  UUID REFERENCES exercise (id) ON DELETE SET NULL,
    habit_id     UUID REFERENCES habit (id) ON DELETE SET NULL,
    start_date   DATE          NOT NULL,
    target_date  DATE,
    notes        VARCHAR(1000),
    status       VARCHAR(10)   NOT NULL CHECK (status IN ('ACTIVE', 'ACHIEVED', 'DROPPED')),
    achieved_on  DATE,
    created_at   TIMESTAMPTZ   NOT NULL,
    updated_at   TIMESTAMPTZ   NOT NULL,
    CONSTRAINT goal_body_metric CHECK (kind <> 'BODY' OR metric IS NOT NULL)
);

CREATE INDEX goal_user_idx ON goal (user_id);
CREATE INDEX goal_exercise_idx ON goal (exercise_id);
CREATE INDEX goal_habit_idx ON goal (habit_id);
