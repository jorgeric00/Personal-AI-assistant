package com.lifeos.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import com.lifeos.common.config.LifeosProperties;

class LoginAttemptServiceTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-01-01T10:00:00Z"));
    private final LoginAttemptService service = new LoginAttemptService(
            new LifeosProperties(ZoneId.of("Europe/Madrid"), new LifeosProperties.Admin(null, null, null),
                    new LifeosProperties.Login(3, Duration.ofMinutes(15))),
            clock);

    @Test
    void blocksAfterMaxFailures() {
        service.recordFailure("a");
        service.recordFailure("a");
        assertThatCode(() -> service.checkNotBlocked("a")).doesNotThrowAnyException();
        service.recordFailure("a");
        assertThatThrownBy(() -> service.checkNotBlocked("a")).isInstanceOf(TooManyLoginAttemptsException.class);
        assertThatCode(() -> service.checkNotBlocked("b")).doesNotThrowAnyException();
    }

    @Test
    void unblocksWhenLockoutExpires() {
        for (int i = 0; i < 3; i++) {
            service.recordFailure("a");
        }
        clock.advance(Duration.ofMinutes(15));
        assertThatCode(() -> service.checkNotBlocked("a")).doesNotThrowAnyException();
        service.recordFailure("a");
        assertThatCode(() -> service.checkNotBlocked("a")).doesNotThrowAnyException();
    }

    @Test
    void successResetsCounter() {
        service.recordFailure("a");
        service.recordFailure("a");
        service.recordSuccess("a");
        service.recordFailure("a");
        assertThatCode(() -> service.checkNotBlocked("a")).doesNotThrowAnyException();
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
