package com.lifeos.push;

import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Envía un mensaje cifrado al servicio push del navegador (Google, Mozilla, Apple…). */
@Component
public class WebPushSender {

    public enum Result {
        SENT,
        /** La suscripción ya no existe (el usuario la revocó o desinstaló la app): hay que borrarla. */
        GONE,
        FAILED
    }

    private static final Logger log = LoggerFactory.getLogger(WebPushSender.class);
    private static final Duration TTL = Duration.ofHours(12);

    private final VapidKeys vapidKeys;
    private final HttpClient http = HttpClient.newBuilder()
            .proxy(ProxySelector.getDefault())
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public WebPushSender(VapidKeys vapidKeys) {
        this.vapidKeys = vapidKeys;
    }

    public Result send(PushSubscription subscription, String payloadJson) {
        try {
            URI endpoint = URI.create(subscription.getEndpoint());
            String audience = endpoint.getScheme() + "://" + endpoint.getAuthority();
            byte[] body = WebPushEncryption.encrypt(payloadJson.getBytes(StandardCharsets.UTF_8),
                    EcKeys.fromBase64Url(subscription.getP256dh()), EcKeys.fromBase64Url(subscription.getAuth()));
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(15))
                    .header("Authorization", vapidKeys.authorizationHeader(audience))
                    .header("Content-Encoding", "aes128gcm")
                    .header("Content-Type", "application/octet-stream")
                    .header("TTL", String.valueOf(TTL.toSeconds()))
                    .header("Urgency", "high")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status >= 200 && status < 300) {
                return Result.SENT;
            }
            if (status == 404 || status == 410) {
                return Result.GONE;
            }
            log.warn("El servicio push respondió {}: {}", status, response.body());
            return Result.FAILED;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.FAILED;
        } catch (Exception e) {
            log.warn("No se ha podido enviar la notificación push", e);
            return Result.FAILED;
        }
    }
}
