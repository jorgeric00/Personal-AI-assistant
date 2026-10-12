package com.lifeos.common.text;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/** Texto normalizado para buscar sin distinguir mayúsculas ni tildes ("cafe" encuentra "Café"). */
public final class SearchText {

    private static final Pattern SPACES = Pattern.compile("\\s+");

    private SearchText() {
    }

    public static String normalize(String text) {
        return Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT);
    }

    /** Palabras de la búsqueda; todas deben aparecer. */
    public static List<String> terms(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        return Arrays.stream(normalize(query).trim().split("\\s+")).distinct().limit(10).toList();
    }

    /** Patrón LIKE que busca el término literal (escapa %, _ y \). Usar con el carácter de escape '\'. */
    public static String containsPattern(String term) {
        return "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    /** Etiquetas en minúsculas, sin "#" inicial, con los espacios agrupados y sin repetir. */
    public static Set<String> normalizeTags(List<String> tags) {
        Set<String> result = new LinkedHashSet<>();
        for (String tag : Objects.requireNonNullElse(tags, List.<String>of())) {
            if (tag == null) {
                continue;
            }
            String normalized = SPACES.matcher(tag.strip().replaceFirst("^#+", "").strip()).replaceAll(" ")
                    .toLowerCase(Locale.ROOT);
            if (!normalized.isEmpty()) {
                result.add(normalized);
            }
        }
        return result;
    }
}
