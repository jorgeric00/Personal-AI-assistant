package com.lifeos.auth;

import java.util.UUID;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

final class AuthDtos {

    private AuthDtos() {
    }

    record LoginRequest(
            @NotBlank(message = "Introduce tu correo electrónico")
            @Email(message = "El correo electrónico no es válido")
            @Size(max = 254, message = "El correo electrónico es demasiado largo")
            String email,
            @NotBlank(message = "Introduce tu contraseña")
            @Size(max = 200, message = "La contraseña es demasiado larga")
            String password) {

        LoginRequest {
            // Los teclados móviles suelen añadir un espacio al autocompletar el correo.
            email = email == null ? null : email.trim();
        }
    }

    record CurrentUserResponse(UUID id, String email, String displayName, String timezone) {
    }

    record CsrfResponse(String headerName, String token) {
    }
}
