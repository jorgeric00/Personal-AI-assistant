package com.lifeos.user;

import jakarta.validation.Valid;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lifeos.auth.AppUserPrincipal;
import com.lifeos.user.UserDtos.CurrentUserResponse;
import com.lifeos.user.UserDtos.PreferencesRequest;

@RestController
@RequestMapping("/api/me")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PatchMapping("/preferences")
    public CurrentUserResponse updatePreferences(@AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody PreferencesRequest request) {
        return userService.updatePreferences(principal.id(), request);
    }
}
