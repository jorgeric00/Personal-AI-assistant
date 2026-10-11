package com.lifeos.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

final class AuthDtos {

    private AuthDtos() {
    }

    record LoginRequest(
            @NotBlank(message = "{auth.login.email.required}")
            @Email(message = "{auth.login.email.invalid}")
            @Size(max = 254, message = "{auth.login.email.too-long}")
            String email,
            @NotBlank(message = "{auth.login.password.required}")
            @Size(max = 200, message = "{auth.login.password.too-long}")
            String password) {

        LoginRequest {
            // Los teclados móviles suelen añadir un espacio al autocompletar el correo.
            email = email == null ? null : email.trim();
        }
    }

    record CsrfResponse(String headerName, String token) {
    }
}
