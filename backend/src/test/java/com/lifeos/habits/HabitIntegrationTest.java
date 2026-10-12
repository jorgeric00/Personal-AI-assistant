package com.lifeos.habits;

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
class HabitIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from habit");
        // Lunes 12 de octubre de 2026
        clock.set(Instant.parse("2026-10-12T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    private String create(String json) {
        HttpResponse<String> response = api.post("/api/habits", json);
        assertThat(response.statusCode()).as(response.body()).isEqualTo(201);
        return JsonPath.read(response.body(), "$.id");
    }

    @Test
    void createsHabitsAndKeepsOnlyWhatTheFrequencyNeeds() {
        HttpResponse<String> daily = api.post("/api/habits", """
                {"name":" Leer ","color":"#1F7A8C","frequency":"DAILY",
                 "weekdays":["FRIDAY","MONDAY"],"timesPerWeek":3}""");
        assertThat(daily.statusCode()).as(daily.body()).isEqualTo(201);
        assertThat(JsonPath.<String>read(daily.body(), "$.name")).isEqualTo("Leer");
        assertThat(JsonPath.<String>read(daily.body(), "$.color")).isEqualTo("#1f7a8c");
        assertThat(JsonPath.<List<String>>read(daily.body(), "$.weekdays")).containsExactly("MONDAY", "FRIDAY");
        assertThat(JsonPath.<Object>read(daily.body(), "$.timesPerWeek")).isNull();
        assertThat(JsonPath.<String>read(daily.body(), "$.startDate")).isEqualTo("2026-10-12");

        HttpResponse<String> weekly = api.post("/api/habits", """
                {"name":"Caminar","color":"#2a9d8f","frequency":"WEEKLY","weekdays":["MONDAY"],"timesPerWeek":3}""");
        assertThat(JsonPath.<List<String>>read(weekly.body(), "$.weekdays")).isEmpty();
        assertThat(JsonPath.<Integer>read(weekly.body(), "$.timesPerWeek")).isEqualTo(3);

        HttpResponse<String> duplicate = api.post("/api/habits", """
                {"name":"leer","color":"#2a9d8f","frequency":"DAILY"}""");
        assertThat(duplicate.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(duplicate.body(), "$.errors.name")).isEqualTo("Ya tienes un hábito con ese nombre");

        HttpResponse<String> noTimes = api.post("/api/habits", """
                {"name":"Nadar","color":"#2a9d8f","frequency":"WEEKLY"}""");
        assertThat(JsonPath.<String>read(noTimes.body(), "$.errors.timesPerWeek")).isNotBlank();
        HttpResponse<String> badColor = api.post("/api/habits", """
                {"name":"Nadar","color":"azul","frequency":"WEEKLY","timesPerWeek":9}""");
        assertThat(JsonPath.<String>read(badColor.body(), "$.errors.color")).isNotBlank();
        assertThat(JsonPath.<String>read(badColor.body(), "$.errors.timesPerWeek")).isNotBlank();
    }

    @Test
    void checksDaysOnceAndNeverInTheFuture() {
        String id = create("""
                {"name":"Beber agua","color":"#1f7a8c","frequency":"DAILY"}""");
        assertThat(api.put("/api/habits/" + id + "/checks/2026-10-12", "{}").statusCode()).isEqualTo(204);
        // Marcar dos veces no duplica
        assertThat(api.put("/api/habits/" + id + "/checks/2026-10-12", "{}").statusCode()).isEqualTo(204);
        assertThat(api.put("/api/habits/" + id + "/checks/2026-10-10", "{}").statusCode()).isEqualTo(204);
        HttpResponse<String> future = api.put("/api/habits/" + id + "/checks/2026-10-13", "{}");
        assertThat(future.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(future.body(), "$.errors.date")).isEqualTo("Solo puedes marcar hoy o días anteriores");

        HttpResponse<String> list = api.get("/api/habits?from=2026-10-06&to=2026-10-12");
        assertThat(JsonPath.<List<String>>read(list.body(), "$[0].checks")).containsExactly("2026-10-10", "2026-10-12");
        HttpResponse<String> narrow = api.get("/api/habits?from=2026-10-11&to=2026-10-12");
        assertThat(JsonPath.<List<String>>read(narrow.body(), "$[0].checks")).containsExactly("2026-10-12");

        assertThat(api.delete("/api/habits/" + id + "/checks/2026-10-12").statusCode()).isEqualTo(204);
        list = api.get("/api/habits?from=2026-10-06&to=2026-10-12");
        assertThat(JsonPath.<List<String>>read(list.body(), "$[0].checks")).containsExactly("2026-10-10");
    }

    @Test
    void archivingKeepsHistoryAndDeletingRemovesIt() {
        String id = create("""
                {"name":"Meditar","color":"#1f7a8c","frequency":"DAILY"}""");
        api.put("/api/habits/" + id + "/checks/2026-10-11", "{}");
        HttpResponse<String> archived = api.put("/api/habits/" + id, """
                {"name":"Meditar","color":"#1f7a8c","frequency":"DAILY","archived":true}""");
        assertThat(JsonPath.<Boolean>read(archived.body(), "$.archived")).isTrue();
        HttpResponse<String> list = api.get("/api/habits?from=2026-10-06&to=2026-10-12");
        assertThat(JsonPath.<List<String>>read(list.body(), "$[0].checks")).containsExactly("2026-10-11");

        assertThat(api.delete("/api/habits/" + id).statusCode()).isEqualTo(204);
        assertThat(jdbc.queryForObject("select count(*) from habit_check", Integer.class)).isZero();
    }

    @Test
    void habitsAreOwnedAndRangeIsLimited() {
        assertThat(new ApiClient(port).get("/api/habits?from=2026-10-06&to=2026-10-12").statusCode()).isEqualTo(401);
        assertThat(api.get("/api/habits?from=2026-01-01&to=2026-10-12").statusCode()).isEqualTo(400);
        assertThat(api.put("/api/habits/00000000-0000-0000-0000-000000000001/checks/2026-10-12", "{}").statusCode())
                .isEqualTo(404);
    }
}
