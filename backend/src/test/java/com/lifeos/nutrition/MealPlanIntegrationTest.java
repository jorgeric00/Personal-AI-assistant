package com.lifeos.nutrition;

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
class MealPlanIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from planned_meal");
        jdbc.update("delete from food_entry");
        jdbc.update("delete from saved_meal");
        // Lunes 12 de octubre de 2026
        clock.set(Instant.parse("2026-10-12T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    private String savedMeal() {
        HttpResponse<String> saved = api.post("/api/nutrition/saved-meals", """
                {"name":"Pollo con arroz","meal":"LUNCH","items":[
                  {"name":"Pollo","quantity":150,"unit":"g","calories":250,"proteinG":45},
                  {"name":"Arroz","quantity":80,"unit":"g","calories":290,"estimated":true}]}""");
        assertThat(saved.statusCode()).as(saved.body()).isEqualTo(201);
        return JsonPath.read(saved.body(), "$.id");
    }

    private HttpResponse<String> plan(String json) {
        return api.post("/api/nutrition/plan", json);
    }

    @Test
    void plannedMealsAreNotFoodUntilLogged() {
        String saved = savedMeal();
        HttpResponse<String> lunch = plan("""
                {"date":"2026-10-12","meal":"LUNCH","savedMealId":"%s","prepDate":"2026-10-11"}""".formatted(saved));
        assertThat(lunch.statusCode()).as(lunch.body()).isEqualTo(201);
        // Sin título: toma el de la comida habitual
        assertThat(JsonPath.<String>read(lunch.body(), "$.title")).isEqualTo("Pollo con arroz");
        plan("""
                {"date":"2026-10-12","meal":"BREAKFAST","title":"Tostadas","notes":"  integrales "}""");
        plan("""
                {"date":"2026-10-14","meal":"DINNER","title":"Crema de verduras"}""");

        HttpResponse<String> week = api.get("/api/nutrition/plan?from=2026-10-12&to=2026-10-18");
        assertThat(JsonPath.<List<String>>read(week.body(), "$[*].title"))
                .containsExactly("Tostadas", "Pollo con arroz", "Crema de verduras");
        assertThat(JsonPath.<String>read(week.body(), "$[0].notes")).isEqualTo("integrales");

        // Planificar no registra nada en el diario
        HttpResponse<String> day = api.get("/api/nutrition/days/2026-10-12");
        assertThat(JsonPath.<Integer>read(day.body(), "$.totals.entries")).isZero();

        String lunchId = JsonPath.read(lunch.body(), "$.id");
        HttpResponse<String> logged = api.post("/api/nutrition/plan/" + lunchId + "/log", "{}");
        assertThat(logged.statusCode()).as(logged.body()).isEqualTo(200);
        assertThat(JsonPath.<Boolean>read(logged.body(), "$.logged")).isTrue();
        day = api.get("/api/nutrition/days/2026-10-12");
        assertThat(JsonPath.<Integer>read(day.body(), "$.totals.calories")).isEqualTo(540);
        assertThat(JsonPath.<List<String>>read(day.body(), "$.meals[1].entries[*].food.name"))
                .containsExactly("Pollo", "Arroz");
        assertThat(JsonPath.<List<String>>read(day.body(), "$.totals.estimatedFields")).containsExactly("calories");

        // Dos veces no
        assertThat(api.post("/api/nutrition/plan/" + lunchId + "/log", "{}").statusCode()).isEqualTo(409);

        // Sin comida habitual se anota solo el título, sin nutrientes inventados
        String breakfastId = JsonPath.read(week.body(), "$[0].id");
        api.post("/api/nutrition/plan/" + breakfastId + "/log", "{}");
        day = api.get("/api/nutrition/days/2026-10-12");
        assertThat(JsonPath.<String>read(day.body(), "$.meals[0].entries[0].food.name")).isEqualTo("Tostadas");
        assertThat(JsonPath.<Object>read(day.body(), "$.meals[0].entries[0].food.calories")).isNull();

        // Lo de días futuros no pasa al diario
        String dinnerId = JsonPath.read(week.body(), "$[2].id");
        HttpResponse<String> future = api.post("/api/nutrition/plan/" + dinnerId + "/log", "{}");
        assertThat(future.statusCode()).isEqualTo(400);
        assertThat(future.body()).contains("hoy o días anteriores");
    }

    @Test
    void validatesTitlePrepDateAndSavedMeal() {
        HttpResponse<String> empty = plan("""
                {"date":"2026-10-13","meal":"LUNCH","title":"  "}""");
        assertThat(empty.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(empty.body(), "$.errors.title")).isNotBlank();

        HttpResponse<String> prepAfter = plan("""
                {"date":"2026-10-13","meal":"LUNCH","title":"Lentejas","prepDate":"2026-10-14"}""");
        assertThat(prepAfter.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(prepAfter.body(), "$.errors.prepDate")).isNotBlank();

        HttpResponse<String> missing = plan("""
                {"date":"2026-10-13","meal":"LUNCH","savedMealId":"00000000-0000-0000-0000-000000000001"}""");
        assertThat(missing.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(missing.body(), "$.errors.savedMealId")).isNotBlank();
    }

    @Test
    void prepCanBeCheckedAndWeeksCopied() {
        String saved = savedMeal();
        HttpResponse<String> lentils = plan("""
                {"date":"2026-10-14","meal":"LUNCH","title":"Lentejas","prepDate":"2026-10-11"}""");
        String id = JsonPath.read(lentils.body(), "$.id");
        HttpResponse<String> prepared = api.put("/api/nutrition/plan/" + id + "/prepared", "{\"prepared\":true}");
        assertThat(JsonPath.<Boolean>read(prepared.body(), "$.prepared")).isTrue();
        // Quitar el día de preparación la desmarca
        HttpResponse<String> updated = api.put("/api/nutrition/plan/" + id, """
                {"date":"2026-10-14","meal":"LUNCH","title":"Lentejas"}""");
        assertThat(JsonPath.<Boolean>read(updated.body(), "$.prepared")).isFalse();
        api.put("/api/nutrition/plan/" + id, """
                {"date":"2026-10-14","meal":"LUNCH","title":"Lentejas","prepDate":"2026-10-11"}""");
        api.put("/api/nutrition/plan/" + id + "/prepared", "{\"prepared\":true}");
        plan("""
                {"date":"2026-10-12","meal":"LUNCH","savedMealId":"%s"}""".formatted(saved));

        HttpResponse<String> copied = api.post("/api/nutrition/plan/copy-week",
                "{\"from\":\"2026-10-12\",\"to\":\"2026-10-19\"}");
        assertThat(copied.statusCode()).as(copied.body()).isEqualTo(200);
        assertThat(JsonPath.<List<String>>read(copied.body(), "$[*].date")).containsExactly("2026-10-19", "2026-10-21");
        assertThat(JsonPath.<String>read(copied.body(), "$[1].prepDate")).isEqualTo("2026-10-18");
        assertThat(JsonPath.<Boolean>read(copied.body(), "$[1].prepared")).isFalse();
        assertThat(JsonPath.<String>read(copied.body(), "$[0].savedMealId")).isEqualTo(saved);

        assertThat(api.post("/api/nutrition/plan/copy-week", "{\"from\":\"2026-10-12\",\"to\":\"2026-10-12\"}")
                .statusCode()).isEqualTo(400);

        // Borrar la comida habitual deja el plan con su título
        api.delete("/api/nutrition/saved-meals/" + saved);
        HttpResponse<String> week = api.get("/api/nutrition/plan?from=2026-10-12&to=2026-10-18");
        assertThat(JsonPath.<Object>read(week.body(), "$[0].savedMealId")).isNull();
        assertThat(JsonPath.<String>read(week.body(), "$[0].title")).isEqualTo("Pollo con arroz");
    }

    @Test
    void plansAreOwnedAndRangeIsLimited() {
        assertThat(new ApiClient(port).get("/api/nutrition/plan?from=2026-10-12&to=2026-10-18").statusCode())
                .isEqualTo(401);
        assertThat(api.get("/api/nutrition/plan?from=2026-10-01&to=2026-11-15").statusCode()).isEqualTo(400);
        assertThat(api.put("/api/nutrition/plan/00000000-0000-0000-0000-000000000001/prepared",
                "{\"prepared\":true}").statusCode()).isEqualTo(404);
    }
}
