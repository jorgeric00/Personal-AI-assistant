package com.lifeos.finance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.jayway.jsonpath.JsonPath;
import com.lifeos.TestcontainersConfiguration;
import com.lifeos.push.PushService;
import com.lifeos.push.PushService.Notification;
import com.lifeos.support.ApiClient;
import com.lifeos.support.MutableClock;

/** Presupuestos con avisos, movimientos recurrentes e importación y exportación CSV. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
class FinancePlanningIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    @MockitoBean
    PushService pushService;

    private ApiClient api;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from finance_movement");
        jdbc.update("delete from finance_recurring");
        jdbc.update("delete from finance_budget");
        jdbc.update("delete from finance_account");
        jdbc.update("delete from finance_category");
        jdbc.update("delete from finance_settings");
        // Domingo 11 de octubre de 2026 en Madrid
        clock.set(Instant.parse("2026-10-11T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    @Test
    void budgetShowsProgressAndAlertsOncePerLevel() {
        String groceries = category("Alimentación y supermercado");
        HttpResponse<String> budget = api.put("/api/finance/budgets",
                "{\"categoryId\":\"" + groceries + "\",\"amountCents\":40000}");
        assertThat(budget.statusCode()).as(budget.body()).isEqualTo(200);
        assertThat(JsonPath.<String>read(budget.body(), "$.level")).isEqualTo("OK");

        expense(groceries, 25000, "2026-10-02");
        verify(pushService, never()).sendToUser(any(), any());

        // 80 %: aviso de que se acerca al límite
        expense(groceries, 7000, "2026-10-05");
        ArgumentCaptor<Notification> warning = ArgumentCaptor.forClass(Notification.class);
        verify(pushService, times(1)).sendToUser(any(UUID.class), warning.capture());
        assertThat(warning.getValue().title()).isEqualTo("Presupuesto de Alimentación y supermercado casi agotado");
        assertThat(warning.getValue().body()).contains("320,00").contains("400,00").contains("80 %");

        // Más gastos en el mismo nivel no repiten el aviso
        expense(groceries, 500, "2026-10-06");
        verify(pushService, times(1)).sendToUser(any(), any());

        // Superado: segundo y último aviso del mes
        expense(groceries, 9000, "2026-10-07");
        ArgumentCaptor<Notification> exceeded = ArgumentCaptor.forClass(Notification.class);
        verify(pushService, times(2)).sendToUser(any(UUID.class), exceeded.capture());
        assertThat(exceeded.getValue().title()).isEqualTo("Presupuesto de Alimentación y supermercado superado");
        assertThat(exceeded.getValue().url()).isEqualTo("/finanzas?vista=BUDGETS");
        expense(groceries, 100, "2026-10-08");
        verify(pushService, times(2)).sendToUser(any(), any());

        // Los gastos de meses pasados no avisan
        clearInvocations(pushService);
        expense(groceries, 90000, "2026-09-10");
        verify(pushService, never()).sendToUser(any(), any());

        HttpResponse<String> list = api.get("/api/finance/budgets?month=2026-10");
        assertThat(JsonPath.<Integer>read(list.body(), "$[0].spentCents")).isEqualTo(41600);
        assertThat(JsonPath.<String>read(list.body(), "$[0].level")).isEqualTo("EXCEEDED");
        assertThat(JsonPath.<String>read(api.get("/api/finance/budgets?month=2026-08").body(), "$[0].level"))
                .isEqualTo("OK");

        String salary = category("Nómina");
        assertThat(api.put("/api/finance/budgets", "{\"categoryId\":\"" + salary + "\",\"amountCents\":100}").body())
                .contains("Los presupuestos son para categorías de gastos");
        assertThat(api.delete("/api/finance/budgets/" + JsonPath.read(budget.body(), "$.id")).statusCode())
                .isEqualTo(204);
    }

    @Test
    void recurringMovementsAreGeneratedOnceWithoutDuplicates() {
        String housing = category("Vivienda");
        HttpResponse<String> created = api.post("/api/finance/recurring", """
                {"kind":"EXPENSE","amountCents":85000,"categoryId":"%s","description":"Alquiler",
                 "frequency":"MONTHLY","every":1,"startDate":"2026-07-31"}
                """.formatted(housing));
        assertThat(created.statusCode()).as(created.body()).isEqualTo(201);
        String ruleId = JsonPath.read(created.body(), "$.id");
        // Julio, agosto y septiembre ya han pasado; un día 31 cae el último día de los meses cortos
        assertThat(JsonPath.<String>read(created.body(), "$.nextDate")).isEqualTo("2026-10-31");
        assertThat(dates()).containsExactly("2026-09-30", "2026-08-31", "2026-07-31");

        // Consultar varias veces no genera nada más
        api.get("/api/finance/summary");
        api.get("/api/finance/movements");
        assertThat(dates()).hasSize(3);

        // Al llegar la fecha se genera la siguiente aparición
        clock.set(Instant.parse("2026-11-30T10:00:00Z"));
        assertThat(dates()).containsExactly("2026-11-30", "2026-10-31", "2026-09-30", "2026-08-31", "2026-07-31");
        assertThat(JsonPath.<List<String>>read(api.get("/api/finance/movements").body(), "$.items[*].recurringId"))
                .containsOnly(ruleId);

        // Borrar un movimiento generado no hace que vuelva a aparecer
        String first = JsonPath.read(api.get("/api/finance/movements").body(), "$.items[0].id");
        api.delete("/api/finance/movements/" + first);
        assertThat(dates()).hasSize(4);

        HttpResponse<String> stopped = api.post("/api/finance/recurring/" + ruleId + "/stop", null);
        assertThat(JsonPath.<Object>read(stopped.body(), "$.nextDate")).isNull();
        clock.set(Instant.parse("2027-02-01T10:00:00Z"));
        assertThat(dates()).hasSize(4);

        // Borrar la regla conserva los movimientos
        assertThat(api.delete("/api/finance/recurring/" + ruleId).statusCode()).isEqualTo(204);
        assertThat(dates()).hasSize(4);
    }

    @Test
    void exportsAndReimportsCsvWithoutDuplicates() throws Exception {
        String groceries = category("Alimentación y supermercado");
        api.post("/api/finance/accounts", "{\"name\":\"Tarjeta\"}");
        String accountId = JsonPath.read(api.get("/api/finance/accounts").body(), "$[0].id");
        api.post("/api/finance/movements", """
                {"kind":"EXPENSE","amountCents":1999,"date":"2026-10-03","categoryId":"%s","accountId":"%s",
                 "description":"Compra, \\"oferta\\"","tags":["casa","semana"]}
                """.formatted(groceries, accountId));
        expense(groceries, 250, "2026-10-04");
        expense(groceries, 250, "2026-10-04");

        HttpResponse<String> export = api.get("/api/finance/export");
        assertThat(export.statusCode()).isEqualTo(200);
        assertThat(export.headers().firstValue("Content-Disposition").orElseThrow()).contains("attachment");
        assertThat(export.body()).startsWith("﻿date,type,amount,currency,category,account,description,tags\r\n")
                .contains("2026-10-03,EXPENSE,19.99,EUR,Alimentación y supermercado,Tarjeta,\"Compra, \"\"oferta\"\"\",casa;semana");

        // Reimportar lo exportado no duplica nada, ni siquiera los dos movimientos idénticos
        HttpResponse<String> same = upload(export.body());
        assertThat(JsonPath.<Integer>read(same.body(), "$.imported")).isZero();
        assertThat(JsonPath.<Integer>read(same.body(), "$.skippedDuplicates")).isEqualTo(3);

        // Formato de hoja de cálculo en español: «;», coma decimal, cabeceras y tipos en español
        HttpResponse<String> spanish = upload("""
                fecha;tipo;importe;categoría;cuenta;descripción
                2026-10-05;gasto;1.234,50;Mascotas;Efectivo;Veterinario
                2026-10-06;ingreso;50;Otros ingresos;;Venta
                """);
        assertThat(spanish.statusCode()).as(spanish.body()).isEqualTo(200);
        assertThat(JsonPath.<Integer>read(spanish.body(), "$.imported")).isEqualTo(2);
        assertThat(JsonPath.<List<String>>read(spanish.body(), "$.createdCategories")).containsExactly("Mascotas");
        assertThat(JsonPath.<List<String>>read(spanish.body(), "$.createdAccounts")).containsExactly("Efectivo");
        assertThat(JsonPath.<Integer>read(api.get("/api/finance/movements?q=veterinario").body(), "$.items[0].amountCents"))
                .isEqualTo(123450);
    }

    @Test
    void rejectsInvalidCsvWithoutImportingAnything() throws Exception {
        HttpResponse<String> response = upload("""
                date,type,amount,category
                2026-10-05,EXPENSE,12.50,Compras
                05/10/2026,EXPENSE,abc,Compras
                2026-10-07,regalo,3,Compras
                """);
        assertThat(JsonPath.<Integer>read(response.body(), "$.imported")).isZero();
        assertThat(JsonPath.<List<Integer>>read(response.body(), "$.errors[*].line")).containsExactly(3, 3, 4);
        assertThat(response.body()).contains("Fecha no válida: «05/10/2026»").contains("Importe no válido: «abc»");
        assertThat(jdbc.queryForObject("select count(*) from finance_movement", Integer.class)).isZero();

        assertThat(upload("fecha,importe\n2026-10-05,3\n").body()).contains("Falta la columna «type»");
    }

    private List<String> dates() {
        return JsonPath.read(api.get("/api/finance/movements").body(), "$.items[*].date");
    }

    private HttpResponse<String> upload(String csv) throws Exception {
        api.get("/api/auth/csrf");
        String boundary = "lifeos-test-boundary";
        String body = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"m.csv\"\r\n"
                + "Content-Type: text/csv\r\n\r\n" + csv + "\r\n--" + boundary + "--\r\n";
        return api.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/finance/import"))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8)), true);
    }

    private String category(String name) {
        List<String> ids = JsonPath.read(api.get("/api/finance/categories").body(), "$[?(@.name == '" + name + "')].id");
        return ids.getFirst();
    }

    private void expense(String categoryId, long cents, String date) {
        HttpResponse<String> response = api.post("/api/finance/movements", """
                {"kind":"EXPENSE","amountCents":%d,"date":"%s","categoryId":"%s"}
                """.formatted(cents, date, categoryId));
        assertThat(response.statusCode()).as(response.body()).isEqualTo(201);
    }
}
