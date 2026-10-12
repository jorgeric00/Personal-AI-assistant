package com.lifeos.notes;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Vacía periódicamente las notas que llevan más de 30 días en la papelera. */
@Component
public class NoteTrashCleaner {

    private static final Logger log = LoggerFactory.getLogger(NoteTrashCleaner.class);

    private final NoteService noteService;

    public NoteTrashCleaner(NoteService noteService) {
        this.noteService = noteService;
    }

    @Scheduled(initialDelayString = "PT5M", fixedDelayString = "PT6H")
    public void purge() {
        int deleted = noteService.purgeExpiredTrash();
        if (deleted > 0) {
            log.info("Borradas {} notas de la papelera", deleted);
        }
    }
}
