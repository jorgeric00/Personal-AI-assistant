package com.lifeos.support;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** Reloj controlable para pruebas. Por defecto sigue la hora real hasta que se fija. */
public final class MutableClock extends Clock {

    private Instant fixed;

    public void set(Instant instant) {
        this.fixed = instant;
    }

    public void advance(Duration duration) {
        this.fixed = instant().plus(duration);
    }

    public void reset() {
        this.fixed = null;
    }

    @Override
    public ZoneId getZone() {
        return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return Clock.fixed(instant(), zone);
    }

    @Override
    public Instant instant() {
        return fixed != null ? fixed : Instant.now();
    }
}
