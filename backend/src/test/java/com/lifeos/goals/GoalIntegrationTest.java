package com.lifeos.goals;

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
class GoalIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from goal");
        jdbc.update("delete from habit");
        clock.set(Instant.parse("2026-10-12T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    @Test
    void keepsOnlyWhatEachKindNeeds() {
        HttpResponse<String> weight = api.post("/api/goals", """
                {"title":" Bajar a 78 kg ","kind":"BODY","metric":"WEIGHT_KG","targetValue":78.5,
                 "habitId":"00000000-0000-0000-0000-000000000001","targetDate":"2027-03-01"}""");
        assertThat(weight.statusCode()).as(weight.body()).isEqualTo(201);
        assertThat(JsonPath.<String>read(weight.body(), "$.title")).isEqualTo("Bajar a 78 kg");
        assertThat(JsonPath.<Double>read(weight.body(), "$.targetValue")).isEqualTo(78.5);
        assertThat(JsonPath.<Object>read(weight.body(), "$.habitId")).isNull();
        assertThat(JsonPath.<String>read(weight.body(), "$.startDate")).isEqualTo("2026-10-12");
        assertThat(JsonPath.<String>read(weight.body(), "$.status")).isEqualTo("ACTIVE");

        HttpResponse<String> custom = api.post("/api/goals", """
                {"title":"Correr una media maratón","kind":"CUSTOM","targetValue":21}""");
        assertThat(JsonPath.<Object>read(custom.body(), "$.targetValue")).isNull();

        String exercise = JsonPath.read(api.get("/api/fitness/exercises").body(), "$[0].id");
        HttpResponse<String> squat = api.post("/api/goals", """
                {"title":"Sentadilla 100 kg","kind":"EXERCISE","exerciseId":"%s","targetValue":100}""".formatted(exercise));
        assertThat(squat.statusCode()).as(squat.body()).isEqualTo(201);

        String habit = JsonPath.read(api.post("/api/habits", """
                {"name":"Leer","color":"#0f766e","frequency":"DAILY"}""").body(), "$.id");
        HttpResponse<String> reading = api.post("/api/goals", """
                {"title":"Leer casi todos los días","kind":"HABIT","habitId":"%s","targetValue":80}""".formatted(habit));
        assertThat(reading.statusCode()).as(reading.body()).isEqualTo(201);

        // Borrar el hábito no borra el objetivo
        api.delete("/api/habits/" + habit);
        HttpResponse<String> list = api.get("/api/goals");
        assertThat(JsonPath.<List<String>>read(list.body(), "$[*].title")).hasSize(4);
        assertThat(JsonPath.<Object>read(list.body(), "$[3].habitId")).isNull();
    }

    @Test
    void validatesEachKind() {
        HttpResponse<String> body = api.post("/api/goals", """
                {"title":"Peso","kind":"BODY"}""");
        assertThat(JsonPath.<String>read(body.body(), "$.errors.metric")).isEqualTo("Elige qué medida quieres seguir");
        assertThat(JsonPath.<String>read(body.body(), "$.errors.targetValue")).isEqualTo("Indica la meta");

        HttpResponse<String> training = api.post("/api/goals", """
                {"title":"Entrenar","kind":"TRAINING","targetValue":3.5}""");
        assertThat(JsonPath.<String>read(training.body(), "$.errors.targetValue")).startsWith("Indica entre 1 y 7");
        HttpResponse<String> plan = api.post("/api/goals", """
                {"title":"Plan","kind":"MEAL_PLAN","targetValue":120}""");
        assertThat(JsonPath.<String>read(plan.body(), "$.errors.targetValue")).startsWith("Indica un porcentaje");
        HttpResponse<String> exercise = api.post("/api/goals", """
                {"title":"Press","kind":"EXERCISE","targetValue":80,"exerciseId":"00000000-0000-0000-0000-000000000001"}""");
        assertThat(JsonPath.<String>read(exercise.body(), "$.errors.exerciseId")).isEqualTo("Elige un ejercicio");
        HttpResponse<String> past = api.post("/api/goals", """
                {"title":"Algo","kind":"CUSTOM","targetDate":"2026-10-01"}""");
        assertThat(JsonPath.<String>read(past.body(), "$.errors.targetDate")).isNotBlank();
    }

    @Test
    void statusIsSetByTheUser() {
        String id = JsonPath.read(api.post("/api/goals", """
                {"title":"Entrenar 3 días","kind":"TRAINING","targetValue":3}""").body(), "$.id");
        clock.set(Instant.parse("2026-11-20T10:00:00Z"));
        HttpResponse<String> achieved = api.put("/api/goals/" + id, """
                {"title":"Entrenar 3 días","kind":"TRAINING","targetValue":3,"status":"ACHIEVED"}""");
        assertThat(JsonPath.<String>read(achieved.body(), "$.status")).isEqualTo("ACHIEVED");
        assertThat(JsonPath.<String>read(achieved.body(), "$.achievedOn")).isEqualTo("2026-11-20");
        HttpResponse<String> reopened = api.put("/api/goals/" + id, """
                {"title":"Entrenar 3 días","kind":"TRAINING","targetValue":3,"status":"ACTIVE"}""");
        assertThat(JsonPath.<Object>read(reopened.body(), "$.achievedOn")).isNull();

        assertThat(api.delete("/api/goals/" + id).statusCode()).isEqualTo(204);
        assertThat(new ApiClient(port).get("/api/goals").statusCode()).isEqualTo(401);
        assertThat(api.delete("/api/goals/" + id).statusCode()).isEqualTo(404);
    }
}
