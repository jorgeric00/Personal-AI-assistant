package com.lifeos.reports;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.http.HttpResponse;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.jayway.jsonpath.JsonPath;
import com.lifeos.TestcontainersConfiguration;
import com.lifeos.support.ApiClient;
import com.lifeos.support.MutableClock;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
class ReportIntegrationTest {

    private static final Timestamp CREATED = Timestamp.from(Instant.parse("2026-09-01T10:00:00Z"));

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;
    private UUID user;
    private int habits;

    @BeforeEach
    void setUp() {
        for (String table : List.of("task", "finance_movement", "finance_category", "finance_settings", "workout",
                "food_entry", "habit", "body_measurement")) {
            jdbc.update("delete from " + table);
        }
        // Jueves 22 de octubre: la semana va del lunes 19 al domingo 25
        clock.set(Instant.parse("2026-10-22T10:00:00Z"));
        api = new ApiClient(port).login();
        user = jdbc.queryForObject("select id from app_user where email = ?", UUID.class, ApiClient.OWNER_EMAIL);
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    @Test
    void comparesTheWeekSoFarWithTheSameDaysOfThePreviousOne() {
        // Tareas: la completada el domingo a las 23:30 UTC es ya lunes en Madrid
        doneTask("2026-10-20T09:00:00Z");
        doneTask("2026-10-18T23:30:00Z");
        doneTask("2026-10-13T09:00:00Z");
        doneTask("2026-10-17T09:00:00Z"); // después del mismo tramo de la semana anterior
        UUID repeated = UUID.randomUUID();
        jdbc.update("""
                insert into task (id, user_id, kind, title, priority, status, due_date, recurrence_frequency,
                  recurrence_interval, recurrence_anchor, created_at, updated_at)
                values (?, ?, 'TASK', 'Regar', 'LOW', 'PENDING', '2026-10-23', 'DAILY', 1, '2026-10-01', ?, ?)""",
                repeated, user, CREATED, CREATED);
        jdbc.update("insert into task_completion values (?, '2026-10-21', ?)", repeated,
                Timestamp.from(Instant.parse("2026-10-21T08:00:00Z")));

        // Finanzas: solo la moneda del usuario
        jdbc.update("insert into finance_settings values (?, 'EUR', ?)", user, CREATED);
        UUID salary = category("INCOME", "Nómina");
        UUID food = category("EXPENSE", "Comida");
        UUID transport = category("EXPENSE", "Transporte");
        movement("INCOME", 100000, "EUR", "2026-10-20", salary);
        movement("EXPENSE", 2500, "EUR", "2026-10-21", food);
        movement("EXPENSE", 1500, "EUR", "2026-10-22", transport);
        movement("EXPENSE", 1000, "EUR", "2026-10-19", food);
        movement("EXPENSE", 9900, "USD", "2026-10-20", food);
        movement("EXPENSE", 4000, "EUR", "2026-10-14", food);

        // Entreno: solo las sesiones terminadas y las series hechas
        UUID exercise = UUID.randomUUID();
        jdbc.update("""
                insert into exercise (id, user_id, name, muscle_group, type, created_at, updated_at)
                values (?, ?, ?, 'LEGS', 'STRENGTH', ?, ?)""", exercise, user, "Sentadilla " + exercise, CREATED, CREATED);
        workout("2026-10-20", true, exercise, true, true, false);
        workout("2026-10-21", false, exercise, true);
        workout("2026-10-13", true, exercise, true);

        // Alimentación: dos días anotados, uno sin calorías
        food("2026-10-20", 500, false);
        food("2026-10-20", 700, true);
        food("2026-10-21", null, false);
        food("2026-10-12", 1800, false);

        // Hábitos
        UUID daily = habit("Leer", "DAILY", null, null);
        check(daily, "2026-10-19", "2026-10-20", "2026-10-22", "2026-10-12");
        UUID weekdays = habit("Gimnasio", "DAILY", "MONDAY,WEDNESDAY", null);
        check(weekdays, "2026-10-21", "2026-10-20");
        UUID weekly = habit("Llamar a casa", "WEEKLY", null, 2);
        check(weekly, "2026-10-21");
        jdbc.update("update habit set archived = true where id = ?", habit("Archivado", "DAILY", null, null));

        // Medidas
        measurement("2026-10-19", "80.50", "90.0");
        measurement("2026-10-22", "80.10", null);
        measurement("2026-10-12", "81.00", null);

        HttpResponse<String> response = api.get("/api/reports?period=WEEK&date=2026-10-22");
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        String body = response.body();
        assertThat(JsonPath.<String>read(body, "$.start")).isEqualTo("2026-10-19");
        assertThat(JsonPath.<String>read(body, "$.end")).isEqualTo("2026-10-25");
        assertThat(JsonPath.<String>read(body, "$.to")).isEqualTo("2026-10-22");
        assertThat(JsonPath.<Boolean>read(body, "$.partial")).isTrue();
        assertThat(JsonPath.<String>read(body, "$.previousFrom")).isEqualTo("2026-10-12");
        assertThat(JsonPath.<String>read(body, "$.previousTo")).isEqualTo("2026-10-15");

        assertThat(JsonPath.<Map<String, Object>>read(body, "$.tasks"))
                .isEqualTo(Map.of("completed", 3, "previousCompleted", 1));

        assertThat(JsonPath.<String>read(body, "$.finance.currency")).isEqualTo("EUR");
        assertThat(JsonPath.<Integer>read(body, "$.finance.incomeCents")).isEqualTo(100000);
        assertThat(JsonPath.<Integer>read(body, "$.finance.expenseCents")).isEqualTo(5000);
        assertThat(JsonPath.<Integer>read(body, "$.finance.previousExpenseCents")).isEqualTo(4000);
        assertThat(JsonPath.<List<String>>read(body, "$.finance.topExpenses[*].name"))
                .containsExactly("Comida", "Transporte");
        assertThat(JsonPath.<Integer>read(body, "$.finance.topExpenses[0].amountCents")).isEqualTo(3500);

        assertThat(JsonPath.<Map<String, Object>>read(body, "$.training")).isEqualTo(
                Map.of("workouts", 1, "previousWorkouts", 1, "setsDone", 2, "previousSetsDone", 1));

        assertThat(JsonPath.<Integer>read(body, "$.nutrition.loggedDays")).isEqualTo(2);
        assertThat(JsonPath.<Integer>read(body, "$.nutrition.averageCalories")).isEqualTo(1200);
        assertThat(JsonPath.<Boolean>read(body, "$.nutrition.estimated")).isTrue();
        assertThat(JsonPath.<Integer>read(body, "$.nutrition.previousLoggedDays")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(body, "$.nutrition.previousAverageCalories")).isEqualTo(1800);

        assertThat(JsonPath.<List<String>>read(body, "$.habits[*].name"))
                .containsExactly("Leer", "Gimnasio", "Llamar a casa");
        // Leer: tocaban lunes a miércoles y hoy ya está marcado; la semana anterior, 1 de 4
        assertThat(JsonPath.<Integer>read(body, "$.habits[0].done")).isEqualTo(3);
        assertThat(JsonPath.<Integer>read(body, "$.habits[0].expected")).isEqualTo(4);
        assertThat(JsonPath.<Integer>read(body, "$.habits[0].previousDone")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(body, "$.habits[0].previousExpected")).isEqualTo(4);
        // Gimnasio: la marca del martes no cuenta porque ese día no tocaba
        assertThat(JsonPath.<Integer>read(body, "$.habits[1].done")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(body, "$.habits[1].expected")).isEqualTo(2);
        assertThat(JsonPath.<Integer>read(body, "$.habits[2].done")).isEqualTo(1);
        assertThat(JsonPath.<Object>read(body, "$.habits[2].expected")).isNull();
        assertThat(JsonPath.<Integer>read(body, "$.habits[2].timesPerWeek")).isEqualTo(2);

        assertThat(JsonPath.<List<String>>read(body, "$.body[*].metric")).containsExactly("weightKg", "waistCm");
        assertThat(JsonPath.<Double>read(body, "$.body[0].first")).isEqualTo(80.5);
        assertThat(JsonPath.<Double>read(body, "$.body[0].last")).isEqualTo(80.1);
        assertThat(JsonPath.<String>read(body, "$.body[0].lastDate")).isEqualTo("2026-10-22");
        assertThat(JsonPath.<Integer>read(body, "$.body[1].count")).isEqualTo(1);
    }

    @Test
    void reportsAWholeMonthAgainstTheWholePreviousOne() {
        String body = api.get("/api/reports?period=MONTH&date=2026-09-10").body();
        assertThat(JsonPath.<String>read(body, "$.start")).isEqualTo("2026-09-01");
        assertThat(JsonPath.<String>read(body, "$.to")).isEqualTo("2026-09-30");
        assertThat(JsonPath.<Boolean>read(body, "$.partial")).isFalse();
        assertThat(JsonPath.<String>read(body, "$.previousFrom")).isEqualTo("2026-08-01");
        assertThat(JsonPath.<String>read(body, "$.previousTo")).isEqualTo("2026-08-31");
        // Sin datos no se inventa nada
        assertThat(JsonPath.<Object>read(body, "$.finance.currency")).isNull();
        assertThat(JsonPath.<Object>read(body, "$.nutrition.averageCalories")).isNull();
        assertThat(JsonPath.<List<Object>>read(body, "$.habits")).isEmpty();
        assertThat(JsonPath.<List<Object>>read(body, "$.body")).isEmpty();

        // Octubre en curso se compara con los mismos días de septiembre
        String current = api.get("/api/reports?period=MONTH&date=2026-10-01").body();
        assertThat(JsonPath.<String>read(current, "$.previousTo")).isEqualTo("2026-09-22");
    }

    @Test
    void rejectsFutureDatesAndUnknownPeriods() {
        HttpResponse<String> future = api.get("/api/reports?period=WEEK&date=2026-10-23");
        assertThat(future.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(future.body(), "$.errors.date")).isNotBlank();
        assertThat(api.get("/api/reports?period=YEAR&date=2026-10-01").statusCode()).isEqualTo(400);
    }

    private void doneTask(String completedAt) {
        jdbc.update("""
                insert into task (id, user_id, kind, title, priority, status, completed_at, created_at, updated_at)
                values (?, ?, 'TASK', 'Hecha', 'MEDIUM', 'DONE', ?, ?, ?)""", UUID.randomUUID(), user,
                Timestamp.from(Instant.parse(completedAt)), CREATED, CREATED);
    }

    private UUID category(String kind, String name) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into finance_category (id, user_id, kind, name, color, created_at) values (?, ?, ?, ?, ?, ?)",
                id, user, kind, name, "#0f766e", CREATED);
        return id;
    }

    private void movement(String kind, long cents, String currency, String date, UUID category) {
        jdbc.update("""
                insert into finance_movement (id, user_id, kind, amount_cents, currency, date, category_id,
                  created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)""", UUID.randomUUID(), user, kind, cents,
                currency, Date.valueOf(date), category, CREATED, CREATED);
    }

    private void workout(String date, boolean finished, UUID exercise, boolean... sets) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into workout (id, user_id, name, date, finished_at, created_at, updated_at)
                values (?, ?, 'Piernas', ?, ?, ?, ?)""", id, user, Date.valueOf(date), finished ? CREATED : null,
                CREATED, CREATED);
        UUID entry = UUID.randomUUID();
        jdbc.update("insert into workout_exercise (id, workout_id, exercise_id, position) values (?, ?, ?, 0)", entry,
                id, exercise);
        for (int i = 0; i < sets.length; i++) {
            jdbc.update("insert into workout_set (id, workout_exercise_id, position, done) values (?, ?, ?, ?)",
                    UUID.randomUUID(), entry, i, sets[i]);
        }
    }

    private void food(String date, Integer calories, boolean estimated) {
        jdbc.update("""
                insert into food_entry (id, user_id, date, meal, name, calories, estimated, created_at, updated_at)
                values (?, ?, ?, 'LUNCH', 'Plato', ?, ?, ?, ?)""", UUID.randomUUID(), user, Date.valueOf(date),
                calories, estimated, CREATED, CREATED);
    }

    private UUID habit(String name, String frequency, String weekdays, Integer timesPerWeek) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into habit (id, user_id, name, color, frequency, weekdays, times_per_week, start_date,
                  created_at, updated_at) values (?, ?, ?, '#0f766e', ?, ?, ?, '2026-10-01', ?, ?)""", id, user, name,
                frequency, weekdays, timesPerWeek, Timestamp.from(CREATED.toInstant().plusSeconds(++habits)), CREATED);
        return id;
    }

    private void check(UUID habit, String... dates) {
        for (String date : dates) {
            jdbc.update("insert into habit_check values (?, ?, ?)", habit, Date.valueOf(date), CREATED);
        }
    }

    private void measurement(String date, String weight, String waist) {
        jdbc.update("""
                insert into body_measurement (id, user_id, date, weight_kg, waist_cm, created_at, updated_at)
                values (?, ?, ?, ?::numeric, ?::numeric, ?, ?)""", UUID.randomUUID(), user, Date.valueOf(date), weight,
                waist, CREATED, CREATED);
    }
}
