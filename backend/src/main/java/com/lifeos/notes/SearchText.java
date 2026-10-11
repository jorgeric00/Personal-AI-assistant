package com.lifeos.notes;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** Texto normalizado para buscar sin distinguir mayúsculas ni tildes ("cafe" encuentra "Café"). */
final class SearchText {

    private SearchText() {
    }

    static String normalize(String text) {
        return Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT);
    }

    /** Palabras de la búsqueda; todas deben aparecer en la nota. */
    static List<String> terms(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        return Arrays.stream(normalize(query).trim().split("\\s+")).distinct().limit(10).toList();
    }
}
