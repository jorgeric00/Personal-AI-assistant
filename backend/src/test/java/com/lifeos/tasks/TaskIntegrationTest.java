package com.lifeos.tasks;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.List;

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
class TaskIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from task");
        jdbc.update("delete from task_category");
        // Domingo 11 de octubre de 2026, 12:00 en Madrid
        clock.set(Instant.parse("2026-10-11T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    @Test
    void requiresSession() {
        assertThat(new ApiClient(port).get("/api/tasks").statusCode()).isEqualTo(401);
    }

    @Test
    void createsListsAndFiltersByView() {
        String overdue = create(task("Pagar el seguro", "2026-10-09", null));
        String today = create(task("Comprar pan", "2026-10-11", "18:30"));
        String tomorrow = create(task("Llamar a mamá", "2026-10-12", null));
        String undated = create(task("Leer un libro", null, null));

        List<String> todayIds = ids(api.get("/api/tasks?view=TODAY"));
        assertThat(todayIds).containsExactly(overdue, today);
        assertThat(JsonPath.<List<Boolean>>read(api.get("/api/tasks?view=TODAY").body(), "$[*].overdue"))
                .containsExactly(true, false);
        assertThat(ids(api.get("/api/tasks?view=UPCOMING"))).containsExactly(tomorrow);
        assertThat(ids(api.get("/api/tasks?view=ALL"))).containsExactly(overdue, today, tomorrow, undated);
    }

    @Test
    void validatesCrossFieldRules() {
        HttpResponse<String> reminderWithoutTime = api.post("/api/tasks",
                "{\"kind\":\"REMINDER\",\"title\":\"Cita\",\"priority\":\"MEDIUM\",\"dueDate\":\"2026-10-12\"}");
        assertThat(reminderWithoutTime.statusCode()).isEqualTo(400);
        assertThat(reminderWithoutTime.body()).contains("Un recordatorio necesita fecha y hora");

        HttpResponse<String> blankTitle = api.post("/api/tasks",
                "{\"kind\":\"TASK\",\"title\":\" \",\"priority\":\"MEDIUM\"}");
        assertThat(blankTitle.statusCode()).isEqualTo(400);
        assertThat(blankTitle.body()).contains("Escribe un título");

        HttpResponse<String> badView = api.get("/api/tasks?view=NOPE");
        assertThat(badView.statusCode()).isEqualTo(400);
    }

    @Test
    void completesTaskWithoutDate() {
        String id = create(task("Leer un libro", null, null));
        HttpResponse<String> done = api.post("/api/tasks/" + id + "/complete", "{\"occurrenceDate\":null}");
        assertThat(done.statusCode()).as(done.body()).isEqualTo(200);
        assertThat(JsonPath.<String>read(done.body(), "$.status")).isEqualTo("DONE");
    }

    @Test
    void completesAndUndoesSimpleTask() {
        String id = create(task("Comprar pan", "2026-10-11", null));

        HttpResponse<String> done = api.post("/api/tasks/" + id + "/complete", "{\"occurrenceDate\":\"2026-10-11\"}");
        assertThat(done.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<String>read(done.body(), "$.status")).isEqualTo("DONE");
        assertThat(ids(api.get("/api/tasks?view=TODAY"))).isEmpty();
        assertThat(ids(api.get("/api/tasks?view=DONE"))).containsExactly(id);

        // Completar dos veces (doble toque o dos pestañas) no hace nada y avisa del cambio
        assertThat(api.post("/api/tasks/" + id + "/complete", "{\"occurrenceDate\":\"2026-10-11\"}").statusCode())
                .isEqualTo(409);

        HttpResponse<String> undone = api.post("/api/tasks/" + id + "/uncomplete", "{\"occurrenceDate\":\"2026-10-11\"}");
        assertThat(JsonPath.<String>read(undone.body(), "$.status")).isEqualTo("PENDING");
        assertThat(ids(api.get("/api/tasks?view=TODAY"))).containsExactly(id);
    }

    @Test
    void recurringTaskAdvancesWithoutDuplicates() {
        String id = create("""
                {"kind":"TASK","title":"Sacar la basura","priority":"LOW","dueDate":"2026-10-12",
                 "recurrence":{"frequency":"WEEKLY","interval":1,"weekdays":["MONDAY","THURSDAY"]}}
                """);

        HttpResponse<String> first = api.post("/api/tasks/" + id + "/complete", "{\"occurrenceDate\":\"2026-10-12\"}");
        assertThat(JsonPath.<String>read(first.body(), "$.dueDate")).isEqualTo("2026-10-15");
        assertThat(JsonPath.<String>read(first.body(), "$.status")).isEqualTo("PENDING");

        // Reintento con la misma aparición: no se duplica ni avanza otra vez
        assertThat(api.post("/api/tasks/" + id + "/complete", "{\"occurrenceDate\":\"2026-10-12\"}").statusCode())
                .isEqualTo(409);
        assertThat(jdbc.queryForObject("select count(*) from task_completion", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from task", Integer.class)).isEqualTo(1);

        HttpResponse<String> undo = api.post("/api/tasks/" + id + "/uncomplete", "{\"occurrenceDate\":\"2026-10-12\"}");
        assertThat(JsonPath.<String>read(undo.body(), "$.dueDate")).isEqualTo("2026-10-12");
        assertThat(jdbc.queryForObject("select count(*) from task_completion", Integer.class)).isZero();
    }

    @Test
    void recurringTaskSkipsMissedOccurrencesWhenCompletedLate() {
        String id = create("""
                {"kind":"TASK","title":"Regar las plantas","priority":"LOW","dueDate":"2026-10-01",
                 "recurrence":{"frequency":"DAILY","interval":2}}
                """);
        HttpResponse<String> done = api.post("/api/tasks/" + id + "/complete", "{\"occurrenceDate\":\"2026-10-01\"}");
        // 01, 03, 05, 07, 09, 11 → hoy (11) es la siguiente aparición
        assertThat(JsonPath.<String>read(done.body(), "$.dueDate")).isEqualTo("2026-10-11");
    }

    @Test
    void recurringTaskEndsAfterUntil() {
        String id = create("""
                {"kind":"TASK","title":"Tomar antibiótico","priority":"HIGH","dueDate":"2026-10-11",
                 "recurrence":{"frequency":"DAILY","interval":1,"until":"2026-10-12"}}
                """);
        api.post("/api/tasks/" + id + "/complete", "{\"occurrenceDate\":\"2026-10-11\"}");
        clock.set(Instant.parse("2026-10-12T10:00:00Z"));
        HttpResponse<String> last = api.post("/api/tasks/" + id + "/complete", "{\"occurrenceDate\":\"2026-10-12\"}");
        assertThat(JsonPath.<String>read(last.body(), "$.status")).isEqualTo("DONE");
    }

    @Test
    void postponesToAFutureDateOnly() {
        String id = create(task("Ordenar el armario", "2026-10-11", null));

        HttpResponse<String> past = api.post("/api/tasks/" + id + "/postpone", "{\"date\":\"2026-10-10\"}");
        assertThat(past.statusCode()).isEqualTo(400);

        HttpResponse<String> postponed = api.post("/api/tasks/" + id + "/postpone", "{\"date\":\"2026-10-13\"}");
        assertThat(JsonPath.<String>read(postponed.body(), "$.status")).isEqualTo("POSTPONED");
        assertThat(ids(api.get("/api/tasks?view=TODAY"))).isEmpty();
        assertThat(ids(api.get("/api/tasks?view=UPCOMING"))).containsExactly(id);
        assertThat(ids(api.get("/api/tasks?view=ALL&status=POSTPONED"))).containsExactly(id);
    }

    @Test
    void calendarExpandsRecurringAndIncludesCompleted() {
        String weekly = create("""
                {"kind":"REMINDER","title":"Pádel","priority":"MEDIUM","dueDate":"2026-10-06","dueTime":"19:00",
                 "recurrence":{"frequency":"WEEKLY","interval":1}}
                """);
        api.post("/api/tasks/" + weekly + "/complete", "{\"occurrenceDate\":\"2026-10-06\"}");

        HttpResponse<String> calendar = api.get("/api/tasks/calendar?from=2026-10-01&to=2026-10-31");
        assertThat(calendar.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<List<String>>read(calendar.body(), "$[*].date"))
                .containsExactly("2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27");
        assertThat(JsonPath.<List<Boolean>>read(calendar.body(), "$[*].done")).containsExactly(true, false, false, false);

        assertThat(api.get("/api/tasks/calendar?from=2026-01-01&to=2026-12-31").statusCode()).isEqualTo(400);
    }

    @Test
    void categoriesFilterAndSurviveDeletion() {
        HttpResponse<String> category = api.post("/api/task-categories", "{\"name\":\"Casa\",\"color\":\"#0f766e\"}");
        assertThat(category.statusCode()).isEqualTo(201);
        String categoryId = JsonPath.read(category.body(), "$.id");

        assertThat(api.post("/api/task-categories", "{\"name\":\"casa\",\"color\":\"#0f766e\"}").body())
                .contains("Ya tienes una categoría con ese nombre");

        String inCategory = create("""
                {"kind":"TASK","title":"Limpiar","priority":"MEDIUM","categoryId":"%s"}
                """.formatted(categoryId));
        create(task("Otra", null, null));

        assertThat(ids(api.get("/api/tasks?categoryId=" + categoryId))).containsExactly(inCategory);

        assertThat(api.delete("/api/task-categories/" + categoryId).statusCode()).isEqualTo(204);
        HttpResponse<String> task = api.get("/api/tasks/" + inCategory);
        assertThat(task.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<Object>read(task.body(), "$.category")).isNull();
    }

    @Test
    void updatesAndDeletes() {
        String id = create(task("Comprar pan", "2026-10-11", null));
        HttpResponse<String> updated = api.put("/api/tasks/" + id, """
                {"kind":"TASK","title":"Comprar pan y leche","priority":"HIGH","dueDate":"2026-10-11",
                 "description":"  En la panadería de la esquina  "}
                """);
        assertThat(updated.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<String>read(updated.body(), "$.title")).isEqualTo("Comprar pan y leche");
        assertThat(JsonPath.<String>read(updated.body(), "$.description")).isEqualTo("En la panadería de la esquina");

        assertThat(api.delete("/api/tasks/" + id).statusCode()).isEqualTo(204);
        assertThat(api.get("/api/tasks/" + id).statusCode()).isEqualTo(404);
    }

    private String create(String json) {
        HttpResponse<String> response = api.post("/api/tasks", json);
        assertThat(response.statusCode()).as(response.body()).isEqualTo(201);
        return JsonPath.read(response.body(), "$.id");
    }

    private static String task(String title, String date, String time) {
        return "{\"kind\":\"TASK\",\"title\":\"" + title + "\",\"priority\":\"MEDIUM\""
                + (date == null ? "" : ",\"dueDate\":\"" + date + "\"")
                + (time == null ? "" : ",\"dueTime\":\"" + time + "\"") + "}";
    }

    private static List<String> ids(HttpResponse<String> response) {
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        return JsonPath.read(response.body(), "$[*].id");
    }
}
