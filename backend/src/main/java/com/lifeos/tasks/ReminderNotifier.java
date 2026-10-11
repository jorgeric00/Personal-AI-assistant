package com.lifeos.tasks;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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
import com.lifeos.user.AppUser;
import com.lifeos.user.AppUserRepository;

/**
 * Revisa periódicamente las tareas y recordatorios con aviso y envía la notificación push cuando llega su hora.
 * Cada aparición se notifica una sola vez (tabla task_notification), también en las tareas recurrentes.
 */
@Component
public class ReminderNotifier {

    /** Si el servidor estuvo parado, solo se envían los avisos de las últimas dos horas. */
    static final Duration MAX_DELAY = Duration.ofHours(2);
    /** El aviso más anticipado permitido es de 7 días. */
    private static final int LOOKAHEAD_DAYS = 8;

    private static final Logger log = LoggerFactory.getLogger(ReminderNotifier.class);
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final TaskRepository tasks;
    private final AppUserRepository users;
    private final PushService pushService;
    private final JdbcTemplate jdbc;
    private final MessageSource messages;
    private final LifeosProperties properties;
    private final Clock clock;

    public ReminderNotifier(TaskRepository tasks, AppUserRepository users, PushService pushService, JdbcTemplate jdbc,
            MessageSource messages, LifeosProperties properties, Clock clock) {
        this.tasks = tasks;
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
                log.error("Error al revisar los recordatorios", e);
            }
        }
    }

    /**
     * Envía los avisos pendientes. Devuelve cuántas apariciones se han notificado.
     * Sin transacción global: cada aviso se reserva y se envía por separado.
     */
    public int notifyDue() {
        Instant now = clock.instant();
        ZoneId zone = properties.timezone();
        LocalDate today = LocalDate.ofInstant(now, zone);
        Map<UUID, AppUser> userCache = new HashMap<>();
        int notified = 0;

        for (Task task : tasks.findWithNotificationUntil(today.plusDays(LOOKAHEAD_DAYS))) {
            for (LocalDate occurrence : candidateOccurrences(task, today)) {
                Instant notifyAt = occurrence.atTime(task.getDueTime()).atZone(zone)
                        .minusMinutes(task.getReminderMinutesBefore()).toInstant();
                if (notifyAt.isAfter(now) || notifyAt.isBefore(now.minus(MAX_DELAY))) {
                    continue;
                }
                if (!claim(task.getId(), occurrence, now)) {
                    continue;
                }
                AppUser user = userCache.computeIfAbsent(task.getUserId(), id -> users.findById(id).orElse(null));
                if (user == null) {
                    continue;
                }
                int delivered = pushService.sendToUser(user.getId(), notificationFor(task, occurrence, today, user));
                if (delivered == 0 && pushService.subscriptionCount(user.getId()) > 0) {
                    // Ningún dispositivo lo recibió por un fallo temporal: se libera para reintentar.
                    release(task.getId(), occurrence);
                } else {
                    notified++;
                }
            }
        }
        return notified;
    }

    private static List<LocalDate> candidateOccurrences(Task task, LocalDate today) {
        List<LocalDate> result = new ArrayList<>();
        result.add(task.getDueDate());
        if (task.isRecurring()) {
            // Las siguientes apariciones también se avisan aunque la actual siga pendiente.
            result.addAll(task.recurrence().occurrencesBetween(task.getDueDate().plusDays(1), today.minusDays(1),
                    today.plusDays(LOOKAHEAD_DAYS)));
        }
        return result;
    }

    private boolean claim(UUID taskId, LocalDate occurrence, Instant now) {
        return jdbc.update("""
                insert into task_notification (task_id, occurrence_date, sent_at) values (?, ?, ?)
                on conflict do nothing
                """, taskId, Date.valueOf(occurrence), Timestamp.from(now)) == 1;
    }

    private void release(UUID taskId, LocalDate occurrence) {
        jdbc.update("delete from task_notification where task_id = ? and occurrence_date = ?", taskId,
                Date.valueOf(occurrence));
    }

    private PushService.Notification notificationFor(Task task, LocalDate occurrence, LocalDate today, AppUser user) {
        Locale locale = Locale.forLanguageTag(user.getLocale());
        String time = TIME.format(task.getDueTime());
        String body;
        if (occurrence.equals(today)) {
            body = messages.getMessage("push.reminder.today", new Object[] {time}, locale);
        } else if (occurrence.equals(today.plusDays(1))) {
            body = messages.getMessage("push.reminder.tomorrow", new Object[] {time}, locale);
        } else {
            String date = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(locale).format(occurrence);
            body = messages.getMessage("push.reminder.on", new Object[] {date, time}, locale);
        }
        return new PushService.Notification(task.getTitle(), body, "/tareas",
                "task-" + task.getId() + "-" + occurrence);
    }
}
