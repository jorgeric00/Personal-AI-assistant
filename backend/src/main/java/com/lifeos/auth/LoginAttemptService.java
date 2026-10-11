package com.lifeos.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import com.lifeos.common.config.LifeosProperties;

/**
 * Bloquea temporalmente una cuenta tras varios intentos fallidos seguidos.
 * El estado vive en memoria: un reinicio lo limpia, lo cual es aceptable para un único usuario.
 */
@Service
public class LoginAttemptService {

    private record Attempts(int failures, Instant firstFailure) {
    }

    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();
    private final int maxFailedAttempts;
    private final Duration lockout;
    private final Clock clock;

    public LoginAttemptService(LifeosProperties properties, Clock clock) {
        this.maxFailedAttempts = properties.login().maxFailedAttempts();
        this.lockout = properties.login().lockout();
        this.clock = clock;
    }

    /** Lanza {@link TooManyLoginAttemptsException} si la clave está bloqueada. */
    public void checkNotBlocked(String key) {
        Attempts current = activeAttempts(key);
        if (current != null && current.failures() >= maxFailedAttempts) {
            Duration remaining = Duration.between(clock.instant(), current.firstFailure().plus(lockout));
            throw new TooManyLoginAttemptsException(remaining);
        }
    }

    public void recordFailure(String key) {
        Instant now = clock.instant();
        attempts.compute(key, (k, current) -> {
            if (current == null || isExpired(current, now)) {
                return new Attempts(1, now);
            }
            return new Attempts(current.failures() + 1, current.firstFailure());
        });
    }

    public void recordSuccess(String key) {
        attempts.remove(key);
    }

    private Attempts activeAttempts(String key) {
        Attempts current = attempts.get(key);
        if (current != null && isExpired(current, clock.instant())) {
            attempts.remove(key, current);
            return null;
        }
        return current;
    }

    private boolean isExpired(Attempts current, Instant now) {
        return !now.isBefore(current.firstFailure().plus(lockout));
    }
}
