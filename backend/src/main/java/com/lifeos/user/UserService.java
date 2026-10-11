package com.lifeos.user;

import java.time.Clock;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.user.UserDtos.CurrentUserResponse;
import com.lifeos.user.UserDtos.PreferencesRequest;

@Service
public class UserService {

    private final AppUserRepository users;
    private final LifeosProperties properties;
    private final Clock clock;

    public UserService(AppUserRepository users, LifeosProperties properties, Clock clock) {
        this.users = users;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CurrentUserResponse currentUser(UUID userId) {
        return toResponse(load(userId));
    }

    @Transactional
    public CurrentUserResponse updatePreferences(UUID userId, PreferencesRequest request) {
        AppUser user = load(userId);
        user.changeLocale(request.locale(), clock.instant());
        return toResponse(user);
    }

    private AppUser load(UUID userId) {
        return users.findById(userId).orElseThrow(() -> new IllegalStateException("Usuario de la sesión inexistente"));
    }

    private CurrentUserResponse toResponse(AppUser user) {
        return new CurrentUserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getLocale(),
                properties.timezone().getId());
    }
}
