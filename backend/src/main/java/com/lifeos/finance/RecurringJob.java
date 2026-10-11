package com.lifeos.finance;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Genera cada hora los movimientos recurrentes que tocan, aunque nadie abra la app. */
@Component
public class RecurringJob {

    private static final Logger log = LoggerFactory.getLogger(RecurringJob.class);

    private final RecurringService recurringService;

    public RecurringJob(RecurringService recurringService) {
        this.recurringService = recurringService;
    }

    @Scheduled(initialDelayString = "PT2M", fixedDelayString = "PT1H")
    public void run() {
        for (UUID userId : recurringService.usersWithDue()) {
            try {
                recurringService.generateDue(userId);
            } catch (RuntimeException e) {
                log.warn("No se han podido generar los movimientos recurrentes de {}", userId, e);
            }
        }
    }
}
