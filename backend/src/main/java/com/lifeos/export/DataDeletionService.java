package com.lifeos.export;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.auth.LoginAttemptService;
import com.lifeos.common.error.FieldValidationException;

/**
 * Borrado definitivo de bloques de datos del usuario. Pide la contraseña para que una sesión abierta en un
 * dispositivo ajeno no baste, y limita los intentos fallidos igual que el inicio de sesión. Todo o nada: si algo
 * falla no se borra ningún bloque. La cuenta y las notificaciones del dispositivo se conservan.
 */
@Service
public class DataDeletionService {

    private static final Logger log = LoggerFactory.getLogger(DataDeletionService.class);

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptService attempts;

    public DataDeletionService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder, LoginAttemptService attempts) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.attempts = attempts;
    }

    @Transactional
    public void delete(UUID userId, Set<DataScope> scopes, String password) {
        String key = "delete-data:" + userId;
        attempts.checkNotBlocked(key);
        new FieldValidationException.Collector()
                .add(scopes == null || scopes.isEmpty(), "scopes", "data.scopes.required")
                .add(password == null || password.isEmpty(), "password", "data.password.required")
                .throwIfAny();
        String hash = jdbc.queryForObject("select password_hash from app_user where id = ?", String.class, userId);
        if (!passwordEncoder.matches(password, hash)) {
            attempts.recordFailure(key);
            throw new FieldValidationException(Map.of("password", "data.password.wrong"));
        }
        attempts.recordSuccess(key);
        // En el orden del enum: así los bloques que dependen de otros (como los objetivos) no se cruzan
        for (DataScope scope : EnumSet.copyOf(scopes)) {
            for (String table : scope.tables()) {
                jdbc.update("delete from " + table + " where user_id = ?", userId);
            }
        }
        log.info("Datos borrados a petición del usuario {}: {}", userId, scopes);
    }
}
