package com.lifeos.fitness.photos;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class PhotoDtos {

    private PhotoDtos() {
    }

    public record PhotoRequest(
            @NotNull(message = "{fitness.photos.date.required}") LocalDate takenOn,
            @NotNull(message = "{fitness.photos.pose.required}") PhotoPose pose,
            @Size(max = 500, message = "{fitness.photos.notes.too-long}") String notes) {
    }

    public record PhotoResponse(UUID id, LocalDate takenOn, PhotoPose pose, String notes, int width, int height) {

        static PhotoResponse from(ProgressPhoto p) {
            return new PhotoResponse(p.getId(), p.getTakenOn(), p.getPose(), p.getNotes(), p.getWidth(),
                    p.getHeight());
        }
    }
}
