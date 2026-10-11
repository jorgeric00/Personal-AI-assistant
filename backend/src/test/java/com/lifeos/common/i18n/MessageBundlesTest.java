package com.lifeos.common.i18n;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Properties;

import org.junit.jupiter.api.Test;

/** Todos los idiomas deben tener exactamente las mismas claves que el español. */
class MessageBundlesTest {

    @Test
    void englishHasSameKeysAsSpanish() throws IOException {
        assertThat(load("messages_en.properties").stringPropertyNames())
                .containsExactlyInAnyOrderElementsOf(load("messages.properties").stringPropertyNames());
    }

    private static Properties load(String name) throws IOException {
        Properties properties = new Properties();
        try (var reader = new InputStreamReader(
                MessageBundlesTest.class.getClassLoader().getResourceAsStream(name), StandardCharsets.UTF_8)) {
            properties.load(reader);
        }
        return properties;
    }
}
