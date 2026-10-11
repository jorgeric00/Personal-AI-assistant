package com.lifeos.push;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class PushDtos {

    private PushDtos() {
    }

    public record PublicKeyResponse(String publicKey, long subscriptions) {
    }

    public record Keys(
            @NotBlank(message = "{push.subscription.invalid}") @Size(max = 200, message = "{push.subscription.invalid}") String p256dh,
            @NotBlank(message = "{push.subscription.invalid}") @Size(max = 100, message = "{push.subscription.invalid}") String auth) {
    }

    public record SubscriptionRequest(
            @NotBlank(message = "{push.subscription.invalid}")
            @Pattern(regexp = "^https://.+", message = "{push.subscription.invalid}")
            @Size(max = 2000, message = "{push.subscription.invalid}") String endpoint,
            @NotNull(message = "{push.subscription.invalid}") @Valid Keys keys) {
    }

    public record UnsubscribeRequest(@NotBlank(message = "{push.subscription.invalid}") String endpoint) {
    }

    public record TestResponse(int delivered) {
    }
}
