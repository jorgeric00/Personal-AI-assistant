package com.lifeos.agenda;

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
class AgendaIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from activity");
        jdbc.update("delete from activity_category");
        jdbc.update("delete from agenda_settings");
        jdbc.update("delete from workout");
        jdbc.update("delete from routine");
        // Domingo 11 de octubre de 2026, mediodía en Madrid
        clock.set(Instant.parse("2026-10-11T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    private String categoryId(String name) {
        return JsonPath.<List<String>>read(api.get("/api/agenda/categories").body(), "$[?(@.name == '" + name + "')].id")
                .getFirst();
    }

    private String activity(String title, String categoryId, String start, String startTime, String end,
            String endTime, String recurrence) {
        return """
                {"title":"%s","categoryId":"%s","startDate":"%s","startTime":%s,"endDate":"%s","endTime":%s,
                 "location":"Club","recurrence":%s}
                """.formatted(title, categoryId, start, startTime == null ? "null" : "\"" + startTime + "\"", end,
                endTime == null ? "null" : "\"" + endTime + "\"", recurrence);
    }

    private String agenda(String from, String to) {
        HttpResponse<String> response = api.get("/api/agenda?from=" + from + "&to=" + to);
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        return response.body();
    }

    @Test
    void requiresSession() {
        assertThat(new ApiClient(port).get("/api/agenda?from=2026-10-01&to=2026-10-31").statusCode()).isEqualTo(401);
        assertThat(new ApiClient(port).get("/api/agenda/categories").statusCode()).isEqualTo(401);
    }

    @Test
    void categoriesAreSeededOnceAndCanBeArchivedButNotDeletedWhileInUse() {
        HttpResponse<String> list = api.get("/api/agenda/categories");
        assertThat(JsonPath.<List<String>>read(list.body(), "$[*].name")).hasSize(AgendaSetupService.DEFAULTS.size())
                .contains("Gimnasio", "Pádel y deporte", "Amigos", "Viajes");
        String friends = categoryId("Amigos");
        assertThat(api.delete("/api/agenda/categories/" + categoryId("Recados")).statusCode()).isEqualTo(204);
        assertThat(JsonPath.<List<Object>>read(api.get("/api/agenda/categories").body(), "$"))
                .hasSize(AgendaSetupService.DEFAULTS.size() - 1);

        HttpResponse<String> duplicate = api.post("/api/agenda/categories", "{\"name\":\"amigos\",\"color\":\"#123456\"}");
        assertThat(duplicate.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(duplicate.body(), "$.errors.name"))
                .isEqualTo("Ya tienes una categoría con ese nombre");

        api.post("/api/agenda/activities", activity("Cena", friends, "2026-10-16", "21:00", "2026-10-16", "23:30",
                "null"));
        HttpResponse<String> inUse = api.delete("/api/agenda/categories/" + friends);
        assertThat(inUse.statusCode()).isEqualTo(409);
        assertThat(JsonPath.<String>read(inUse.body(), "$.title")).isEqualTo("Categoría en uso");

        HttpResponse<String> archived = api.put("/api/agenda/categories/" + friends,
                "{\"name\":\"Amigos\",\"color\":\"#DB2777\",\"archived\":true}");
        assertThat(JsonPath.<Boolean>read(archived.body(), "$.archived")).isTrue();
        assertThat(JsonPath.<Boolean>read(archived.body(), "$.inUse")).isTrue();
        assertThat(JsonPath.<String>read(archived.body(), "$.color")).isEqualTo("#db2777");
        // Una categoría archivada no vale para actividades nuevas
        HttpResponse<String> rejected = api.post("/api/agenda/activities",
                activity("Otra cena", friends, "2026-10-17", null, "2026-10-17", null, "null"));
        assertThat(rejected.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(rejected.body(), "$.errors.categoryId")).isEqualTo("Elige una categoría");
    }

    @Test
    void activitiesValidateTheirTimes() {
        String gym = categoryId("Gimnasio");
        HttpResponse<String> backwards = api.post("/api/agenda/activities",
                activity("Pesas", gym, "2026-10-12", "19:00", "2026-10-12", "18:00", "null"));
        assertThat(backwards.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(backwards.body(), "$.errors.endDate"))
                .isEqualTo("El final tiene que ser posterior al inicio");
        HttpResponse<String> halfTime = api.post("/api/agenda/activities",
                activity("Pesas", gym, "2026-10-12", "19:00", "2026-10-12", null, "null"));
        assertThat(JsonPath.<String>read(halfTime.body(), "$.errors.endTime")).startsWith("Indica la hora de inicio");
        HttpResponse<String> weekdaysDaily = api.post("/api/agenda/activities", activity("Pesas", gym, "2026-10-12",
                null, "2026-10-12", null, "{\"frequency\":\"DAILY\",\"interval\":1,\"weekdays\":[\"MONDAY\"]}"));
        assertThat(JsonPath.<String>read(weekdaysDaily.body(), "$.errors.recurrence"))
                .startsWith("Los días de la semana");
        assertThat(api.get("/api/agenda?from=2026-10-01&to=2026-12-31").statusCode()).isEqualTo(400);
    }

    @Test
    void recurringAndMultiDayActivitiesExpandIntoOccurrencesWithTheirOwnStatus() {
        String sport = categoryId("Pádel y deporte");
        HttpResponse<String> created = api.post("/api/agenda/activities", activity("Pádel", sport, "2026-10-13",
                "19:00", "2026-10-13", "20:30",
                "{\"frequency\":\"WEEKLY\",\"interval\":1,\"weekdays\":[\"TUESDAY\",\"THURSDAY\"],\"until\":\"2026-10-22\"}"));
        assertThat(created.statusCode()).as(created.body()).isEqualTo(201);
        String padel = JsonPath.read(created.body(), "$.id");
        String trip = JsonPath.read(api.post("/api/agenda/activities",
                activity("Escapada", categoryId("Viajes"), "2026-10-17", null, "2026-10-19", null, "null")).body(),
                "$.id");

        String week = agenda("2026-10-18", "2026-10-25");
        // El viaje empezó antes del rango pero lo toca; el pádel termina el 22
        assertThat(JsonPath.<List<String>>read(week, "$[*].title")).containsExactly("Escapada", "Pádel", "Pádel");
        assertThat(JsonPath.<List<String>>read(week, "$[*].date"))
                .containsExactly("2026-10-17", "2026-10-20", "2026-10-22");
        assertThat(JsonPath.<String>read(week, "$[0].endDate")).isEqualTo("2026-10-19");
        assertThat(JsonPath.<String>read(week, "$[1].startTime")).isEqualTo("19:00:00");
        assertThat(JsonPath.<List<String>>read(week, "$[*].status")).containsOnly("PLANNED");
        assertThat(JsonPath.<Boolean>read(week, "$[1].recurring")).isTrue();
        assertThat(JsonPath.<String>read(week, "$[1].category.name")).isEqualTo("Pádel y deporte");

        assertThat(api.put("/api/agenda/activities/" + padel + "/occurrences/2026-10-20", "{\"status\":\"DONE\"}")
                .statusCode()).isEqualTo(204);
        api.put("/api/agenda/activities/" + padel + "/occurrences/2026-10-22", "{\"status\":\"CANCELLED\"}");
        api.put("/api/agenda/activities/" + trip + "/occurrences/2026-10-17", "{\"status\":\"CONFIRMED\"}");
        // Un día que no toca no es una aparición
        assertThat(api.put("/api/agenda/activities/" + padel + "/occurrences/2026-10-21", "{\"status\":\"DONE\"}")
                .statusCode()).isEqualTo(404);
        assertThat(JsonPath.<List<String>>read(agenda("2026-10-18", "2026-10-25"), "$[*].status"))
                .containsExactly("CONFIRMED", "DONE", "CANCELLED");

        // Volver a planificada borra el estado; editar la serie mantiene los estados de cada fecha
        api.put("/api/agenda/activities/" + padel + "/occurrences/2026-10-22", "{\"status\":\"PLANNED\"}");
        HttpResponse<String> edited = api.put("/api/agenda/activities/" + padel, activity("Pádel con Luis", sport,
                "2026-10-13", "19:30", "2026-10-13", "21:00",
                "{\"frequency\":\"WEEKLY\",\"interval\":1,\"weekdays\":[\"TUESDAY\",\"THURSDAY\"],\"until\":\"2026-10-22\"}"));
        assertThat(edited.statusCode()).as(edited.body()).isEqualTo(200);
        String after = agenda("2026-10-18", "2026-10-25");
        assertThat(JsonPath.<List<String>>read(after, "$[?(@.title == 'Pádel con Luis')].status"))
                .containsExactly("DONE", "PLANNED");
        assertThat(JsonPath.<List<String>>read(after, "$[?(@.title == 'Pádel con Luis')].startTime"))
                .containsOnly("19:30:00");

        assertThat(api.delete("/api/agenda/activities/" + padel).statusCode()).isEqualTo(204);
        assertThat(JsonPath.<List<String>>read(agenda("2026-10-18", "2026-10-25"), "$[*].title"))
                .containsExactly("Escapada");
    }

    @Test
    void workoutsAppearOnceAndRoutineDaysOnlyUntilTheyAreLogged() {
        String exercises = api.get("/api/fitness/exercises").body();
        String squat = JsonPath.<List<String>>read(exercises, "$[?(@.name == 'Sentadilla')].id").getFirst();
        String routine = JsonPath.read(api.post("/api/fitness/routines", """
                {"name":"Piernas","weekdays":["MONDAY","WEDNESDAY"],"exercises":[{"exerciseId":"%s","sets":3}]}
                """.formatted(squat)).body(), "$.id");

        clock.set(Instant.parse("2026-10-12T10:00:00Z"));
        HttpResponse<String> started = api.post("/api/fitness/workouts", "{\"routineId\":\"" + routine + "\"}");
        assertThat(started.statusCode()).as(started.body()).isEqualTo(201);

        String week = agenda("2026-10-05", "2026-10-18");
        // Nada antes de crear la rutina; el lunes 12 solo el entrenamiento, sin duplicar el día de rutina
        assertThat(JsonPath.<List<String>>read(week, "$[*].kind")).containsExactly("WORKOUT", "ROUTINE");
        assertThat(JsonPath.<List<String>>read(week, "$[*].date")).containsExactly("2026-10-12", "2026-10-14");
        assertThat(JsonPath.<List<String>>read(week, "$[*].status")).containsExactly("CONFIRMED", "PLANNED");
        assertThat(JsonPath.<String>read(week, "$[0].id")).isEqualTo(JsonPath.read(started.body(), "$.id"));
        assertThat(JsonPath.<String>read(week, "$[1].id")).isEqualTo(routine);

        // Pasado el miércoles sin entrenar, ese día de rutina queda como no hecho
        clock.set(Instant.parse("2026-10-15T10:00:00Z"));
        assertThat(JsonPath.<List<String>>read(agenda("2026-10-14", "2026-10-14"), "$[*].status"))
                .containsExactly("MISSED");
    }
}
