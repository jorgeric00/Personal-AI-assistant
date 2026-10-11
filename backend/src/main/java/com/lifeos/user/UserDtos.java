package com.lifeos.user;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public final class UserDtos {

    private UserDtos() {
    }

    public record CurrentUserResponse(UUID id, String email, String displayName, String locale, String timezone) {
    }

    public record PreferencesRequest(
            @NotNull(message = "{user.locale.invalid}")
            @Pattern(regexp = SupportedLocales.PATTERN, message = "{user.locale.invalid}")
            String locale) {
    }
}
