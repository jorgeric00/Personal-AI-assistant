package com.lifeos.fitness.photos;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.fitness.photos.PhotoDtos.PhotoRequest;
import com.lifeos.fitness.photos.PhotoDtos.PhotoResponse;
import com.lifeos.fitness.photos.PhotoProcessor.InvalidImageException;
import com.lifeos.fitness.photos.PhotoProcessor.Processed;

/** Diario fotográfico. Cada foto solo la puede ver, cambiar o borrar su dueño. */
@Service
public class ProgressPhotoService {

    private final ProgressPhotoRepository photos;
    private final PhotoProcessor processor;
    private final JdbcTemplate jdbc;
    private final LifeosProperties properties;
    private final Clock clock;

    public ProgressPhotoService(ProgressPhotoRepository photos, PhotoProcessor processor, JdbcTemplate jdbc,
            LifeosProperties properties, Clock clock) {
        this.photos = photos;
        this.processor = processor;
        this.jdbc = jdbc;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<PhotoResponse> list(UUID userId) {
        return photos.findByUserIdOrderByTakenOnDescCreatedAtDesc(userId).stream().map(PhotoResponse::from).toList();
    }

    /** Sube una foto. Los campos llegan como texto en el formulario multipart y se validan aquí. */
    @Transactional
    public PhotoResponse create(UUID userId, byte[] file, String takenOn, String pose, String notes) {
        LocalDate date = parseDate(takenOn);
        PhotoPose parsedPose = parsePose(pose);
        String cleanNotes = clean(notes);
        Processed processed = null;
        String fileError = null;
        if (file == null || file.length == 0) {
            fileError = "fitness.photos.file.required";
        } else {
            try {
                processed = processor.process(file);
            } catch (InvalidImageException e) {
                fileError = e.key();
            }
        }
        new FieldValidationException.Collector()
                .add(fileError != null, "file", fileError)
                .add(takenOn == null || takenOn.isBlank(), "takenOn", "fitness.photos.date.required")
                .add(takenOn != null && !takenOn.isBlank() && date == null, "takenOn", "fitness.photos.date.invalid")
                .add(date != null && date.isAfter(today()), "takenOn", "fitness.photos.date.future")
                .add(parsedPose == null, "pose", "fitness.photos.pose.required")
                .add(cleanNotes != null && cleanNotes.length() > 500, "notes", "fitness.photos.notes.too-long")
                .throwIfAny();
        ProgressPhoto photo = new ProgressPhoto(userId, processed.width(), processed.height(), clock.instant());
        photo.update(date, parsedPose, cleanNotes, clock.instant());
        photos.saveAndFlush(photo);
        jdbc.update("insert into progress_photo_data (photo_id, image, thumbnail) values (?, ?, ?)", photo.getId(),
                processed.image(), processed.thumbnail());
        return PhotoResponse.from(photo);
    }

    @Transactional
    public PhotoResponse update(UUID userId, UUID id, PhotoRequest request) {
        ProgressPhoto photo = find(userId, id);
        new FieldValidationException.Collector()
                .add(request.takenOn().isAfter(today()), "takenOn", "fitness.photos.date.future")
                .throwIfAny();
        photo.update(request.takenOn(), request.pose(), clean(request.notes()), clock.instant());
        return PhotoResponse.from(photo);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        photos.delete(find(userId, id));
    }

    /** Los bytes de la imagen o de la miniatura, solo si la foto es del usuario. */
    @Transactional(readOnly = true)
    public byte[] image(UUID userId, UUID id, boolean thumbnail) {
        find(userId, id);
        String column = thumbnail ? "thumbnail" : "image";
        return jdbc.queryForObject("select " + column + " from progress_photo_data where photo_id = ?", byte[].class,
                id);
    }

    private ProgressPhoto find(UUID userId, UUID id) {
        return photos.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }

    private static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.strip());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static PhotoPose parsePose(String value) {
        if (value == null) {
            return null;
        }
        try {
            return PhotoPose.valueOf(value.strip());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String clean(String notes) {
        return notes == null || notes.isBlank() ? null : notes.strip();
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(properties.timezone()));
    }
}
