package com.lifeos.push;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetSocketAddress;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.time.Instant;
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

    private final List<Received> received = new CopyOnWriteArrayList<>();
    private HttpServer pushService;
    private volatile int pushStatus = 201;
    private KeyPair browserKeys;
    private byte[] authSecret;
    private ApiClient api;

    @BeforeEach
    void setUp() throws Exception {
        jdbc.update("delete from task");
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
