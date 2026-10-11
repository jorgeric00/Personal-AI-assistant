package com.lifeos.push;

import jakarta.validation.Valid;

import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.lifeos.auth.AppUserPrincipal;
import com.lifeos.common.error.ConflictException;
import com.lifeos.push.PushDtos.PublicKeyResponse;
import com.lifeos.push.PushDtos.SubscriptionRequest;
import com.lifeos.push.PushDtos.TestResponse;
import com.lifeos.push.PushDtos.UnsubscribeRequest;

@RestController
@RequestMapping("/api/push")
public class PushController {

    private final PushService pushService;
    private final VapidKeys vapidKeys;
    private final MessageSource messages;

    public PushController(PushService pushService, VapidKeys vapidKeys, MessageSource messages) {
        this.pushService = pushService;
        this.vapidKeys = vapidKeys;
        this.messages = messages;
    }

    @GetMapping("/public-key")
    public PublicKeyResponse publicKey(@AuthenticationPrincipal AppUserPrincipal user) {
        return new PublicKeyResponse(vapidKeys.publicKey(), pushService.subscriptionCount(user.id()));
    }

    @PostMapping("/subscriptions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void subscribe(@AuthenticationPrincipal AppUserPrincipal user, @Valid @RequestBody SubscriptionRequest request,
            @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent) {
        pushService.subscribe(user.id(), request, userAgent);
    }

    @DeleteMapping("/subscriptions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsubscribe(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody UnsubscribeRequest request) {
        pushService.unsubscribe(user.id(), request.endpoint());
    }

    /** Envía una notificación de prueba a todos los dispositivos del usuario. */
    @PostMapping("/test")
    public TestResponse test(@AuthenticationPrincipal AppUserPrincipal user) {
        if (pushService.subscriptionCount(user.id()) == 0) {
            throw new ConflictException("push-no-subscriptions");
        }
        var locale = LocaleContextHolder.getLocale();
        int delivered = pushService.sendToUser(user.id(), new PushService.Notification(
                messages.getMessage("push.test.title", null, locale),
                messages.getMessage("push.test.body", null, locale), "/ajustes", "lifeos-test"));
        if (delivered == 0) {
            throw new ConflictException("push-delivery-failed");
        }
        return new TestResponse(delivered);
    }
}
