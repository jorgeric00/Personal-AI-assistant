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
class FitnessIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from body_measurement");
        jdbc.update("delete from fitness_profile");
        clock.set(Instant.parse("2026-10-11T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    @Test
    void requiresSession() {
        assertThat(new ApiClient(port).get("/api/fitness/profile").statusCode()).isEqualTo(401);
    }

    @Test
    void emptyProfileAssumesNothingAndCanBeFilledPartially() {
        HttpResponse<String> empty = api.get("/api/fitness/profile");
        assertThat(empty.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<Object>read(empty.body(), "$.age")).isNull();
        assertThat(JsonPath.<Object>read(empty.body(), "$.goal")).isNull();
        assertThat(JsonPath.<Object>read(empty.body(), "$.currentWeightKg")).isNull();

        HttpResponse<String> saved = api.put("/api/fitness/profile", """
                {"birthDate":"1990-10-12","heightCm":178.5,"startWeightKg":82.4,"goal":"LOSE_FAT",
                 "daysPerWeek":3,"equipment":"  Mancuernas, banda elástica  ","foodAvoid":"   "}
                """);
        assertThat(saved.statusCode()).as(saved.body()).isEqualTo(200);
        // Cumple 36 al día siguiente
        assertThat(JsonPath.<Integer>read(saved.body(), "$.age")).isEqualTo(35);
        assertThat(JsonPath.<Double>read(saved.body(), "$.heightCm")).isEqualTo(178.5);
        assertThat(JsonPath.<Double>read(saved.body(), "$.currentWeightKg")).isEqualTo(82.4);
        assertThat(JsonPath.<String>read(saved.body(), "$.equipment")).isEqualTo("Mancuernas, banda elástica");
        assertThat(JsonPath.<Object>read(saved.body(), "$.foodAvoid")).isNull();
        assertThat(JsonPath.<Object>read(saved.body(), "$.experience")).isNull();
    }

    @Test
    void rejectsOutOfRangeValuesWithFieldMessages() {
        HttpResponse<String> response = api.put("/api/fitness/profile", """
                {"heightCm":17.85,"daysPerWeek":9,"birthDate":"2030-01-01"}
                """);
        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(response.body(), "$.errors.heightCm")).contains("50 y 260");
        assertThat(JsonPath.<String>read(response.body(), "$.errors.daysPerWeek")).contains("0 y 7");

        HttpResponse<String> measurement = api.post("/api/fitness/measurements", """
                {"date":"2026-10-11","weightKg":80.123}
                """);
        assertThat(measurement.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(measurement.body(), "$.errors.weightKg")).contains("dos decimales");
    }

    @Test
    void measurementsAreOptionalPerFieldAndOnePerDay() {
        HttpResponse<String> first = api.post("/api/fitness/measurements", """
                {"date":"2026-09-01","weightKg":82.4,"waistCm":94}
                """);
        assertThat(first.statusCode()).as(first.body()).isEqualTo(201);
        HttpResponse<String> second = api.post("/api/fitness/measurements", """
                {"date":"2026-10-01","waistCm":91.5,"notes":"Duermo mejor"}
                """);
        assertThat(second.statusCode()).as(second.body()).isEqualTo(201);
        HttpResponse<String> third = api.post("/api/fitness/measurements", """
                {"date":"2026-10-10","weightKg":80.9,"bodyFatPct":21.5}
                """);
        assertThat(third.statusCode()).isEqualTo(201);

        // Mismo día: conflicto, se edita el existente
        HttpResponse<String> duplicate = api.post("/api/fitness/measurements", """
                {"date":"2026-10-10","weightKg":81}
                """);
        assertThat(duplicate.statusCode()).isEqualTo(409);
        assertThat(JsonPath.<String>read(duplicate.body(), "$.title")).isEqualTo("Ya hay un registro ese día");

        HttpResponse<String> empty = api.post("/api/fitness/measurements", """
                {"date":"2026-10-11","notes":"  "}
                """);
        assertThat(empty.statusCode()).isEqualTo(400);
        HttpResponse<String> future = api.post("/api/fitness/measurements", """
                {"date":"2026-10-12","weightKg":80}
                """);
        assertThat(JsonPath.<String>read(future.body(), "$.errors.date")).isEqualTo("La fecha no puede ser futura");

        HttpResponse<String> list = api.get("/api/fitness/measurements");
        assertThat(JsonPath.<List<String>>read(list.body(), "$[*].date")).containsExactly("2026-10-10", "2026-10-01",
                "2026-09-01");
        assertThat(JsonPath.<Object>read(list.body(), "$[1].weightKg")).isNull();

        // El peso actual es el del último registro con peso
        HttpResponse<String> profile = api.get("/api/fitness/profile");
        assertThat(JsonPath.<Double>read(profile.body(), "$.currentWeightKg")).isEqualTo(80.9);
        assertThat(JsonPath.<String>read(profile.body(), "$.currentWeightDate")).isEqualTo("2026-10-10");

        // Mover un registro a una fecha ocupada no se permite; editarlo y borrarlo sí
        String id = JsonPath.read(second.body(), "$.id");
        assertThat(api.put("/api/fitness/measurements/" + id, """
                {"date":"2026-09-01","waistCm":91.5}
                """).statusCode()).isEqualTo(409);
        HttpResponse<String> edited = api.put("/api/fitness/measurements/" + id, """
                {"date":"2026-10-02","waistCm":91}
                """);
        assertThat(edited.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<Object>read(edited.body(), "$.notes")).isNull();
        assertThat(api.delete("/api/fitness/measurements/" + JsonPath.read(third.body(), "$.id")).statusCode())
                .isEqualTo(204);
        profile = api.get("/api/fitness/profile");
        assertThat(JsonPath.<Double>read(profile.body(), "$.currentWeightKg")).isEqualTo(82.4);
    }
}
