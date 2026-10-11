package com.lifeos.push;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.lifeos.common.config.LifeosProperties;

/**
 * Claves VAPID con las que el servidor se identifica ante los servicios push.
 * Si no se configuran, se generan una vez y se guardan en la base de datos: cambiarlas invalidaría
 * todas las suscripciones existentes.
 */
@Component
public class VapidKeys {

    private static final Logger log = LoggerFactory.getLogger(VapidKeys.class);
    private static final String PUBLIC_NAME = "vapid.public";
    private static final String PRIVATE_NAME = "vapid.private";

    private final JdbcTemplate jdbc;
    private final LifeosProperties properties;
    private final Clock clock;
    private volatile Keys keys;

    private record Keys(ECPublicKey publicKey, ECPrivateKey privateKey, String publicKeyBase64) {
    }

    public VapidKeys(JdbcTemplate jdbc, LifeosProperties properties, Clock clock) {
        this.jdbc = jdbc;
        this.properties = properties;
        this.clock = clock;
    }

    public String publicKey() {
        return keys().publicKeyBase64();
    }

    /** Cabecera Authorization (esquema vapid, RFC 8292) para el servicio push indicado. */
    public String authorizationHeader(String audience) {
        Keys current = keys();
        long expiresAt = clock.instant().plus(Duration.ofHours(12)).getEpochSecond();
        String header = EcKeys.base64Url("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
        String claims = EcKeys.base64Url(("{\"aud\":\"" + audience + "\",\"exp\":" + expiresAt + ",\"sub\":\""
                + properties.push().subject() + "\"}").getBytes(StandardCharsets.UTF_8));
        String unsigned = header + "." + claims;
        try {
            Signature signature = Signature.getInstance("SHA256withECDSAinP1363Format");
            signature.initSign(current.privateKey());
            signature.update(unsigned.getBytes(StandardCharsets.US_ASCII));
            String jwt = unsigned + "." + EcKeys.base64Url(signature.sign());
            return "vapid t=" + jwt + ", k=" + current.publicKeyBase64();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("No se ha podido firmar el token VAPID", e);
        }
    }

    private Keys keys() {
        Keys current = keys;
        if (current == null) {
            synchronized (this) {
                if (keys == null) {
                    keys = load();
                }
                current = keys;
            }
        }
        return current;
    }

    private Keys load() {
        LifeosProperties.Push push = properties.push();
        if (StringUtils.hasText(push.vapidPublicKey()) && StringUtils.hasText(push.vapidPrivateKey())) {
            return toKeys(push.vapidPublicKey(), push.vapidPrivateKey());
        }
        String storedPublic = read(PUBLIC_NAME);
        String storedPrivate = read(PRIVATE_NAME);
        if (storedPublic != null && storedPrivate != null) {
            return toKeys(storedPublic, storedPrivate);
        }
        KeyPair pair = EcKeys.generate();
        String publicKey = EcKeys.base64Url(EcKeys.encodePublic((ECPublicKey) pair.getPublic()));
        String privateKey = EcKeys.base64Url(EcKeys.encodePrivate((ECPrivateKey) pair.getPrivate()));
        Instant now = clock.instant();
        jdbc.update("insert into server_key (name, value, created_at) values (?, ?, ?) on conflict do nothing",
                PUBLIC_NAME, publicKey, java.sql.Timestamp.from(now));
        jdbc.update("insert into server_key (name, value, created_at) values (?, ?, ?) on conflict do nothing",
                PRIVATE_NAME, privateKey, java.sql.Timestamp.from(now));
        log.info("Claves VAPID generadas y guardadas en la base de datos");
        // Si otra instancia las creó a la vez, se usan las que quedaron guardadas.
        return toKeys(read(PUBLIC_NAME), read(PRIVATE_NAME));
    }

    private String read(String name) {
        return jdbc.query("select value from server_key where name = ?", rs -> rs.next() ? rs.getString(1) : null,
                name);
    }

    private static Keys toKeys(String publicKey, String privateKey) {
        byte[] publicBytes = EcKeys.fromBase64Url(publicKey);
        return new Keys(EcKeys.decodePublic(publicBytes), EcKeys.decodePrivate(EcKeys.fromBase64Url(privateKey)),
                EcKeys.base64Url(publicBytes));
    }
}
