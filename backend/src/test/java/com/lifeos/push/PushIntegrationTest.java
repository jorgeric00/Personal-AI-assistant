package com.lifeos.push;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetSocketAddress;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

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
import com.lifeos.agenda.ActivityReminderNotifier;
import com.lifeos.habits.HabitReminderNotifier;
import com.lifeos.tasks.ReminderNotifier;
import com.sun.net.httpserver.HttpServer;

/**
 * Prueba los avisos de principio a fin con un servicio push falso en local: el servidor cifra el mensaje,
 * lo firma con VAPID y lo envía; la prueba lo descifra como haría el navegador.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
class PushIntegrationTest {

    private record Received(String authorization, String encoding, byte[] body) {
    }

    @LocalServerPort
    int port;

    @Autowired
    MutableClock clock;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    ReminderNotifier notifier;

    @Autowired
    ActivityReminderNotifier activityNotifier;

    @Autowired
    HabitReminderNotifier habitNotifier;

    private final List<Received> received = new CopyOnWriteArrayList<>();
    private HttpServer pushService;
    private volatile int pushStatus = 201;
    private KeyPair browserKeys;
    private byte[] authSecret;
    private ApiClient api;

    @BeforeEach
    void setUp() throws Exception {
        jdbc.update("delete from task");
        jdbc.update("delete from activity");
        jdbc.update("delete from habit");
        jdbc.update("delete from push_subscription");
        pushService = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        pushService.createContext("/push", exchange -> {
            received.add(new Received(exchange.getRequestHeaders().getFirst("Authorization"),
                    exchange.getRequestHeaders().getFirst("Content-Encoding"), exchange.getRequestBody().readAllBytes()));
            exchange.sendResponseHeaders(pushStatus, -1);
            exchange.close();
        });
        pushService.start();
        browserKeys = EcKeys.generate();
        authSecret = new byte[16];
        authSecret[3] = 7;
        clock.set(Instant.parse("2026-10-11T10:00:00Z"));
        api = new ApiClient(port).login();
    }

    @AfterEach
    void tearDown() {
        pushService.stop(0);
        clock.reset();
    }

    @Test
    void exposesStablePublicKeyAndValidatesSubscriptions() {
        String key = JsonPath.read(api.get("/api/push/public-key").body(), "$.publicKey");
        assertThat(EcKeys.fromBase64Url(key)).hasSize(65);
        assertThat(JsonPath.<String>read(api.get("/api/push/public-key").body(), "$.publicKey")).isEqualTo(key);

        HttpResponse<String> insecure = api.post("/api/push/subscriptions",
                "{\"endpoint\":\"http://example.com/x\",\"keys\":{\"p256dh\":\"a\",\"auth\":\"b\"}}");
        assertThat(insecure.statusCode()).isEqualTo(400);

        HttpResponse<String> valid = api.post("/api/push/subscriptions",
                "{\"endpoint\":\"https://push.example.com/abc\",\"keys\":{\"p256dh\":\"a\",\"auth\":\"b\"}}");
        assertThat(valid.statusCode()).isEqualTo(204);
        // Volver a suscribirse con el mismo endpoint no crea duplicados
        api.post("/api/push/subscriptions",
                "{\"endpoint\":\"https://push.example.com/abc\",\"keys\":{\"p256dh\":\"c\",\"auth\":\"d\"}}");
        assertThat(JsonPath.<Integer>read(api.get("/api/push/public-key").body(), "$.subscriptions")).isEqualTo(1);

        assertThat(api.delete("/api/push/subscriptions").statusCode()).isEqualTo(400);
    }

    @Test
    void testNotificationNeedsASubscription() {
        HttpResponse<String> response = api.post("/api/push/test", null);
        assertThat(response.statusCode()).isEqualTo(409);
        assertThat(response.body()).contains("Activa las notificaciones");
    }

    @Test
    void sendsTestNotificationSignedWithVapid() throws Exception {
        subscribeBrowser();
        HttpResponse<String> response = api.post("/api/push/test", null);
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        assertThat(received).hasSize(1);

        Received push = received.getFirst();
        assertThat(push.encoding()).isEqualTo("aes128gcm");
        assertThat(WebPushDecryptor.decrypt(push.body(), browserKeys, authSecret))
                .contains("\"body\":\"Las notificaciones funcionan correctamente.\"");
        assertVapidSignatureIsValid(push.authorization());
    }

    @Test
    void notifiesReminderOnceAtTheRightTime() throws Exception {
        subscribeBrowser();
        HttpResponse<String> created = api.post("/api/tasks", """
                {"kind":"REMINDER","title":"Cita con el dentista","priority":"HIGH",
                 "dueDate":"2026-10-11","dueTime":"13:00","reminderMinutesBefore":30}
                """);
        assertThat(created.statusCode()).as(created.body()).isEqualTo(201);

        // 12:00 en Madrid: todavía no toca (el aviso es a las 12:30)
        assertThat(notifier.notifyDue()).isZero();

        clock.set(Instant.parse("2026-10-11T10:31:00Z"));
        assertThat(notifier.notifyDue()).isEqualTo(1);
        assertThat(notifier.notifyDue()).as("no se repite").isZero();

        assertThat(received).hasSize(1);
        String payload = WebPushDecryptor.decrypt(received.getFirst().body(), browserKeys, authSecret);
        assertThat(JsonPath.<String>read(payload, "$.title")).isEqualTo("Cita con el dentista");
        assertThat(JsonPath.<String>read(payload, "$.body")).isEqualTo("Hoy a las 13:00");
    }

    @Test
    void notifiesEachOccurrenceOfRecurringReminder() {
        subscribeBrowser();
        api.post("/api/tasks", """
                {"kind":"REMINDER","title":"Pádel","priority":"MEDIUM","dueDate":"2026-10-11","dueTime":"19:00",
                 "reminderMinutesBefore":0,"recurrence":{"frequency":"DAILY","interval":1}}
                """);
        clock.set(Instant.parse("2026-10-11T17:00:30Z"));
        assertThat(notifier.notifyDue()).isEqualTo(1);
        // Al día siguiente avisa aunque la aparición anterior no se haya marcado como hecha
        clock.set(Instant.parse("2026-10-12T17:00:30Z"));
        assertThat(notifier.notifyDue()).isEqualTo(1);
        assertThat(received).hasSize(2);
    }

    @Test
    void skipsVeryOldRemindersAndDeletesGoneSubscriptions() {
        subscribeBrowser();
        api.post("/api/tasks", """
                {"kind":"REMINDER","title":"Antiguo","priority":"LOW","dueDate":"2026-10-11","dueTime":"08:00",
                 "reminderMinutesBefore":0}
                """);
        // Las 12:00: el aviso de las 08:00 tiene más de 2 horas, no se envía tarde
        assertThat(notifier.notifyDue()).isZero();

        api.post("/api/tasks", """
                {"kind":"REMINDER","title":"Ahora","priority":"LOW","dueDate":"2026-10-11","dueTime":"12:00",
                 "reminderMinutesBefore":0}
                """);
        pushStatus = 410;
        notifier.notifyDue();
        assertThat(jdbc.queryForObject("select count(*) from push_subscription", Integer.class)).isZero();
    }

    @Test
    void notifiesAgendaActivitiesBeforeTheyStartExceptCancelledOnes() throws Exception {
        subscribeBrowser();
        // Otras pruebas comparten la base de datos y pueden haber archivado alguna categoría
        List<String> active = JsonPath.read(api.get("/api/agenda/categories").body(), "$[?(@.archived == false)].id");
        String category = active.getFirst();
        HttpResponse<String> created = api.post("/api/agenda/activities", """
                {"title":"Clase de yoga","categoryId":"%s","startDate":"2026-10-11","startTime":"18:00",
                 "endDate":"2026-10-11","endTime":"19:00","location":"Gimnasio","reminderMinutesBefore":60,
                 "recurrence":{"frequency":"DAILY","interval":1}}""".formatted(category));
        assertThat(created.statusCode()).as(created.body()).isEqualTo(201);
        assertThat(JsonPath.<Integer>read(created.body(), "$.reminderMinutesBefore")).isEqualTo(60);
        String id = JsonPath.read(created.body(), "$.id");

        // 12:00 en Madrid: el aviso es a las 17:00
        assertThat(activityNotifier.notifyDue()).isZero();
        clock.set(Instant.parse("2026-10-11T15:00:30Z"));
        assertThat(activityNotifier.notifyDue()).isEqualTo(1);
        assertThat(activityNotifier.notifyDue()).as("no se repite").isZero();
        String payload = WebPushDecryptor.decrypt(received.getFirst().body(), browserKeys, authSecret);
        assertThat(JsonPath.<String>read(payload, "$.title")).isEqualTo("Clase de yoga");
        assertThat(JsonPath.<String>read(payload, "$.body")).isEqualTo("Hoy a las 18:00 · Gimnasio");
        assertThat(JsonPath.<String>read(payload, "$.url")).isEqualTo("/agenda?vista=DAY&fecha=2026-10-11");

        // La del día siguiente está cancelada: no se avisa
        assertThat(api.put("/api/agenda/activities/" + id + "/occurrences/2026-10-12", """
                {"status":"CANCELLED"}""").statusCode()).isEqualTo(204);
        clock.set(Instant.parse("2026-10-12T15:00:30Z"));
        assertThat(activityNotifier.notifyDue()).isZero();

        // Sin hora no hay aviso
        HttpResponse<String> allDay = api.post("/api/agenda/activities", """
                {"title":"Excursión","categoryId":"%s","startDate":"2026-10-13","endDate":"2026-10-13",
                 "reminderMinutesBefore":60}""".formatted(category));
        assertThat(JsonPath.<Object>read(allDay.body(), "$.reminderMinutesBefore")).isNull();
    }

    @Test
    void remindsHabitsOnlyOnDueDaysThatAreNotCheckedYet() throws Exception {
        subscribeBrowser();
        // Domingo 11 de octubre; aviso a las 20:00 en Madrid (18:00 UTC)
        String pending = habit("""
                {"name":"Leer","color":"#0f766e","frequency":"DAILY","reminderTime":"20:00"}""");
        String done = habit("""
                {"name":"Beber agua","color":"#0f766e","frequency":"DAILY","reminderTime":"20:00"}""");
        api.put("/api/habits/" + done + "/checks/2026-10-11", null);
        habit("""
                {"name":"Gimnasio","color":"#0f766e","frequency":"DAILY","weekdays":["MONDAY"],
                 "reminderTime":"20:00"}""");
        String weekly = habit("""
                {"name":"Llamar a casa","color":"#0f766e","frequency":"WEEKLY","timesPerWeek":2,
                 "reminderTime":"20:00"}""");
        habit("""
                {"name":"Sin aviso","color":"#0f766e","frequency":"DAILY"}""");
        assertThat(JsonPath.<String>read(api.get("/api/habits?from=2026-10-05&to=2026-10-11").body(),
                "$[0].reminderTime")).isEqualTo("20:00:00");
        // La semana empezó antes de crear el hábito: marcar un día cuenta igual
        jdbc.update("update habit set start_date = '2026-10-05'");
        api.put("/api/habits/" + weekly + "/checks/2026-10-06", null);

        assertThat(habitNotifier.notifyDue()).isZero();
        clock.set(Instant.parse("2026-10-11T18:00:30Z"));
        assertThat(habitNotifier.notifyDue()).isEqualTo(2);
        assertThat(habitNotifier.notifyDue()).as("una vez al día").isZero();
        List<String> payloads = new ArrayList<>();
        for (var r : received) {
            payloads.add(WebPushDecryptor.decrypt(r.body(), browserKeys, authSecret));
        }
        assertThat(payloads).anySatisfy(p -> {
            assertThat(JsonPath.<String>read(p, "$.title")).isEqualTo("Leer");
            assertThat(JsonPath.<String>read(p, "$.body")).isEqualTo("Aún no lo has marcado hoy.");
        });
        assertThat(payloads).anySatisfy(p -> {
            assertThat(JsonPath.<String>read(p, "$.title")).isEqualTo("Llamar a casa");
            assertThat(JsonPath.<String>read(p, "$.body")).isEqualTo("Esta semana llevas 1 de 2.");
        });
        assertThat(pending).isNotBlank();
    }

    private String habit(String json) {
        HttpResponse<String> response = api.post("/api/habits", json);
        assertThat(response.statusCode()).as(response.body()).isEqualTo(201);
        return JsonPath.read(response.body(), "$.id");
    }

    private void subscribeBrowser() {
        jdbc.update("""
                insert into push_subscription (id, user_id, endpoint, p256dh, auth, created_at)
                select ?, id, ?, ?, ?, now() from app_user
                """, UUID.randomUUID(), "http://localhost:" + pushService.getAddress().getPort() + "/push/1",
                EcKeys.base64Url(EcKeys.encodePublic((ECPublicKey) browserKeys.getPublic())),
                EcKeys.base64Url(authSecret));
    }

    private void assertVapidSignatureIsValid(String authorization) throws Exception {
        assertThat(authorization).startsWith("vapid t=");
        String jwt = authorization.substring("vapid t=".length(), authorization.indexOf(", k="));
        String key = authorization.substring(authorization.indexOf(", k=") + 4);
        String[] parts = jwt.split("\\.");
        String claims = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        assertThat(claims).contains("\"aud\":\"http://localhost:" + pushService.getAddress().getPort() + "\"")
                .contains("\"sub\":\"mailto:test@example.com\"");

        Signature verifier = Signature.getInstance("SHA256withECDSAinP1363Format");
        verifier.initVerify(EcKeys.decodePublic(EcKeys.fromBase64Url(key)));
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertThat(verifier.verify(Base64.getUrlDecoder().decode(parts[2]))).isTrue();
    }
}
