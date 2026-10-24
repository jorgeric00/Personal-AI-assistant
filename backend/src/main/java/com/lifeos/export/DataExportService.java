package com.lifeos.export;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Time;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.finance.FinanceCsvService;

import tools.jackson.databind.json.JsonMapper;

/**
 * Exportación completa de los datos de un usuario en un ZIP: todas sus tablas en JSON, las fotos de progreso como
 * JPEG y los movimientos en el mismo CSV que importa Finanzas. Se lee en una sola transacción para que el conjunto
 * sea coherente aunque se esté usando la app a la vez.
 */
@Service
public class DataExportService {

    static final int FORMAT_VERSION = 1;

    /** Lo que no se exporta: la contraseña, las sesiones y datos internos de envío de avisos. */
    private static final Set<String> SKIPPED_COLUMNS = Set.of("user_id", "search_text");

    /**
     * Tablas del usuario y cómo leerlas, en orden de dependencias. Las tablas hijas se leen a través de su tabla
     * padre. No se incluyen las suscripciones push (claves de cada navegador) ni el registro de avisos enviados.
     */
    static final Map<String, String> TABLES = tables();

    private final JdbcTemplate jdbc;
    private final JsonMapper json;
    private final FinanceCsvService financeCsv;
    private final Clock clock;
    private final LifeosProperties properties;

    public DataExportService(JdbcTemplate jdbc, JsonMapper json, FinanceCsvService financeCsv, Clock clock,
            LifeosProperties properties) {
        this.jdbc = jdbc;
        this.json = json;
        this.financeCsv = financeCsv;
        this.clock = clock;
        this.properties = properties;
    }

    public String fileName() {
        return "lifeos-" + LocalDate.now(clock.withZone(properties.timezone())) + ".zip";
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public void write(UUID userId, OutputStream target) throws IOException {
        ZipOutputStream zip = new ZipOutputStream(target, StandardCharsets.UTF_8);

        Map<String, Object> document = new LinkedHashMap<>();
        document.put("format", "lifeos-export");
        document.put("version", FORMAT_VERSION);
        document.put("exportedAt", clock.instant().toString());
        document.put("user", jdbc.queryForObject(
                "select email, display_name, locale, created_at from app_user where id = ?",
                (rs, i) -> row(rs), userId));
        Map<String, List<Map<String, Object>>> data = new LinkedHashMap<>();
        TABLES.forEach((table, sql) -> data.put(table, jdbc.query(sql, (rs, i) -> row(rs), userId)));
        // Cada foto indica el fichero en el que va su imagen
        data.get("progress_photo").forEach(photo -> photo.put("file", photoFile(photo)));
        document.put("data", data);

        zip.putNextEntry(new ZipEntry("datos.json"));
        zip.write(json.writerWithDefaultPrettyPrinter().writeValueAsBytes(document));
        zip.closeEntry();

        zip.putNextEntry(new ZipEntry("finanzas.csv"));
        zip.write(("﻿" + financeCsv.export(userId, LocalDate.of(1900, 1, 1), LocalDate.of(9999, 12, 31)))
                .getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();

        for (Map<String, Object> photo : data.get("progress_photo")) {
            byte[] image = jdbc.queryForObject("select image from progress_photo_data where photo_id = ?",
                    byte[].class, UUID.fromString((String) photo.get("id")));
            zip.putNextEntry(new ZipEntry((String) photo.get("file")));
            zip.write(image);
            zip.closeEntry();
        }

        zip.putNextEntry(new ZipEntry("LEEME.txt"));
        zip.write(readme().getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
        zip.finish();
    }

    private static String photoFile(Map<String, Object> photo) {
        return "fotos/" + photo.get("taken_on") + "-" + String.valueOf(photo.get("pose")).toLowerCase() + "-"
                + photo.get("id") + ".jpg";
    }

    /** Una fila con sus columnas en orden y valores en texto estable (fechas ISO, decimales exactos). */
    private static Map<String, Object> row(ResultSet rs) throws SQLException {
        ResultSetMetaData meta = rs.getMetaData();
        Map<String, Object> row = new LinkedHashMap<>();
        for (int i = 1; i <= meta.getColumnCount(); i++) {
            String column = meta.getColumnLabel(i);
            if (SKIPPED_COLUMNS.contains(column)) {
                continue;
            }
            row.put(column, value(rs.getObject(i)));
        }
        return row;
    }

    private static Object value(Object value) {
        return switch (value) {
            case null -> null;
            case Timestamp t -> t.toInstant().toString();
            case Date d -> d.toLocalDate().toString();
            case Time t -> t.toLocalTime().toString();
            case UUID u -> u.toString();
            case BigDecimal b -> new BigDecimal(b.stripTrailingZeros().toPlainString());
            case Boolean b -> b;
            case Number n -> n;
            default -> value.toString();
        };
    }

    private static Map<String, String> tables() {
        Map<String, String> t = new LinkedHashMap<>();
        String own = "select * from %s where user_id = ? order by %s";
        t.put("task_category", own.formatted("task_category", "created_at"));
        t.put("task", own.formatted("task", "created_at"));
        t.put("task_completion", """
                select c.* from task_completion c join task t on t.id = c.task_id
                where t.user_id = ? order by c.task_id, c.occurrence_date""");
        t.put("note", own.formatted("note", "created_at"));
        t.put("note_tag", """
                select x.* from note_tag x join note n on n.id = x.note_id where n.user_id = ? order by 1, 2""");
        t.put("note_task", """
                select x.* from note_task x join note n on n.id = x.note_id where n.user_id = ? order by 1, 2""");
        t.put("finance_settings", "select * from finance_settings where user_id = ?");
        t.put("finance_category", own.formatted("finance_category", "created_at"));
        t.put("finance_account", own.formatted("finance_account", "created_at"));
        t.put("finance_recurring", own.formatted("finance_recurring", "created_at"));
        t.put("finance_movement", own.formatted("finance_movement", "date, created_at"));
        t.put("finance_movement_tag", """
                select x.* from finance_movement_tag x join finance_movement m on m.id = x.movement_id
                where m.user_id = ? order by 1, 2""");
        t.put("finance_budget", own.formatted("finance_budget", "created_at"));
        t.put("fitness_profile", "select * from fitness_profile where user_id = ?");
        t.put("fitness_settings", "select * from fitness_settings where user_id = ?");
        t.put("custom_metric", own.formatted("custom_metric", "created_at"));
        t.put("body_measurement", own.formatted("body_measurement", "date"));
        t.put("custom_metric_value", """
                select v.* from custom_metric_value v join body_measurement m on m.id = v.measurement_id
                where m.user_id = ? order by 1, 2""");
        t.put("progress_photo", own.formatted("progress_photo", "taken_on, created_at"));
        t.put("exercise", own.formatted("exercise", "created_at"));
        t.put("routine", own.formatted("routine", "created_at"));
        t.put("routine_exercise", """
                select x.* from routine_exercise x join routine r on r.id = x.routine_id
                where r.user_id = ? order by x.routine_id, x.position""");
        t.put("workout", own.formatted("workout", "date, created_at"));
        t.put("workout_exercise", """
                select x.* from workout_exercise x join workout w on w.id = x.workout_id
                where w.user_id = ? order by x.workout_id, x.position""");
        t.put("workout_set", """
                select s.* from workout_set s join workout_exercise x on x.id = s.workout_exercise_id
                join workout w on w.id = x.workout_id where w.user_id = ? order by s.workout_exercise_id, s.position""");
        t.put("agenda_settings", "select * from agenda_settings where user_id = ?");
        t.put("activity_category", own.formatted("activity_category", "created_at"));
        t.put("activity", own.formatted("activity", "created_at"));
        t.put("activity_occurrence", """
                select o.* from activity_occurrence o join activity a on a.id = o.activity_id
                where a.user_id = ? order by 1, 2""");
        t.put("nutrition_target", "select * from nutrition_target where user_id = ?");
        t.put("nutrition_day", own.formatted("nutrition_day", "date"));
        t.put("food_entry", own.formatted("food_entry", "date, created_at"));
        t.put("saved_meal", own.formatted("saved_meal", "created_at"));
        t.put("saved_meal_item", """
                select i.* from saved_meal_item i join saved_meal m on m.id = i.saved_meal_id
                where m.user_id = ? order by i.saved_meal_id, i.position""");
        t.put("planned_meal", own.formatted("planned_meal", "date, created_at"));
        t.put("habit", own.formatted("habit", "created_at"));
        t.put("habit_check", """
                select c.* from habit_check c join habit h on h.id = c.habit_id
                where h.user_id = ? order by c.habit_id, c.date""");
        t.put("goal", own.formatted("goal", "created_at"));
        return t;
    }

    private static String readme() {
        return """
                LifeOS - exportación de tus datos / export of your data

                datos.json     Todos tus datos, una lista por tabla (fechas ISO 8601, horas en UTC, importes en
                               céntimos). / All your data, one list per table (ISO 8601 dates, times in UTC,
                               amounts in cents).
                finanzas.csv   Tus movimientos, en el mismo formato que importa Finanzas. / Your transactions,
                               in the format the Finance import reads.
                fotos/         Tus fotos de progreso en JPEG. El campo "file" de cada foto en datos.json indica
                               su fichero. / Your progress photos as JPEG; each photo's "file" field names it.

                Este archivo contiene datos personales y sensibles (medidas, fotos, finanzas). Guárdalo en un
                lugar seguro. / This file holds personal and sensitive data. Keep it somewhere safe.
                """;
    }
}
