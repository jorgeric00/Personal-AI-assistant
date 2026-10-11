package com.lifeos.push;

import java.time.Clock;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.json.JsonMapper;

import com.lifeos.push.PushDtos.SubscriptionRequest;

@Service
public class PushService {

    /** Contenido que el service worker muestra como notificación. */
    public record Notification(String title, String body, String url, String tag) {
    }

    private final PushSubscriptionRepository subscriptions;
    private final WebPushSender sender;
    private final JsonMapper json;
    private final Clock clock;

    public PushService(PushSubscriptionRepository subscriptions, WebPushSender sender, JsonMapper json, Clock clock) {
        this.subscriptions = subscriptions;
        this.sender = sender;
        this.json = json;
        this.clock = clock;
    }

    @Transactional
    public void subscribe(UUID userId, SubscriptionRequest request, String userAgent) {
        String agent = userAgent == null ? null : userAgent.substring(0, Math.min(300, userAgent.length()));
        subscriptions.findByEndpoint(request.endpoint()).ifPresentOrElse(
                existing -> existing.renew(userId, request.keys().p256dh(), request.keys().auth(), agent),
                () -> subscriptions.save(new PushSubscription(userId, request.endpoint(), request.keys().p256dh(),
                        request.keys().auth(), agent, clock.instant())));
    }

    @Transactional
    public void unsubscribe(UUID userId, String endpoint) {
        subscriptions.findByEndpoint(endpoint)
                .filter(subscription -> subscription.getUserId().equals(userId))
                .ifPresent(subscriptions::delete);
    }

    @Transactional(readOnly = true)
    public long subscriptionCount(UUID userId) {
        return subscriptions.countByUserId(userId);
    }

    /** Envía la notificación a todos los dispositivos del usuario. Devuelve a cuántos ha llegado. */
    @Transactional
    public int sendToUser(UUID userId, Notification notification) {
        String payload = json.writeValueAsString(notification);
        int delivered = 0;
        for (PushSubscription subscription : subscriptions.findByUserId(userId)) {
            switch (sender.send(subscription, payload)) {
                case SENT -> {
                    subscription.markSuccess(clock.instant());
                    delivered++;
                }
                case GONE -> subscriptions.delete(subscription);
                case FAILED -> {
                    // Se reintentará en el siguiente aviso; un fallo puntual no borra la suscripción.
                }
            }
        }
        return delivered;
    }
}
