package com.lifeos.notes;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Size;

import com.lifeos.notes.Note.State;
import com.lifeos.tasks.TaskDtos.TaskRef;

public final class NoteDtos {

    private NoteDtos() {
    }

    public record NoteRequest(
            @Size(max = 200, message = "{note.title.too-long}") String title,
            @Size(max = 100_000, message = "{note.body.too-long}") String body,
            @Size(max = 20, message = "{note.tags.too-many}") List<String> tags,
            @Size(max = 20, message = "{note.tasks.too-many}") List<UUID> taskIds) {
    }

    /** Cambios rápidos sin tocar el contenido: los campos nulos no se modifican. */
    public record NoteFlagsRequest(Boolean pinned, Boolean favorite) {
    }

    public record NoteResponse(UUID id, String title, String body, List<String> tags, boolean pinned,
            boolean favorite, State state, List<TaskRef> tasks, Instant createdAt, Instant updatedAt,
            Instant trashedAt) {
    }

    public record NoteSummary(UUID id, String title, String excerpt, List<String> tags, boolean pinned,
            boolean favorite, State state, int taskCount, Instant createdAt, Instant updatedAt, Instant trashedAt) {
    }

    public record TagResponse(String name, long count) {
    }

}
