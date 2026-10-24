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
class CustomMetricIntegrationTest {

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
        jdbc.update("delete from custom_metric");
        clock.set(Instant.parse("2026-10-12T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    @Test
    void recordsOwnIndicatorsAlongsideMeasurements() {
        HttpResponse<String> pulse = api.post("/api/fitness/metrics", """
                {"name":" Pulso en reposo ","unit":"ppm","decimals":0}""");
        assertThat(pulse.statusCode()).as(pulse.body()).isEqualTo(201);
        String pulseId = JsonPath.read(pulse.body(), "$.id");
        assertThat(JsonPath.<String>read(pulse.body(), "$.name")).isEqualTo("Pulso en reposo");
        String sleepId = JsonPath.read(api.post("/api/fitness/metrics", """
                {"name":"Sueño","unit":"h","decimals":1}""").body(), "$.id");

        HttpResponse<String> duplicate = api.post("/api/fitness/metrics", """
                {"name":"pulso en REPOSO","decimals":0}""");
        assertThat(duplicate.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(duplicate.body(), "$.errors.name"))
                .isEqualTo("Ya tienes un indicador con ese nombre");
        assertThat(api.post("/api/fitness/metrics", "{\"name\":\"Energía\",\"decimals\":3}").statusCode())
                .isEqualTo(400);

        // Un registro solo con indicadores propios es válido; los vacíos se descartan
        HttpResponse<String> measurement = api.post("/api/fitness/measurements", """
                {"date":"2026-10-10","custom":{"%s":58,"%s":null}}""".formatted(pulseId, sleepId));
        assertThat(measurement.statusCode()).as(measurement.body()).isEqualTo(201);
        assertThat(JsonPath.<Integer>read(measurement.body(), "$.custom['" + pulseId + "']")).isEqualTo(58);
        assertThat(JsonPath.<Object>read(measurement.body(), "$.custom")).asString().doesNotContain(sleepId);

        // Decimales del indicador, indicadores ajenos o inexistentes
        HttpResponse<String> invalid = api.post("/api/fitness/measurements", """
                {"date":"2026-10-11","weightKg":80,"custom":{"%s":58.5,"%s":7.25,
                 "00000000-0000-0000-0000-000000000009":1}}""".formatted(pulseId, sleepId));
        assertThat(invalid.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(invalid.body(), "$.errors['custom." + pulseId + "']"))
                .isEqualTo("Usa un número entero");
        assertThat(JsonPath.<String>read(invalid.body(), "$.errors['custom." + sleepId + "']"))
                .isEqualTo("Usa como mucho un decimal");
        assertThat(JsonPath.<String>read(invalid.body(),
                "$.errors['custom.00000000-0000-0000-0000-000000000009']"))
                .isEqualTo("El indicador no existe o ya se ha borrado");

        String measurementId = JsonPath.read(measurement.body(), "$.id");
        HttpResponse<String> updated = api.put("/api/fitness/measurements/" + measurementId, """
                {"date":"2026-10-10","weightKg":80.2,"custom":{"%s":7.5}}""".formatted(sleepId));
        assertThat(updated.statusCode()).as(updated.body()).isEqualTo(200);
        assertThat(JsonPath.<Double>read(updated.body(), "$.custom['" + sleepId + "']")).isEqualTo(7.5);
        assertThat(JsonPath.<Object>read(updated.body(), "$.custom")).asString().doesNotContain(pulseId);

        // Archivar conserva los valores; borrar los elimina
        HttpResponse<String> archived = api.put("/api/fitness/metrics/" + sleepId, """
                {"name":"Sueño","unit":"h","decimals":1,"archived":true}""");
        assertThat(JsonPath.<Boolean>read(archived.body(), "$.archived")).isTrue();
        assertThat(JsonPath.<Double>read(api.get("/api/fitness/measurements").body(),
                "$[0].custom['" + sleepId + "']")).isEqualTo(7.5);
        assertThat(JsonPath.<List<String>>read(api.get("/api/fitness/metrics").body(), "$[*].name"))
                .containsExactly("Pulso en reposo", "Sueño");

        assertThat(api.delete("/api/fitness/metrics/" + sleepId).statusCode()).isEqualTo(204);
        assertThat(JsonPath.<Object>read(api.get("/api/fitness/measurements").body(), "$[0].custom"))
                .asString().isEqualTo("{}");
        assertThat(jdbc.queryForObject("select count(*) from custom_metric_value", Integer.class)).isZero();
    }
}
