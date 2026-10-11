package com.lifeos.user;

import java.util.List;
import java.util.Locale;

/** Idiomas disponibles en LifeOS. El español es el idioma por defecto. */
public final class SupportedLocales {

    public static final Locale DEFAULT = Locale.forLanguageTag("es");
    public static final List<Locale> ALL = List.of(DEFAULT, Locale.ENGLISH);

    /** Expresión regular para validar el idioma recibido en peticiones. */
    public static final String PATTERN = "es|en";

    private SupportedLocales() {
    }
}
