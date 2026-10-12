package com.lifeos.common.error;

/** El recurso no existe o no pertenece al usuario actual (en ambos casos se responde 404). */
public class NotFoundException extends RuntimeException {

    public NotFoundException() {
        super("No encontrado");
    }
}
