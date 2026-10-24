package com.lifeos.export;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
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
class DataExportIntegrationTest {

    /** Tablas que no son datos del usuario o que no tiene sentido llevarse a otro sitio. */
    private static final Set<String> NOT_EXPORTED = Set.of("app_user", "flyway_schema_history", "spring_session",
            "spring_session_attributes", "server_key", "push_subscription", "task_notification",
            "finance_budget_alert", "progress_photo_data");

    private static final Timestamp CREATED = Timestamp.from(Instant.parse("2026-09-01T10:00:00Z"));

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from task");
        jdbc.update("delete from progress_photo");
        jdbc.update("delete from body_measurement");
        jdbc.update("delete from app_user where email = 'otra@example.com'");
        clock.set(Instant.parse("2026-10-22T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    @Test
    void exportsEveryTableOfTheUserWithPhotosAndFinanceCsv() throws IOException {
        UUID user = jdbc.queryForObject("select id from app_user where email = ?", UUID.class, ApiClient.OWNER_EMAIL);
        assertThat(api.post("/api/tasks", """
                {"kind":"TASK","title":"Renovar el DNI","priority":"HIGH"}""").statusCode()).isEqualTo(201);
        assertThat(api.post("/api/fitness/measurements", """
                {"date":"2026-10-20","weightKg":80.5,"waistCm":90}""").statusCode()).isEqualTo(201);
        String category = JsonPath.<List<String>>read(api.get("/api/finance/categories").body(),
                "$[?(@.kind == 'EXPENSE')].id").getFirst();
        assertThat(api.post("/api/finance/movements", """
                {"kind":"EXPENSE","amountCents":1250,"date":"2026-10-21","categoryId":"%s","description":"Café"}"""
                .formatted(category)).statusCode()).isEqualTo(201);
        UUID photo = UUID.randomUUID();
        jdbc.update("""
                insert into progress_photo (id, user_id, taken_on, pose, width, height, created_at, updated_at)
                values (?, ?, '2026-10-20', 'FRONT', 2, 2, ?, ?)""", photo, user, CREATED, CREATED);
        byte[] image = { (byte) 0xFF, (byte) 0xD8, 1, 2, 3 };
        jdbc.update("insert into progress_photo_data values (?, ?, ?)", photo, image, new byte[] { 9 });
        // Datos de otra persona que no deben salir
        UUID other = UUID.randomUUID();
        jdbc.update("""
                insert into app_user (id, email, display_name, password_hash, created_at, updated_at)
                values (?, 'otra@example.com', 'Otra', 'x', ?, ?)""", other, CREATED, CREATED);
        jdbc.update("""
                insert into task (id, user_id, kind, title, priority, status, created_at, updated_at)
                values (?, ?, 'TASK', 'Ajena', 'LOW', 'PENDING', ?, ?)""", UUID.randomUUID(), other, CREATED, CREATED);

        HttpResponse<byte[]> response = api.getBytes("/api/export");
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("Content-Type")).hasValue("application/zip");
        assertThat(response.headers().firstValue("Content-Disposition").orElseThrow())
                .contains("attachment").contains("lifeos-2026-10-22.zip");
        assertThat(response.headers().firstValue("Cache-Control").orElseThrow()).contains("no-store");

        Map<String, byte[]> files = unzip(response.body());
        assertThat(files.keySet()).contains("datos.json", "finanzas.csv", "LEEME.txt",
                "fotos/2026-10-20-front-" + photo + ".jpg");
        assertThat(files.get("fotos/2026-10-20-front-" + photo + ".jpg")).isEqualTo(image);

        String data = new String(files.get("datos.json"), StandardCharsets.UTF_8);
        assertThat(JsonPath.<String>read(data, "$.format")).isEqualTo("lifeos-export");
        assertThat(JsonPath.<String>read(data, "$.user.email")).isEqualTo(ApiClient.OWNER_EMAIL);
        assertThat(data).doesNotContain("password").doesNotContain("Ajena").doesNotContain("otra@example.com");
        assertThat(JsonPath.<List<String>>read(data, "$.data.task[*].title")).containsExactly("Renovar el DNI");
        assertThat(JsonPath.<Double>read(data, "$.data.body_measurement[0].weight_kg")).isEqualTo(80.5);
        assertThat(JsonPath.<Integer>read(data, "$.data.body_measurement[0].waist_cm")).isEqualTo(90);
        assertThat(JsonPath.<String>read(data, "$.data.body_measurement[0].date")).isEqualTo("2026-10-20");
        assertThat(JsonPath.<Integer>read(data, "$.data.finance_movement[0].amount_cents")).isEqualTo(1250);
        assertThat(JsonPath.<String>read(data, "$.data.progress_photo[0].file"))
                .isEqualTo("fotos/2026-10-20-front-" + photo + ".jpg");

        String csv = new String(files.get("finanzas.csv"), StandardCharsets.UTF_8);
        assertThat(csv).startsWith("﻿date,type,amount").contains("2026-10-21,EXPENSE,12.50,EUR");
    }

    @Test
    void coversEveryTableInTheDatabase() {
        Set<String> tables = new HashSet<>(jdbc.queryForList(
                "select table_name from information_schema.tables where table_schema = 'public'", String.class));
        tables.removeAll(NOT_EXPORTED);
        // Si falla, hay una tabla nueva: añádela a la exportación o justifica por qué no va
        assertThat(DataExportService.TABLES.keySet()).containsExactlyInAnyOrderElementsOf(tables);
    }

    @Test
    void requiresASession() {
        assertThat(new ApiClient(port).getBytes("/api/export").statusCode()).isEqualTo(401);
    }

    private static Map<String, byte[]> unzip(byte[] bytes) throws IOException {
        Map<String, byte[]> files = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes), StandardCharsets.UTF_8)) {
            for (ZipEntry entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                files.put(entry.getName(), zip.readAllBytes());
            }
        }
        return files;
    }
}
