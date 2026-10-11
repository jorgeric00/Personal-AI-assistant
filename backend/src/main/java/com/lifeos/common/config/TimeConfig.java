package com.lifeos.common.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TimeConfig {

    /** Reloj del sistema en UTC; las fechas se convierten a la zona del usuario al mostrarlas. */
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
