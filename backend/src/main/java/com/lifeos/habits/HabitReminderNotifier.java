package com.lifeos.habits;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.push.PushService;
import com.lifeos.user.AppUserRepository;

/**
 * Recordatorio de los hábitos con hora de aviso: solo los días que tocan y si aún no están marcados. En los
 * semanales, mientras no se hayan cumplido las veces de la semana. Un aviso al día como mucho, con tono neutro.
 */
@Component
public class HabitReminderNotifier {

    /** Si el servidor estuvo parado, el aviso aún se envía durante las dos horas siguientes. */
    static final Duration MAX_DELAY = Duration.ofHours(2);

    private static final Logger log = LoggerFactory.getLogger(HabitReminderNotifier.class);

    private final HabitRepository habits;
    private final AppUserRepository users;
    private final PushService pushService;
    private final JdbcTemplate jdbc;
    private final MessageSource messages;
    private final LifeosProperties properties;
    private final Clock clock;

    public HabitReminderNotifier(HabitRepository habits, AppUserRepository users, PushService pushService,
            JdbcTemplate jdbc, MessageSource messages, LifeosProperties properties, Clock clock) {
        this.habits = habits;
        this.users = users;
        this.pushService = pushService;
        this.jdbc = jdbc;
        this.messages = messages;
        this.properties = properties;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${lifeos.reminders.check-interval:30s}",
            initialDelayString = "${lifeos.reminders.check-interval:30s}")
    void scheduledRun() {
        if (properties.reminders().enabled()) {
            try {
                notifyDue();
            } catch (RuntimeException e) {
                log.error("Error al revisar los avisos de los hábitos", e);
            }
        }
    }

    /** Envía los avisos de hoy que ya tocan y devuelve cuántos se han enviado. */
    public int notifyDue() {
        Instant now = clock.instant();
        ZoneId zone = properties.timezone();
        LocalDate today = LocalDate.ofInstant(now, zone);
        Map<UUID, Locale> locales = new HashMap<>();
        int notified = 0;
        for (Habit habit : habits.findByArchivedFalseAndReminderTimeNotNull()) {
            Instant notifyAt = today.atTime(habit.getReminderTime()).atZone(zone).toInstant();
            if (notifyAt.isAfter(now) || notifyAt.isBefore(now.minus(MAX_DELAY)) || today.isBefore(habit.getStartDate())
                    || checked(habit, today)) {
                continue;
            }
            Integer weekChecks = null;
            if (habit.getFrequency() == HabitFrequency.WEEKLY) {
                weekChecks = checksThisWeek(habit, today);
                if (weekChecks >= habit.getTimesPerWeek()) {
                    continue;
                }
            } else {
                Set<DayOfWeek> days = habit.getWeekdays();
                if (!days.isEmpty() && !days.contains(today.getDayOfWeek())) {
                    continue;
                }
            }
            if (!claim(habit.getId(), today, now)) {
                continue;
            }
            Locale locale = locales.computeIfAbsent(habit.getUserId(), id -> users.findById(id)
                    .map(u -> Locale.forLanguageTag(u.getLocale())).orElse(Locale.ROOT));
            String body = weekChecks == null
                    ? messages.getMessage("push.habit.daily", null, locale)
                    : messages.getMessage("push.habit.weekly", new Object[] { weekChecks, habit.getTimesPerWeek() },
                            locale);
            int delivered = pushService.sendToUser(habit.getUserId(),
                    new PushService.Notification(habit.getName(), body, "/habitos", "habit-" + habit.getId()));
            if (delivered == 0 && pushService.subscriptionCount(habit.getUserId()) > 0) {
                // Ningún dispositivo lo recibió por un fallo temporal: se libera para reintentar.
                jdbc.update("delete from habit_notification where habit_id = ? and date = ?", habit.getId(),
                        Date.valueOf(today));
            } else {
                notified++;
            }
        }
        return notified;
    }

    private boolean checked(Habit habit, LocalDate day) {
        return jdbc.queryForObject("select count(*) from habit_check where habit_id = ? and date = ?", Integer.class,
                habit.getId(), Date.valueOf(day)) > 0;
    }

    private int checksThisWeek(Habit habit, LocalDate today) {
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return jdbc.queryForObject("select count(*) from habit_check where habit_id = ? and date between ? and ?",
                Integer.class, habit.getId(), Date.valueOf(monday), Date.valueOf(monday.plusDays(6)));
    }

    private boolean claim(UUID habitId, LocalDate day, Instant now) {
        return jdbc.update("""
                insert into habit_notification (habit_id, date, sent_at) values (?, ?, ?)
                on conflict do nothing""", habitId, Date.valueOf(day), Timestamp.from(now)) == 1;
    }
}
