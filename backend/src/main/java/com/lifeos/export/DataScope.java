package com.lifeos.export;

import java.util.List;

/**
 * Bloques de datos que se pueden borrar por separado. Cada uno lista sus tablas en un orden que respeta las claves
 * foráneas; las tablas hijas se borran en cascada. Borrar los ajustes de un módulo lo deja como recién estrenado
 * (por ejemplo, vuelve a crear el catálogo de ejercicios o las categorías iniciales).
 */
public enum DataScope {
    TASKS("task", "task_category"),
    NOTES("note"),
    FINANCE("finance_movement", "finance_recurring", "finance_budget", "finance_account", "finance_category",
            "finance_settings"),
    TRAINING("workout", "routine", "exercise", "fitness_settings"),
    BODY("body_measurement", "custom_metric", "progress_photo", "fitness_profile"),
    NUTRITION("planned_meal", "food_entry", "nutrition_day", "saved_meal", "nutrition_target"),
    AGENDA("activity", "activity_category", "agenda_settings"),
    HABITS("habit"),
    GOALS("goal");

    private final List<String> tables;

    DataScope(String... tables) {
        this.tables = List.of(tables);
    }

    List<String> tables() {
        return tables;
    }
}
