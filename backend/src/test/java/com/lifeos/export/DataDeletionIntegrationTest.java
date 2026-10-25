package com.lifeos.export;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipInputStream;

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
class DataDeletionIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;
    private UUID user;

    @BeforeEach
    void setUp() {
        for (DataScope scope : DataScope.values()) {
            scope.tables().forEach(table -> jdbc.update("delete from " + table));
        }
        clock.set(Instant.parse("2026-10-22T10:00:00Z"));
        api = new ApiClient(port).login();
        user = jdbc.queryForObject("select id from app_user where email = ?", UUID.class, ApiClient.OWNER_EMAIL);
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    @Test
    void deletesOnlyTheChosenBlocksAfterCheckingThePassword() {
        assertThat(api.post("/api/tasks", """
                {"kind":"TASK","title":"Llamar al banco","priority":"LOW"}""").statusCode()).isEqualTo(201);
        assertThat(api.post("/api/notes", """
                {"title":"Ideas","body":"Viaje"}""").statusCode()).isEqualTo(201);
        String category = JsonPath.<List<String>>read(api.get("/api/finance/categories").body(),
                "$[?(@.kind == 'EXPENSE')].id").getFirst();
        assertThat(api.post("/api/finance/movements", """
                {"kind":"EXPENSE","amountCents":900,"date":"2026-10-21","categoryId":"%s"}""".formatted(category))
                .statusCode()).isEqualTo(201);
        jdbc.update("update finance_category set name = 'Comida renombrada' where id = ?::uuid", category);

        HttpResponse<String> wrong = api.post("/api/data/delete", """
                {"scopes":["TASKS","FINANCE"],"password":"no-es-esta"}""");
        assertThat(wrong.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(wrong.body(), "$.errors.password")).isEqualTo("La contraseña no es correcta");
        assertThat(count("task")).isEqualTo(1);

        HttpResponse<String> ok = api.post("/api/data/delete", """
                {"scopes":["TASKS","FINANCE"],"password":"%s"}""".formatted(ApiClient.OWNER_PASSWORD));
        assertThat(ok.statusCode()).as(ok.body()).isEqualTo(204);
        assertThat(count("task")).isZero();
        assertThat(count("finance_movement")).isZero();
        assertThat(count("note")).isEqualTo(1);
        // Finanzas vuelve a empezar con sus categorías iniciales
        assertThat(JsonPath.<List<String>>read(api.get("/api/finance/categories").body(), "$[*].name"))
                .isNotEmpty().doesNotContain("Comida renombrada");
    }

    @Test
    void deletingEverythingLeavesNoDataButKeepsTheAccount() throws IOException {
        assertThat(api.post("/api/habits", """
                {"name":"Leer","color":"#0f766e","frequency":"DAILY"}""").statusCode()).isEqualTo(201);
        assertThat(api.post("/api/fitness/measurements", """
                {"date":"2026-10-20","weightKg":80.5}""").statusCode()).isEqualTo(201);
        api.get("/api/fitness/exercises");
        api.get("/api/agenda/categories");

        String all = String.join("\",\"", java.util.Arrays.stream(DataScope.values()).map(Enum::name).toList());
        HttpResponse<String> response = api.post("/api/data/delete", """
                {"scopes":["%s"],"password":"%s"}""".formatted(all, ApiClient.OWNER_PASSWORD));
        assertThat(response.statusCode()).as(response.body()).isEqualTo(204);

        for (String table : DataExportService.TABLES.keySet()) {
            assertThat(rows(table)).as(table).isZero();
        }
        // La sesión y la cuenta siguen
        assertThat(api.get("/api/auth/me").statusCode()).isEqualTo(200);
        String data = exportedJson();
        assertThat(JsonPath.<Map<String, List<Object>>>read(data, "$.data").values()).allMatch(List::isEmpty);
    }

    @Test
    void validatesTheRequestAndLimitsFailedAttempts() {
        HttpResponse<String> empty = api.post("/api/data/delete", """
                {"scopes":[],"password":""}""");
        assertThat(empty.statusCode()).isEqualTo(400);
        assertThat(JsonPath.<Map<String, String>>read(empty.body(), "$.errors")).containsOnlyKeys("scopes", "password");
        assertThat(api.post("/api/data/delete", """
                {"scopes":["EVERYTHING"],"password":"x"}""").statusCode()).isEqualTo(400);

        for (int i = 0; i < 3; i++) {
            assertThat(api.post("/api/data/delete", """
                    {"scopes":["NOTES"],"password":"mal"}""").statusCode()).isEqualTo(400);
        }
        // Bloqueado aunque ahora la contraseña sea la buena
        assertThat(api.post("/api/data/delete", """
                {"scopes":["NOTES"],"password":"%s"}""".formatted(ApiClient.OWNER_PASSWORD)).statusCode())
                .isEqualTo(429);
        clock.set(Instant.parse("2026-10-22T10:20:00Z"));
        assertThat(api.post("/api/data/delete", """
                {"scopes":["NOTES"],"password":"%s"}""".formatted(ApiClient.OWNER_PASSWORD)).statusCode())
                .isEqualTo(204);
    }

    private int count(String table) {
        return jdbc.queryForObject("select count(*) from " + table + " where user_id = ?", Integer.class, user);
    }

    /** Filas del usuario en cualquier tabla exportada, también en las hijas. */
    private int rows(String table) {
        String sql = DataExportService.TABLES.get(table);
        return jdbc.queryForList(sql, user).size();
    }

    private String exportedJson() throws IOException {
        byte[] zip = api.getBytes("/api/export").body();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip), StandardCharsets.UTF_8)) {
            for (var entry = in.getNextEntry(); entry != null; entry = in.getNextEntry()) {
                if (entry.getName().equals("datos.json")) {
                    return new String(in.readAllBytes(), StandardCharsets.UTF_8);
                }
            }
        }
        throw new IllegalStateException("Sin datos.json");
    }
}
