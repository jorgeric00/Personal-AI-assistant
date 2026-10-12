package com.lifeos.fitness;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.List;
import java.util.Map;

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
class WorkoutIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;
    private String squat;
    private String plank;
    private String routineId;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from workout");
        jdbc.update("delete from routine");
        jdbc.update("delete from exercise");
        jdbc.update("delete from fitness_settings");
        clock.set(Instant.parse("2026-10-11T10:00:00Z"));
        api = new ApiClient(port).login();
        String exercises = api.get("/api/fitness/exercises").body();
        squat = JsonPath.<List<String>>read(exercises, "$[?(@.name == 'Sentadilla con barra')].id").getFirst();
        plank = JsonPath.<List<String>>read(exercises, "$[?(@.name == 'Plancha')].id").getFirst();
        routineId = JsonPath.read(api.post("/api/fitness/routines", """
                {"name":"Piernas","exercises":[
                  {"exerciseId":"%s","sets":3,"repsMin":6,"repsMax":8,"weightKg":60,"restSeconds":120},
                  {"exerciseId":"%s","sets":2,"durationSeconds":45}
                ]}
                """.formatted(squat, plank)).body(), "$.id");
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    /** Cuerpo de PUT que conserva el objetivo y anota las series indicadas. */
    private String body(String date, boolean finished, String squatSets, String plankSets) {
        return """
                {"name":"Piernas","date":"%s","finished":%s,"exercises":[
                  {"exerciseId":"%s","targetSets":3,"targetRepsMin":6,"targetRepsMax":8,"targetWeightKg":60,
                   "restSeconds":120,"sets":[%s]},
                  {"exerciseId":"%s","targetSets":2,"targetDurationSeconds":45,"sets":[%s]}
                ]}
                """.formatted(date, finished, squat, squatSets, plank, plankSets);
    }

    @Test
    void startingFromARoutineCopiesTargetsWithEmptySetsThatAreNotDone() {
        HttpResponse<String> started = api.post("/api/fitness/workouts", "{\"routineId\":\"" + routineId + "\"}");
        assertThat(started.statusCode()).as(started.body()).isEqualTo(201);
        assertThat(JsonPath.<String>read(started.body(), "$.name")).isEqualTo("Piernas");
        assertThat(JsonPath.<String>read(started.body(), "$.date")).isEqualTo("2026-10-11");
        assertThat(JsonPath.<Boolean>read(started.body(), "$.finished")).isFalse();
        assertThat(JsonPath.<Integer>read(started.body(), "$.exercises[0].targetRepsMax")).isEqualTo(8);
        assertThat(JsonPath.<List<Boolean>>read(started.body(), "$.exercises[0].sets[*].done"))
                .containsExactly(false, false, false);
        assertThat(JsonPath.<Object>read(started.body(), "$.exercises[0].previous")).isNull();

        // Sin series hechas no se puede terminar: planificar no es haber entrenado
        String id = JsonPath.read(started.body(), "$.id");
        HttpResponse<String> empty = api.put("/api/fitness/workouts/" + id,
                body("2026-10-11", true, "{\"reps\":8,\"weightKg\":60}", ""));
        assertThat(empty.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(empty.body(), "$.errors.exercises"))
                .isEqualTo("Marca al menos una serie como hecha para terminar el entrenamiento");

        HttpResponse<String> blankDone = api.put("/api/fitness/workouts/" + id,
                body("2026-10-11", false, "{\"weightKg\":60,\"done\":true}", ""));
        assertThat(JsonPath.<String>read(blankDone.body(), "$.errors['exercises[0].sets[0]']"))
                .startsWith("Anota repeticiones");

        HttpResponse<String> free = api.post("/api/fitness/workouts", "{}");
        assertThat(JsonPath.<String>read(free.body(), "$.name")).isEqualTo("Entrenamiento libre");
        assertThat(JsonPath.<List<Object>>read(free.body(), "$.exercises")).isEmpty();
        assertThat(api.post("/api/fitness/workouts", "{\"date\":\"2026-10-12\"}").statusCode()).isEqualTo(400);
    }

    @Test
    void finishedWorkoutsFeedHistoryPreviousResultsAndRecords() {
        // Sesión pasada, registrada a posteriori
        String past = JsonPath.read(api.post("/api/fitness/workouts",
                "{\"routineId\":\"" + routineId + "\",\"date\":\"2026-10-06\"}").body(), "$.id");
        HttpResponse<String> saved = api.put("/api/fitness/workouts/" + past, body("2026-10-06", true,
                """
                {"reps":8,"weightKg":60,"done":true},{"reps":7,"weightKg":60,"done":true},{"reps":6,"weightKg":62.5,"done":false}
                """, "{\"durationSeconds\":40,\"done\":true}"));
        assertThat(saved.statusCode()).as(saved.body()).isEqualTo(200);
        assertThat(JsonPath.<Boolean>read(saved.body(), "$.finished")).isTrue();
        assertThat(JsonPath.<String>read(saved.body(), "$.finishedAt")).isEqualTo("2026-10-11T10:00:00Z");

        // La sesión de hoy muestra lo hecho la última vez (solo las series hechas)
        HttpResponse<String> today = api.post("/api/fitness/workouts", "{\"routineId\":\"" + routineId + "\"}");
        String todayId = JsonPath.read(today.body(), "$.id");
        assertThat(JsonPath.<String>read(today.body(), "$.exercises[0].previous.date")).isEqualTo("2026-10-06");
        assertThat(JsonPath.<List<Integer>>read(today.body(), "$.exercises[0].previous.sets[*].reps"))
                .containsExactly(8, 7);
        assertThat(JsonPath.<List<Integer>>read(today.body(), "$.exercises[1].previous.sets[*].durationSeconds"))
                .containsExactly(40);

        // En curso: no cuenta para récords
        api.put("/api/fitness/workouts/" + todayId, body("2026-10-11", false,
                "{\"reps\":5,\"weightKg\":70,\"done\":true}", ""));
        List<Map<String, Object>> records = JsonPath.read(api.get("/api/fitness/records").body(), "$");
        assertThat(records).extracting(r -> r.get("exerciseName")).containsExactly("Plancha", "Sentadilla con barra");
        Map<String, Object> squatRecord = records.get(1);
        assertThat(squatRecord.get("bestWeightKg")).isEqualTo(60.0);
        assertThat(squatRecord.get("bestWeightReps")).isEqualTo(8);
        assertThat(squatRecord.get("bestWeightDate")).isEqualTo("2026-10-06");
        assertThat(records.get(0).get("longestDurationSeconds")).isEqualTo(40);

        clock.set(Instant.parse("2026-10-11T11:00:00Z"));
        api.put("/api/fitness/workouts/" + todayId, body("2026-10-11", true,
                "{\"reps\":5,\"weightKg\":70,\"done\":true}", ""));
        squatRecord = JsonPath.<List<Map<String, Object>>>read(api.get("/api/fitness/records").body(), "$").get(1);
        assertThat(squatRecord.get("bestWeightKg")).isEqualTo(70.0);
        assertThat(squatRecord.get("bestReps")).isEqualTo(8);
        assertThat(squatRecord.get("sessions")).isEqualTo(2);

        HttpResponse<String> list = api.get("/api/fitness/workouts");
        assertThat(JsonPath.<List<String>>read(list.body(), "$[*].date")).containsExactly("2026-10-11", "2026-10-06");
        assertThat(JsonPath.<List<Integer>>read(list.body(), "$[*].doneSets")).containsExactly(1, 3);
        assertThat(JsonPath.<List<Integer>>read(list.body(), "$[*].exerciseCount")).containsExactly(2, 2);
        assertThat(JsonPath.<List<Boolean>>read(list.body(), "$[*].finished")).containsExactly(true, true);

        // Un ejercicio usado en un entrenamiento queda protegido aunque se borre la rutina
        assertThat(api.delete("/api/fitness/routines/" + routineId).statusCode()).isEqualTo(204);
        assertThat(api.delete("/api/fitness/exercises/" + plank).statusCode()).isEqualTo(409);
        HttpResponse<String> kept = api.get("/api/fitness/workouts/" + past);
        assertThat(JsonPath.<Object>read(kept.body(), "$.routineId")).isNull();

        // Reabrir un entrenamiento lo saca de los récords
        api.put("/api/fitness/workouts/" + todayId, body("2026-10-11", false,
                "{\"reps\":5,\"weightKg\":70,\"done\":true}", ""));
        squatRecord = JsonPath.<List<Map<String, Object>>>read(api.get("/api/fitness/records").body(), "$").get(1);
        assertThat(squatRecord.get("bestWeightKg")).isEqualTo(60.0);
        assertThat(api.delete("/api/fitness/workouts/" + todayId).statusCode()).isEqualTo(204);
        assertThat(api.get("/api/fitness/workouts/" + todayId).statusCode()).isEqualTo(404);
    }
}
