package com.lifeos.common.error;

/** La operación no es posible en el estado actual. El código se traduce con error.&lt;código&gt;.title/detail. */
public class ConflictException extends RuntimeException {

    private final String code;

    public ConflictException(String code) {
        super(code);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
