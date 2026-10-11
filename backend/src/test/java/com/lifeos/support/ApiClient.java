package com.lifeos.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

/** Cliente HTTP de pruebas que se comporta como el navegador: cookies de sesión y CSRF. */
public final class ApiClient {

    public static final String OWNER_EMAIL = "propietario@example.com";
    public static final String OWNER_PASSWORD = "contraseña-de-prueba-segura";

    private final int port;
    private final CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
    private final HttpClient client = HttpClient.newBuilder().cookieHandler(cookies).build();

    public ApiClient(int port) {
        this.port = port;
    }

    public ApiClient login() {
        HttpResponse<String> response = post("/api/auth/login",
                "{\"email\":\"" + OWNER_EMAIL + "\",\"password\":\"" + OWNER_PASSWORD + "\"}");
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        return this;
    }

    public HttpResponse<String> get(String path) {
        return send(HttpRequest.newBuilder(uri(path)).GET());
    }

    public HttpResponse<String> post(String path, String json) {
        return withCsrf(path, "POST", json);
    }

    public HttpResponse<String> put(String path, String json) {
        return withCsrf(path, "PUT", json);
    }

    public HttpResponse<String> patch(String path, String json) {
        return withCsrf(path, "PATCH", json);
    }

    public HttpResponse<String> delete(String path) {
        return withCsrf(path, "DELETE", null);
    }

    public HttpResponse<String> delete(String path, String json) {
        return withCsrf(path, "DELETE", json);
    }

    private HttpResponse<String> withCsrf(String path, String method, String json) {
        if (csrfCookie() == null) {
            assertThat(get("/api/auth/csrf").statusCode()).isEqualTo(200);
        }
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(path))
                .header("X-XSRF-TOKEN", csrfCookie().getValue())
                .method(method, json == null ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(json));
        if (json != null) {
            request.header("Content-Type", "application/json");
        }
        return send(request);
    }

    private HttpCookie csrfCookie() {
        return cookies.getCookieStore().getCookies().stream()
                .filter(c -> c.getName().equals("XSRF-TOKEN"))
                .findFirst()
                .orElse(null);
    }

    private HttpResponse<String> send(HttpRequest.Builder request) {
        try {
            return client.send(request.header("Accept-Language", "es").build(), HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }
}
