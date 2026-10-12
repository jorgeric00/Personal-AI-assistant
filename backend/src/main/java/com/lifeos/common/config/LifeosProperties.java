package com.lifeos.common.config;

import java.time.Duration;
import java.time.ZoneId;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Configuración propia de LifeOS (prefijo {@code lifeos}).
 */
@ConfigurationProperties("lifeos")
public record LifeosProperties(
        @DefaultValue("Europe/Madrid") ZoneId timezone,
        @DefaultValue Admin admin,
        @DefaultValue Login login,
        @DefaultValue Push push,
        @DefaultValue Reminders reminders) {

    /** Cuenta que se crea al arrancar si la base de datos no tiene usuarios. */
    public record Admin(String email, String password, String displayName) {
    }

    /** Protección frente a intentos de inicio de sesión repetidos. */
    public record Login(
            @DefaultValue("5") int maxFailedAttempts,
            @DefaultValue("15m") Duration lockout) {
    }

    /**
     * Notificaciones push. Si no se indican claves VAPID, se generan y se guardan en la base de datos.
     *
     * @param subject contacto (mailto: o https:) que se envía a los servicios push
     */
    public record Push(
            @DefaultValue("mailto:lifeos@localhost") String subject,
            String vapidPublicKey,
            String vapidPrivateKey) {
    }

    /** Comprobación periódica de recordatorios que hay que notificar. */
    public record Reminders(
            @DefaultValue("true") boolean enabled,
            @DefaultValue("30s") Duration checkInterval) {
    }
}
