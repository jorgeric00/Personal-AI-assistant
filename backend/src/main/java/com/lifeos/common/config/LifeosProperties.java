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
        @DefaultValue Login login) {

    /** Cuenta que se crea al arrancar si la base de datos no tiene usuarios. */
    public record Admin(String email, String password, String displayName) {
    }

    /** Protección frente a intentos de inicio de sesión repetidos. */
    public record Login(
            @DefaultValue("5") int maxFailedAttempts,
            @DefaultValue("15m") Duration lockout) {
    }
}
