package com.lifeos.fitness;

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
class TrainingIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from workout");
        jdbc.update("delete from routine");
        jdbc.update("delete from exercise");
        jdbc.update("delete from fitness_settings");
        clock.set(Instant.parse("2026-10-11T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    private String exerciseId(String body, String name) {
        return JsonPath.<List<String>>read(body, "$[?(@.name == '" + name + "')].id").getFirst();
    }

    @Test
    void requiresSession() {
        assertThat(new ApiClient(port).get("/api/fitness/exercises").statusCode()).isEqualTo(401);
        assertThat(new ApiClient(port).get("/api/fitness/routines").statusCode()).isEqualTo(401);
    }

    @Test
    void catalogIsSeededOnceInTheUserLanguageAndIsEditable() {
        HttpResponse<String> list = api.get("/api/fitness/exercises");
        assertThat(list.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<List<Object>>read(list.body(), "$")).hasSize(ExerciseSetupService.DEFAULTS.size());
        String plank = exerciseId(list.body(), "Plancha");
        assertThat(JsonPath.<List<String>>read(list.body(), "$[?(@.name == 'Plancha')].type")).containsExactly("TIMED");
        assertThat(JsonPath.<List<String>>read(list.body(), "$[?(@.name == 'Plancha')].safety").getFirst())
                .contains("cadera");
        assertThat(JsonPath.<List<Object>>read(list.body(), "$[?(@.name == 'Sentadilla')].equipment").getFirst())
                .isNull();

        // Borrar uno de los iniciales no lo vuelve a crear
        assertThat(api.delete("/api/fitness/exercises/" + plank).statusCode()).isEqualTo(204);
        assertThat(JsonPath.<List<Object>>read(api.get("/api/fitness/exercises").body(), "$"))
                .hasSize(ExerciseSetupService.DEFAULTS.size() - 1);

        HttpResponse<String> created = api.post("/api/fitness/exercises", """
                {"name":"  Hip thrust  ","muscleGroup":"LEGS","type":"STRENGTH","equipment":"Barra","safety":" "}
                """);
        assertThat(created.statusCode()).as(created.body()).isEqualTo(201);
        assertThat(JsonPath.<String>read(created.body(), "$.name")).isEqualTo("Hip thrust");
        assertThat(JsonPath.<Object>read(created.body(), "$.safety")).isNull();

        HttpResponse<String> duplicate = api.post("/api/fitness/exercises", """
                {"name":"sentadilla","muscleGroup":"LEGS","type":"BODYWEIGHT"}
                """);
        assertThat(duplicate.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(duplicate.body(), "$.errors.name"))
                .isEqualTo("Ya tienes un ejercicio con ese nombre");

        HttpResponse<String> missing = api.post("/api/fitness/exercises", "{\"name\":\"X\"}");
        assertThat(JsonPath.<String>read(missing.body(), "$.errors.muscleGroup")).isEqualTo("Elige el grupo muscular");

        String id = JsonPath.read(created.body(), "$.id");
        HttpResponse<String> archived = api.put("/api/fitness/exercises/" + id, """
                {"name":"Hip thrust","muscleGroup":"LEGS","type":"STRENGTH","archived":true}
                """);
        assertThat(JsonPath.<Boolean>read(archived.body(), "$.archived")).isTrue();
        assertThat(JsonPath.<Object>read(archived.body(), "$.equipment")).isNull();
    }

    @Test
    void routinesKeepOrderTargetsAndWeekdaysAndProtectTheirExercises() {
        String exercises = api.get("/api/fitness/exercises").body();
        String squat = exerciseId(exercises, "Sentadilla con barra");
        String pushUp = exerciseId(exercises, "Flexiones");
        String running = exerciseId(exercises, "Correr");

        HttpResponse<String> created = api.post("/api/fitness/routines", """
                {"name":"Cuerpo completo","weekdays":["THURSDAY","MONDAY"],"exercises":[
                  {"exerciseId":"%s","sets":4,"repsMin":6,"repsMax":8,"weightKg":60.5,"restSeconds":120},
                  {"exerciseId":"%s","sets":3,"repsMin":10,"notes":"  Hasta el fallo técnico  "},
                  {"exerciseId":"%s","sets":1,"durationSeconds":1200,"distanceKm":3.5}
                ]}
                """.formatted(squat, pushUp, running));
        assertThat(created.statusCode()).as(created.body()).isEqualTo(201);
        assertThat(JsonPath.<List<String>>read(created.body(), "$.weekdays")).containsExactly("MONDAY", "THURSDAY");
        assertThat(JsonPath.<List<String>>read(created.body(), "$.exercises[*].exercise.name"))
                .containsExactly("Sentadilla con barra", "Flexiones", "Correr");
        assertThat(JsonPath.<Double>read(created.body(), "$.exercises[0].weightKg")).isEqualTo(60.5);
        assertThat(JsonPath.<String>read(created.body(), "$.exercises[1].notes")).isEqualTo("Hasta el fallo técnico");
        assertThat(JsonPath.<Object>read(created.body(), "$.exercises[1].repsMax")).isNull();

        // El ejercicio queda en uso: no se borra, se archiva
        assertThat(JsonPath.<List<Boolean>>read(api.get("/api/fitness/exercises").body(),
                "$[?(@.name == 'Flexiones')].inUse")).containsExactly(true);
        HttpResponse<String> inUse = api.delete("/api/fitness/exercises/" + pushUp);
        assertThat(inUse.statusCode()).isEqualTo(409);
        assertThat(JsonPath.<String>read(inUse.body(), "$.title")).isEqualTo("Ejercicio en uso");

        // Reordenar y quitar ejercicios
        String id = JsonPath.read(created.body(), "$.id");
        HttpResponse<String> updated = api.put("/api/fitness/routines/" + id, """
                {"name":"Cuerpo completo","weekdays":[],"exercises":[
                  {"exerciseId":"%s","sets":3,"repsMin":12},
                  {"exerciseId":"%s","sets":5,"repsMin":5,"repsMax":5,"weightKg":62.5}
                ]}
                """.formatted(pushUp, squat));
        assertThat(updated.statusCode()).as(updated.body()).isEqualTo(200);
        assertThat(JsonPath.<List<String>>read(updated.body(), "$.exercises[*].exercise.name"))
                .containsExactly("Flexiones", "Sentadilla con barra");
        assertThat(JsonPath.<List<Object>>read(updated.body(), "$.weekdays")).isEmpty();
        assertThat(api.delete("/api/fitness/exercises/" + running).statusCode()).isEqualTo(204);

        HttpResponse<String> list = api.get("/api/fitness/routines");
        assertThat(JsonPath.<List<Object>>read(list.body(), "$")).hasSize(1);
        assertThat(JsonPath.<Integer>read(list.body(), "$[0].exercises[1].sets")).isEqualTo(5);

        // Borrar la rutina libera sus ejercicios
        assertThat(api.delete("/api/fitness/routines/" + id).statusCode()).isEqualTo(204);
        assertThat(api.delete("/api/fitness/exercises/" + pushUp).statusCode()).isEqualTo(204);
    }

    @Test
    void routineValidation() {
        String squat = exerciseId(api.get("/api/fitness/exercises").body(), "Sentadilla");
        api.post("/api/fitness/routines", """
                {"name":"Piernas","exercises":[{"exerciseId":"%s","sets":3}]}
                """.formatted(squat));

        HttpResponse<String> response = api.post("/api/fitness/routines", """
                {"name":"piernas","exercises":[]}
                """);
        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(response.body(), "$.errors.name"))
                .isEqualTo("Ya tienes una rutina con ese nombre");
        assertThat(JsonPath.<String>read(response.body(), "$.errors.exercises")).isEqualTo("Añade al menos un ejercicio");

        HttpResponse<String> items = api.post("/api/fitness/routines", """
                {"name":"Otra","exercises":[
                  {"exerciseId":"%s","sets":0},
                  {"exerciseId":"%s","sets":3,"repsMin":12,"repsMax":8},
                  {"exerciseId":"00000000-0000-0000-0000-000000000001","sets":3}
                ]}
                """.formatted(squat, squat));
        assertThat(items.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(items.body(), "$.errors['exercises[0].sets']"))
                .isEqualTo("Elige entre 1 y 20 series");

        HttpResponse<String> range = api.post("/api/fitness/routines", """
                {"name":"Otra","exercises":[
                  {"exerciseId":"%s","sets":3,"repsMin":12,"repsMax":8},
                  {"exerciseId":"00000000-0000-0000-0000-000000000001","sets":3}
                ]}
                """.formatted(squat));
        assertThat(JsonPath.<String>read(range.body(), "$.errors['exercises[0].repsMax']"))
                .isEqualTo("El máximo no puede ser menor que el mínimo");
        assertThat(JsonPath.<String>read(range.body(), "$.errors['exercises[1].exerciseId']"))
                .isEqualTo("Elige un ejercicio");
    }
}
