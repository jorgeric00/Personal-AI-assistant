package com.lifeos.agenda;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
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
 * Avisa de las actividades de la agenda con aviso cuando llega su hora (los minutos indicados antes de empezar).
 * Cada aparición se avisa una vez (tabla activity_notification); las canceladas no se avisan.
 */
@Component
public class ActivityReminderNotifier {

    /** Si el servidor estuvo parado, solo se envían los avisos de las últimas dos horas, como en las tareas. */
    static final Duration MAX_DELAY = Duration.ofHours(2);
    /** El aviso más anticipado permitido es de 7 días. */
    private static final int LOOKAHEAD_DAYS = 8;

    private static final Logger log = LoggerFactory.getLogger(ActivityReminderNotifier.class);
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final ActivityRepository activities;
    private final AppUserRepository users;
    private final PushService pushService;
    private final JdbcTemplate jdbc;
    private final MessageSource messages;
    private final LifeosProperties properties;
    private final Clock clock;

    public ActivityReminderNotifier(ActivityRepository activities, AppUserRepository users, PushService pushService,
            JdbcTemplate jdbc, MessageSource messages, LifeosProperties properties, Clock clock) {
        this.activities = activities;
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
                log.error("Error al revisar los avisos de la agenda", e);
            }
        }
    }

    /** Envía los avisos pendientes y devuelve cuántas apariciones se han notificado. */
    public int notifyDue() {
        Instant now = clock.instant();
        ZoneId zone = properties.timezone();
        LocalDate today = LocalDate.ofInstant(now, zone);
        Map<UUID, Locale> locales = new HashMap<>();
        int notified = 0;
        for (Activity activity : activities.findWithReminderFrom(today.minusDays(1))) {
            for (LocalDate date : activity.occurrencesTouching(today.minusDays(1), today.plusDays(LOOKAHEAD_DAYS))) {
                Instant notifyAt = date.atTime(activity.getStartTime()).atZone(zone)
                        .minusMinutes(activity.getReminderMinutesBefore()).toInstant();
                if (notifyAt.isAfter(now) || notifyAt.isBefore(now.minus(MAX_DELAY)) || cancelled(activity, date)
                        || !claim(activity.getId(), date, now)) {
                    continue;
                }
                Locale locale = locales.computeIfAbsent(activity.getUserId(), id -> users.findById(id)
                        .map(u -> Locale.forLanguageTag(u.getLocale())).orElse(Locale.ROOT));
                int delivered = pushService.sendToUser(activity.getUserId(),
                        notificationFor(activity, date, today, locale));
                if (delivered == 0 && pushService.subscriptionCount(activity.getUserId()) > 0) {
                    // Ningún dispositivo lo recibió por un fallo temporal: se libera para reintentar.
                    jdbc.update("delete from activity_notification where activity_id = ? and occurrence_date = ?",
                            activity.getId(), Date.valueOf(date));
                } else {
                    notified++;
                }
            }
        }
        return notified;
    }

    private boolean cancelled(Activity activity, LocalDate date) {
        return jdbc.queryForObject("""
                select count(*) from activity_occurrence
                where activity_id = ? and occurrence_date = ? and status = 'CANCELLED'""", Integer.class,
                activity.getId(), Date.valueOf(date)) > 0;
    }

    private boolean claim(UUID activityId, LocalDate date, Instant now) {
        return jdbc.update("""
                insert into activity_notification (activity_id, occurrence_date, sent_at) values (?, ?, ?)
                on conflict do nothing""", activityId, Date.valueOf(date), Timestamp.from(now)) == 1;
    }

    private PushService.Notification notificationFor(Activity activity, LocalDate date, LocalDate today,
            Locale locale) {
        String time = TIME.format(activity.getStartTime());
        String body;
        if (date.equals(today)) {
            body = messages.getMessage("push.reminder.today", new Object[] { time }, locale);
        } else if (date.equals(today.plusDays(1))) {
            body = messages.getMessage("push.reminder.tomorrow", new Object[] { time }, locale);
        } else {
            String day = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(locale).format(date);
            body = messages.getMessage("push.reminder.on", new Object[] { day, time }, locale);
        }
        if (activity.getLocation() != null) {
            body = body + " · " + activity.getLocation();
        }
        return new PushService.Notification(activity.getTitle(), body,
                "/agenda?vista=DAY&fecha=" + date, "activity-" + activity.getId() + "-" + date);
    }
}
