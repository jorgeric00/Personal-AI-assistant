package com.lifeos.user;

import java.time.Clock;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.lifeos.common.config.LifeosProperties;

/**
 * Crea la cuenta del propietario la primera vez que arranca la aplicación.
 * LifeOS es de un solo usuario: no hay registro público y nunca se sobrescribe una cuenta existente.
 */
@Component
public class AdminAccountInitializer implements ApplicationRunner {

    static final int MIN_PASSWORD_LENGTH = 12;

    private static final Logger log = LoggerFactory.getLogger(AdminAccountInitializer.class);

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final LifeosProperties properties;
    private final Clock clock;

    public AdminAccountInitializer(AppUserRepository users, PasswordEncoder passwordEncoder,
            LifeosProperties properties, Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.properties = properties;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.count() > 0) {
            return;
        }
        LifeosProperties.Admin admin = properties.admin();
        if (!StringUtils.hasText(admin.email()) || !StringUtils.hasText(admin.password())) {
            log.warn("No hay ninguna cuenta creada. Define LIFEOS_ADMIN_EMAIL y LIFEOS_ADMIN_PASSWORD y reinicia.");
            return;
        }
        if (admin.password().length() < MIN_PASSWORD_LENGTH) {
            throw new IllegalStateException(
                    "LIFEOS_ADMIN_PASSWORD debe tener al menos " + MIN_PASSWORD_LENGTH + " caracteres.");
        }
        String email = admin.email().trim().toLowerCase(Locale.ROOT);
        String displayName = StringUtils.hasText(admin.displayName())
                ? admin.displayName().trim()
                : email.substring(0, email.indexOf('@') > 0 ? email.indexOf('@') : email.length());
        users.save(new AppUser(email, displayName, passwordEncoder.encode(admin.password()), clock.instant()));
        log.info("Cuenta inicial creada para {}", email);
    }
}
