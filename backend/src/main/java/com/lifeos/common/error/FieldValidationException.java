package com.lifeos.common.error;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Error de validación detectado en el servicio (reglas que dependen de varios campos).
 * Los valores son claves de messages*.properties; se traducen al responder.
 */
public class FieldValidationException extends RuntimeException {

    private final Map<String, String> fieldMessageKeys;

    public FieldValidationException(Map<String, String> fieldMessageKeys) {
        super("Datos no válidos: " + fieldMessageKeys);
        this.fieldMessageKeys = Map.copyOf(fieldMessageKeys);
    }

    public Map<String, String> fieldMessageKeys() {
        return fieldMessageKeys;
    }

    /** Acumula errores y lanza la excepción si hay alguno. */
    public static final class Collector {
        private final Map<String, String> errors = new LinkedHashMap<>();

        public Collector add(boolean condition, String field, String messageKey) {
            if (condition) {
                errors.putIfAbsent(field, messageKey);
            }
            return this;
        }

        public void throwIfAny() {
            if (!errors.isEmpty()) {
                throw new FieldValidationException(errors);
            }
        }
    }
}
