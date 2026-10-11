package com.lifeos.auth;

import java.time.Duration;

public class TooManyLoginAttemptsException extends RuntimeException {

    private final Duration retryAfter;

    public TooManyLoginAttemptsException(Duration retryAfter) {
        super("Demasiados intentos fallidos");
        this.retryAfter = retryAfter.isNegative() ? Duration.ZERO : retryAfter;
    }

    public Duration retryAfter() {
        return retryAfter;
    }
}
