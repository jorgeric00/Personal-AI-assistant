package com.lifeos.finance;

import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.user.AppUserRepository;

/**
 * Prepara el módulo para un usuario la primera vez que lo usa: ajustes (moneda EUR) y categorías iniciales en su
 * idioma, que después puede editar o archivar. Si dos peticiones llegan a la vez, solo una crea las categorías.
 */
@Service
public class FinanceSetupService {

    public static final String DEFAULT_CURRENCY = "EUR";

    private record DefaultCategory(MovementKind kind, String key, String color) {
    }

    private static final List<DefaultCategory> DEFAULTS = List.of(
            new DefaultCategory(MovementKind.EXPENSE, "housing", "#2563eb"),
            new DefaultCategory(MovementKind.EXPENSE, "groceries", "#16a34a"),
            new DefaultCategory(MovementKind.EXPENSE, "eating-out", "#ea580c"),
            new DefaultCategory(MovementKind.EXPENSE, "transport", "#0891b2"),
            new DefaultCategory(MovementKind.EXPENSE, "sport", "#0f766e"),
            new DefaultCategory(MovementKind.EXPENSE, "health", "#db2777"),
            new DefaultCategory(MovementKind.EXPENSE, "shopping", "#7c3aed"),
            new DefaultCategory(MovementKind.EXPENSE, "subscriptions", "#ca8a04"),
            new DefaultCategory(MovementKind.EXPENSE, "travel", "#0284c7"),
            new DefaultCategory(MovementKind.EXPENSE, "other-expense", "#64748b"),
            new DefaultCategory(MovementKind.INCOME, "salary", "#16a34a"),
            new DefaultCategory(MovementKind.INCOME, "other-income", "#0f766e"));

    private final FinanceSettingsRepository settings;
    private final FinanceCategoryRepository categories;
    private final AppUserRepository users;
    private final MessageSource messages;
    private final Clock clock;

    public FinanceSetupService(FinanceSettingsRepository settings, FinanceCategoryRepository categories,
            AppUserRepository users, MessageSource messages, Clock clock) {
        this.settings = settings;
        this.categories = categories;
        this.users = users;
        this.messages = messages;
        this.clock = clock;
    }

    /** Devuelve la moneda del usuario, preparando el módulo si hace falta. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String currency(UUID userId) {
        return settings.findById(userId).map(FinanceSettings::getCurrency).orElseGet(() -> initialize(userId));
    }

    private String initialize(UUID userId) {
        if (settings.insertIfAbsent(userId, DEFAULT_CURRENCY, clock.instant()) == 1) {
            Locale locale = users.findById(userId).map(u -> Locale.forLanguageTag(u.getLocale())).orElse(Locale.ROOT);
            DEFAULTS.forEach(d -> categories.save(new FinanceCategory(userId, d.kind(),
                    messages.getMessage("finance.category.default." + d.key(), null, locale), d.color(),
                    clock.instant())));
        }
        return DEFAULT_CURRENCY;
    }
}
