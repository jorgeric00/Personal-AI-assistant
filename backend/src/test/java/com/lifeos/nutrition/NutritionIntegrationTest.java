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
class NutritionIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from food_entry");
        jdbc.update("delete from nutrition_day");
        jdbc.update("delete from nutrition_target");
        jdbc.update("delete from saved_meal");
        clock.set(Instant.parse("2026-10-12T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    private HttpResponse<String> add(String date, String meal, String food) {
        return api.post("/api/nutrition/entries", "{\"date\":\"%s\",\"meal\":\"%s\",\"food\":%s}".formatted(date, meal, food));
    }

    @Test
    void requiresSession() {
        assertThat(new ApiClient(port).get("/api/nutrition/days/2026-10-12").statusCode()).isEqualTo(401);
    }

    @Test
    void dayGroupsFoodByMealAndOnlyAddsWhatIsKnown() {
        HttpResponse<String> oats = add("2026-10-12", "BREAKFAST",
                "{\"name\":\"Avena\",\"quantity\":60,\"unit\":\"g\",\"calories\":230,\"proteinG\":8.1,\"carbsG\":39,\"fatG\":4.2}");
        assertThat(oats.statusCode()).as(oats.body()).isEqualTo(201);
        assertThat(JsonPath.<Boolean>read(oats.body(), "$.food.estimated")).isFalse();
        add("2026-10-12", "LUNCH",
                "{\"name\":\"Lentejas de casa\",\"quantity\":1,\"unit\":\"plato\",\"calories\":450,\"proteinG\":22,\"estimated\":true}");
        // Sin nutrientes: se registra, no suma y no puede ser «estimado»
        HttpResponse<String> fruit = add("2026-10-12", "SNACK", "{\"name\":\"Manzana\",\"unit\":\"g\",\"estimated\":true}");
        assertThat(JsonPath.<Boolean>read(fruit.body(), "$.food.estimated")).isFalse();
        assertThat(JsonPath.<Object>read(fruit.body(), "$.food.unit")).isNull();
        add("2026-10-11", "DINNER", "{\"name\":\"Tortilla\",\"calories\":300}");

        api.put("/api/nutrition/days/2026-10-12/water", "{\"waterMl\":1500}");
        api.put("/api/nutrition/days/2026-10-12/notes", "{\"meal\":\"LUNCH\",\"note\":\"  Con prisa  \"}");
        api.put("/api/nutrition/targets", "{\"calories\":2200,\"proteinG\":120,\"waterMl\":2000}");

        String day = api.get("/api/nutrition/days/2026-10-12").body();
        assertThat(JsonPath.<List<String>>read(day, "$.meals[*].meal")).containsExactly("BREAKFAST", "LUNCH", "DINNER",
                "SNACK");
        assertThat(JsonPath.<String>read(day, "$.meals[1].note")).isEqualTo("Con prisa");
        assertThat(JsonPath.<List<Object>>read(day, "$.meals[2].entries")).isEmpty();
        assertThat(JsonPath.<Integer>read(day, "$.totals.calories")).isEqualTo(680);
        assertThat(JsonPath.<Double>read(day, "$.totals.proteinG")).isEqualTo(30.1);
        assertThat(JsonPath.<Double>read(day, "$.totals.carbsG")).isEqualTo(39.0);
        assertThat(JsonPath.<Integer>read(day, "$.totals.entries")).isEqualTo(3);
        assertThat(JsonPath.<Integer>read(day, "$.totals.withoutCalories")).isEqualTo(1);
        assertThat(JsonPath.<Boolean>read(day, "$.totals.estimated")).isTrue();
        assertThat(JsonPath.<Boolean>read(day, "$.meals[0].totals.estimated")).isFalse();
        assertThat(JsonPath.<Integer>read(day, "$.waterMl")).isEqualTo(1500);
        assertThat(JsonPath.<Integer>read(day, "$.target.calories")).isEqualTo(2200);
        assertThat(JsonPath.<Object>read(day, "$.target.fatG")).isNull();

        String summary = api.get("/api/nutrition/summary?from=2026-10-10&to=2026-10-12").body();
        assertThat(JsonPath.<List<Integer>>read(summary, "$.days[*].totals.calories")).containsExactly(0, 300, 680);
        assertThat(JsonPath.<List<Integer>>read(summary, "$.days[*].waterMl")).containsExactly(0, 0, 1500);
        assertThat(JsonPath.<Integer>read(summary, "$.target.waterMl")).isEqualTo(2000);
        assertThat(api.get("/api/nutrition/summary?from=2026-09-01&to=2026-10-12").statusCode()).isEqualTo(400);

        // Editar y borrar
        String id = JsonPath.read(oats.body(), "$.id");
        HttpResponse<String> edited = api.put("/api/nutrition/entries/" + id, """
                {"date":"2026-10-12","meal":"BREAKFAST","food":{"name":"Avena","quantity":80,"unit":"g","calories":307}}
                """);
        assertThat(JsonPath.<Integer>read(edited.body(), "$.food.calories")).isEqualTo(307);
        assertThat(api.delete("/api/nutrition/entries/" + id).statusCode()).isEqualTo(204);
        assertThat(JsonPath.<Integer>read(api.get("/api/nutrition/days/2026-10-12").body(), "$.totals.calories"))
                .isEqualTo(450);
    }

    @Test
    void rejectsFutureDaysAndInvalidValues() {
        HttpResponse<String> future = add("2026-10-13", "LUNCH", "{\"name\":\"Pasta\"}");
        assertThat(future.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(future.body(), "$.errors.date")).startsWith("El diario es de lo que ya has comido");
        HttpResponse<String> invalid = add("2026-10-12", "LUNCH", "{\"name\":\" \",\"calories\":-5,\"proteinG\":1.25}");
        assertThat(JsonPath.<String>read(invalid.body(), "$.errors['food.name']")).isEqualTo("Escribe qué has comido");
        assertThat(JsonPath.<String>read(invalid.body(), "$.errors['food.calories']")).startsWith("Las calorías");
        assertThat(JsonPath.<String>read(invalid.body(), "$.errors['food.proteinG']")).isEqualTo("Como mucho un decimal");
        // Quitar un objetivo es dejarlo vacío
        api.put("/api/nutrition/targets", "{\"calories\":2200}");
        assertThat(JsonPath.<Object>read(api.put("/api/nutrition/targets", "{}").body(), "$.calories")).isNull();
    }

    @Test
    void savedMealsAreCopiedIntoTheDayAndThenIndependent() {
        HttpResponse<String> created = api.post("/api/nutrition/saved-meals", """
                {"name":"Desayuno de diario","meal":"BREAKFAST","items":[
                  {"name":"Café con leche","calories":60,"estimated":true},
                  {"name":"Tostada con tomate","quantity":2,"unit":"rebanadas","calories":220}]}
                """);
        assertThat(created.statusCode()).as(created.body()).isEqualTo(201);
        assertThat(JsonPath.<Integer>read(created.body(), "$.totals.calories")).isEqualTo(280);
        String id = JsonPath.read(created.body(), "$.id");
        assertThat(api.post("/api/nutrition/saved-meals", "{\"name\":\"desayuno de diario\",\"items\":[{\"name\":\"x\"}]}")
                .statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(api.post("/api/nutrition/saved-meals", "{\"name\":\"Vacía\",\"items\":[]}").body(),
                "$.errors.items")).isEqualTo("Añade al menos un alimento");

        HttpResponse<String> logged = api.post("/api/nutrition/saved-meals/" + id + "/log",
                "{\"date\":\"2026-10-12\",\"meal\":\"SNACK\"}");
        assertThat(logged.statusCode()).as(logged.body()).isEqualTo(200);
        assertThat(JsonPath.<List<String>>read(logged.body(), "$.meals[3].entries[*].food.name"))
                .containsExactly("Café con leche", "Tostada con tomate");
        assertThat(JsonPath.<List<Boolean>>read(logged.body(), "$.meals[3].entries[*].food.estimated"))
                .containsExactly(true, false);

        // Borrar la comida habitual no borra lo ya registrado
        assertThat(api.delete("/api/nutrition/saved-meals/" + id).statusCode()).isEqualTo(204);
        assertThat(JsonPath.<Integer>read(api.get("/api/nutrition/days/2026-10-12").body(), "$.totals.calories"))
                .isEqualTo(280);
        assertThat(JsonPath.<List<Object>>read(api.get("/api/nutrition/saved-meals").body(), "$")).isEmpty();
    }
}
