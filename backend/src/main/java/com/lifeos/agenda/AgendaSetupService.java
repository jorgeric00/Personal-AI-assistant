package com.lifeos.agenda;

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
 * Crea las categorías iniciales de la agenda en el idioma del usuario la primera vez que la usa. Después son suyas:
 * puede renombrarlas, archivarlas o borrarlas sin que vuelvan a aparecer.
 */
@Service
public class AgendaSetupService {

    private record DefaultCategory(String key, String color) {
    }

    static final List<DefaultCategory> DEFAULTS = List.of(
            new DefaultCategory("gym", "#0f766e"),
            new DefaultCategory("sport", "#16a34a"),
            new DefaultCategory("rest", "#6366f1"),
            new DefaultCategory("free-time", "#ca8a04"),
            new DefaultCategory("friends", "#db2777"),
            new DefaultCategory("travel", "#0284c7"),
            new DefaultCategory("errands", "#ea580c"),
            new DefaultCategory("appointments", "#7c3aed"),
            new DefaultCategory("other", "#64748b"));

    private final ActivityCategoryRepository categories;
    private final AppUserRepository users;
    private final MessageSource messages;
    private final Clock clock;

    public AgendaSetupService(ActivityCategoryRepository categories, AppUserRepository users, MessageSource messages,
            Clock clock) {
        this.categories = categories;
        this.users = users;
        this.messages = messages;
        this.clock = clock;
    }

    /** Si dos peticiones llegan a la vez, solo la que crea los ajustes crea las categorías. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ensureCategories(UUID userId) {
        if (categories.insertSettingsIfAbsent(userId, clock.instant()) == 0) {
            return;
        }
        Locale locale = users.findById(userId).map(u -> Locale.forLanguageTag(u.getLocale())).orElse(Locale.ROOT);
        DEFAULTS.forEach(d -> categories.save(new ActivityCategory(userId,
                messages.getMessage("agenda.category.default." + d.key(), null, locale), d.color(),
                clock.instant())));
    }
}
