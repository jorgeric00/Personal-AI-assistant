package com.lifeos.finance;

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
class FinanceIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    private ApiClient api;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from finance_movement");
        jdbc.update("delete from finance_account");
        jdbc.update("delete from finance_category");
        jdbc.update("delete from finance_settings");
        clock.set(Instant.parse("2026-10-11T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        clock.reset();
    }

    @Test
    void requiresSession() {
        assertThat(new ApiClient(port).get("/api/finance/movements").statusCode()).isEqualTo(401);
    }

    @Test
    void createsDefaultCategoriesOnceInUserLanguage() {
        List<String> names = JsonPath.read(api.get("/api/finance/categories").body(), "$[*].name");
        assertThat(names).hasSize(12).contains("Vivienda", "Alimentación y supermercado", "Nómina", "Otros ingresos");
        assertThat(JsonPath.<List<String>>read(api.get("/api/finance/categories").body(), "$[*].name")).hasSize(12);
        assertThat(jdbc.queryForObject("select count(*) from finance_category", Integer.class)).isEqualTo(12);
    }

    @Test
    void createsEditsAndDeletesMovementWithExactAmounts() {
        String groceries = category("Alimentación y supermercado");
        String account = JsonPath.read(api.post("/api/finance/accounts", "{\"name\":\"Tarjeta\"}").body(), "$.id");

        HttpResponse<String> created = api.post("/api/finance/movements", """
                {"kind":"EXPENSE","amountCents":1999,"date":"2026-10-10","categoryId":"%s","accountId":"%s",
                 "description":" Compra semanal ","tags":["#Casa"]}
                """.formatted(groceries, account));
        assertThat(created.statusCode()).as(created.body()).isEqualTo(201);
        String id = JsonPath.read(created.body(), "$.id");
        assertThat(JsonPath.<Integer>read(created.body(), "$.amountCents")).isEqualTo(1999);
        assertThat(JsonPath.<String>read(created.body(), "$.currency")).isEqualTo("EUR");
        assertThat(JsonPath.<String>read(created.body(), "$.description")).isEqualTo("Compra semanal");
        assertThat(JsonPath.<String>read(created.body(), "$.account.name")).isEqualTo("Tarjeta");
        assertThat(JsonPath.<List<String>>read(created.body(), "$.tags")).containsExactly("casa");

        HttpResponse<String> updated = api.put("/api/finance/movements/" + id, """
                {"kind":"EXPENSE","amountCents":2050,"date":"2026-10-10","categoryId":"%s"}
                """.formatted(groceries));
        assertThat(JsonPath.<Integer>read(updated.body(), "$.amountCents")).isEqualTo(2050);
        assertThat(JsonPath.<Object>read(updated.body(), "$.account")).isNull();

        assertThat(api.delete("/api/finance/movements/" + id).statusCode()).isEqualTo(204);
        assertThat(api.get("/api/finance/movements/" + id).statusCode()).isEqualTo(404);
    }

    @Test
    void validatesMovements() {
        String salary = category("Nómina");
        HttpResponse<String> mismatch = api.post("/api/finance/movements", """
                {"kind":"EXPENSE","amountCents":100,"date":"2026-10-10","categoryId":"%s"}
                """.formatted(salary));
        assertThat(mismatch.statusCode()).isEqualTo(400);
        assertThat(mismatch.body()).contains("La categoría no corresponde al tipo de movimiento");

        HttpResponse<String> zero = api.post("/api/finance/movements", """
                {"kind":"INCOME","amountCents":0,"date":"2026-10-10","categoryId":"%s"}
                """.formatted(salary));
        assertThat(zero.statusCode()).isEqualTo(400);
        assertThat(zero.body()).contains("Escribe un importe mayor que cero");

        assertThat(api.get("/api/finance/movements?size=1000").statusCode()).isEqualTo(400);
        assertThat(api.get("/api/finance/summary?month=octubre").statusCode()).isEqualTo(400);
    }

    @Test
    void filtersHistoryAndReturnsTotalsOfTheFilter() {
        String groceries = category("Alimentación y supermercado");
        String transport = category("Transporte");
        String salary = category("Nómina");
        movement("INCOME", 250000, "2026-10-01", salary, "Nómina octubre");
        movement("EXPENSE", 4510, "2026-10-03", groceries, "Mercadona");
        movement("EXPENSE", 1500, "2026-10-05", transport, "Abono de metro");
        movement("EXPENSE", 3000, "2026-09-20", groceries, "Frutería");

        HttpResponse<String> october = api.get("/api/finance/movements?from=2026-10-01&to=2026-10-31");
        assertThat(JsonPath.<List<String>>read(october.body(), "$.items[*].description"))
                .containsExactly("Abono de metro", "Mercadona", "Nómina octubre");
        assertThat(JsonPath.<Map<String, Integer>>read(october.body(), "$.totals"))
                .containsEntry("incomeCents", 250000).containsEntry("expenseCents", 6010)
                .containsEntry("balanceCents", 243990);

        HttpResponse<String> byCategory = api.get("/api/finance/movements?kind=EXPENSE&categoryId=" + groceries);
        assertThat(JsonPath.<Integer>read(byCategory.body(), "$.totalItems")).isEqualTo(2);
        assertThat(JsonPath.<Integer>read(byCategory.body(), "$.totals.expenseCents")).isEqualTo(7510);

        assertThat(JsonPath.<List<String>>read(api.get("/api/finance/movements?q=mercadona").body(),
                "$.items[*].description")).containsExactly("Mercadona");

        HttpResponse<String> paged = api.get("/api/finance/movements?size=2&page=1");
        assertThat(JsonPath.<List<String>>read(paged.body(), "$.items[*].description"))
                .containsExactly("Nómina octubre", "Frutería");
        assertThat(JsonPath.<Integer>read(paged.body(), "$.totalItems")).isEqualTo(4);
    }

    @Test
    void summarizesMonthComparesWithPreviousAndTracksSavings() {
        String groceries = category("Alimentación y supermercado");
        String transport = category("Transporte");
        String salary = category("Nómina");
        movement("INCOME", 200000, "2026-08-31", salary, "Agosto");
        movement("EXPENSE", 50000, "2026-08-15", groceries, "Agosto");
        movement("INCOME", 200000, "2026-09-30", salary, "Septiembre");
        movement("EXPENSE", 120000, "2026-09-10", groceries, "Septiembre");
        movement("EXPENSE", 10, "2026-10-01", transport, "Billete");
        movement("EXPENSE", 20, "2026-10-02", transport, "Billete");
        movement("EXPENSE", 40000, "2026-10-03", groceries, "Compra");

        HttpResponse<String> summary = api.get("/api/finance/summary");
        assertThat(JsonPath.<String>read(summary.body(), "$.month")).isEqualTo("2026-10");
        assertThat(JsonPath.<Integer>read(summary.body(), "$.totals.expenseCents")).isEqualTo(40030);
        assertThat(JsonPath.<Integer>read(summary.body(), "$.totals.balanceCents")).isEqualTo(-40030);
        assertThat(JsonPath.<Integer>read(summary.body(), "$.previousTotals.balanceCents")).isEqualTo(80000);
        assertThat(JsonPath.<List<String>>read(summary.body(), "$.byCategory[*].name"))
                .containsExactly("Alimentación y supermercado", "Transporte");
        assertThat(JsonPath.<Integer>read(summary.body(), "$.byCategory[1].amountCents")).isEqualTo(30);

        HttpResponse<String> trend = api.get("/api/finance/trend?months=2&to=2026-10");
        assertThat(JsonPath.<List<String>>read(trend.body(), "$.points[*].month")).containsExactly("2026-09", "2026-10");
        // Ahorro acumulado: agosto 150000 + septiembre 80000, y octubre resta 40030
        assertThat(JsonPath.<List<Integer>>read(trend.body(), "$.points[*].savingsCents")).containsExactly(230000, 189970);
        assertThat(JsonPath.<List<Integer>>read(trend.body(), "$.points[*].balanceCents")).containsExactly(80000, -40030);
    }

    @Test
    void categoriesWithMovementsCanBeArchivedButNotDeleted() {
        String sport = category("Deporte");
        String movementId = movement("EXPENSE", 3500, "2026-10-05", sport, "Pádel");

        assertThat(api.delete("/api/finance/categories/" + sport).statusCode()).isEqualTo(409);
        HttpResponse<String> archived = api.put("/api/finance/categories/" + sport,
                "{\"kind\":\"EXPENSE\",\"name\":\"Deporte\",\"color\":\"#0f766e\",\"archived\":true}");
        assertThat(JsonPath.<Boolean>read(archived.body(), "$.archived")).isTrue();

        // Los movimientos existentes conservan la categoría archivada, pero no se puede usar en nuevos
        assertThat(api.put("/api/finance/movements/" + movementId, """
                {"kind":"EXPENSE","amountCents":4000,"date":"2026-10-05","categoryId":"%s"}
                """.formatted(sport)).statusCode()).isEqualTo(200);
        HttpResponse<String> newOne = api.post("/api/finance/movements", """
                {"kind":"EXPENSE","amountCents":100,"date":"2026-10-06","categoryId":"%s"}
                """.formatted(sport));
        assertThat(newOne.statusCode()).isEqualTo(400);
        assertThat(newOne.body()).contains("Esa categoría está archivada");

        HttpResponse<String> created = api.post("/api/finance/categories",
                "{\"kind\":\"EXPENSE\",\"name\":\"Mascotas\",\"color\":\"#ea580c\"}");
        assertThat(created.statusCode()).isEqualTo(201);
        assertThat(api.post("/api/finance/categories", "{\"kind\":\"EXPENSE\",\"name\":\"mascotas\",\"color\":\"#ea580c\"}")
                .body()).contains("Ya tienes una categoría con ese nombre");
        assertThat(api.delete("/api/finance/categories/" + JsonPath.read(created.body(), "$.id")).statusCode())
                .isEqualTo(204);
    }

    private String category(String name) {
        List<String> ids = JsonPath.read(api.get("/api/finance/categories").body(), "$[?(@.name == '" + name + "')].id");
        return ids.getFirst();
    }

    private String movement(String kind, long cents, String date, String categoryId, String description) {
        HttpResponse<String> response = api.post("/api/finance/movements", """
                {"kind":"%s","amountCents":%d,"date":"%s","categoryId":"%s","description":"%s"}
                """.formatted(kind, cents, date, categoryId, description));
        assertThat(response.statusCode()).as(response.body()).isEqualTo(201);
        return JsonPath.read(response.body(), "$.id");
    }
}
