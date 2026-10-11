package com.lifeos.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import com.lifeos.TestcontainersConfiguration;
import com.lifeos.user.AppUserRepository;

/**
 * Prueba el flujo real de autenticación por HTTP: cookie de sesión, cookie CSRF y cabecera X-XSRF-TOKEN,
 * igual que lo hará el navegador.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
class AuthIntegrationTest {

    private static final String EMAIL = "propietario@example.com";
    private static final String PASSWORD = "contraseña-de-prueba-segura";

    @LocalServerPort
    int port;

    @Autowired
    AppUserRepository users;

    @Autowired
    LoginAttemptService loginAttempts;

    private CookieManager cookies;
    private HttpClient client;

    @BeforeEach
    void setUp() {
        cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        client = HttpClient.newBuilder().cookieHandler(cookies).build();
        loginAttempts.recordSuccess(EMAIL);
    }

    @Test
    void createsOwnerAccountOnStartupWithHashedPassword() {
        var user = users.findByEmailIgnoreCase(EMAIL).orElseThrow();
        assertThat(user.getDisplayName()).isEqualTo("Jorge");
        assertThat(user.getPasswordHash()).startsWith("{bcrypt}").doesNotContain(PASSWORD);
    }

    @Test
    void protectedEndpointsRequireSession() throws Exception {
        assertThat(get("/api/auth/me").statusCode()).isEqualTo(401);
    }

    @Test
    void healthIsPublic() throws Exception {
        HttpResponse<String> response = get("/actuator/health");
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("UP");
    }

    @Test
    void loginRequiresCsrfToken() throws Exception {
        HttpResponse<String> response = send(HttpRequest.newBuilder(uri("/api/auth/login"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(loginJson(EMAIL, PASSWORD))));
        assertThat(response.statusCode()).isEqualTo(403);
    }

    @Test
    void loginWithWrongPasswordFails() throws Exception {
        HttpResponse<String> response = postWithCsrf("/api/auth/login", loginJson(EMAIL, "incorrecta"));
        assertThat(response.statusCode()).isEqualTo(401);
        assertThat(response.body()).contains("Correo electrónico o contraseña incorrectos");
        assertThat(get("/api/auth/me").statusCode()).isEqualTo(401);
    }

    @Test
    void invalidPayloadReturnsFieldErrorsInSpanish() throws Exception {
        HttpResponse<String> response = postWithCsrf("/api/auth/login", loginJson("no-es-un-correo", ""));
        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(response.body())
                .contains("El correo electrónico no es válido")
                .contains("Introduce tu contraseña");
    }

    @Test
    void loginKeepsSessionUntilLogout() throws Exception {
        HttpResponse<String> login = postWithCsrf("/api/auth/login", loginJson("  Propietario@Example.com ", PASSWORD));
        assertThat(login.statusCode()).isEqualTo(200);
        assertThat(login.body()).contains(EMAIL).contains("Europe/Madrid").doesNotContain("bcrypt");

        HttpCookie session = cookie("LIFEOS_SESSION");
        assertThat(session).isNotNull();
        assertThat(session.isHttpOnly()).isTrue();

        HttpResponse<String> me = get("/api/auth/me");
        assertThat(me.statusCode()).isEqualTo(200);
        assertThat(me.body()).contains("\"displayName\":\"Jorge\"");

        assertThat(postWithCsrf("/api/auth/logout", "").statusCode()).isEqualTo(204);
        assertThat(get("/api/auth/me").statusCode()).isEqualTo(401);
    }

    @Test
    void blocksAfterRepeatedFailures() throws Exception {
        for (int i = 0; i < 3; i++) {
            assertThat(postWithCsrf("/api/auth/login", loginJson(EMAIL, "incorrecta")).statusCode()).isEqualTo(401);
        }
        HttpResponse<String> blocked = postWithCsrf("/api/auth/login", loginJson(EMAIL, PASSWORD));
        assertThat(blocked.statusCode()).isEqualTo(429);
        assertThat(blocked.headers().firstValue("Retry-After")).isPresent();
    }

    private HttpResponse<String> postWithCsrf(String path, String json) throws Exception {
        assertThat(get("/api/auth/csrf").statusCode()).isEqualTo(200);
        HttpCookie xsrf = cookie("XSRF-TOKEN");
        assertThat(xsrf).as("cookie XSRF-TOKEN").isNotNull();
        return send(HttpRequest.newBuilder(uri(path))
                .header("Content-Type", "application/json")
                .header("X-XSRF-TOKEN", xsrf.getValue())
                .POST(HttpRequest.BodyPublishers.ofString(json)));
    }

    private HttpResponse<String> get(String path) throws Exception {
        return send(HttpRequest.newBuilder(uri(path)).GET());
    }

    private HttpResponse<String> send(HttpRequest.Builder request) throws IOException, InterruptedException {
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpCookie cookie(String name) {
        return cookies.getCookieStore().getCookies().stream()
                .filter(c -> c.getName().equals(name))
                .findFirst()
                .orElse(null);
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }

    private static String loginJson(String email, String password) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }
}
