package com.lifeos.common.i18n;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import com.lifeos.user.SupportedLocales;

@Configuration
public class LocaleConfig {

    /** El idioma de cada petición sale de la cabecera Accept-Language que envía la app. */
    @Bean
    LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setSupportedLocales(SupportedLocales.ALL);
        resolver.setDefaultLocale(SupportedLocales.DEFAULT);
        return resolver;
    }
}
