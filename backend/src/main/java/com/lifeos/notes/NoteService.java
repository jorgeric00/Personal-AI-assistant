package com.lifeos.notes;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import jakarta.persistence.criteria.Predicate;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.error.ConflictException;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.common.text.SearchText;
import com.lifeos.notes.Note.State;
import com.lifeos.notes.NoteDtos.NoteFlagsRequest;
import com.lifeos.notes.NoteDtos.NoteRequest;
import com.lifeos.notes.NoteDtos.NoteResponse;
import com.lifeos.notes.NoteDtos.NoteSummary;
import com.lifeos.notes.NoteDtos.TagResponse;
import com.lifeos.tasks.TaskDtos.TaskRef;
import com.lifeos.tasks.TaskService;

@Service
public class NoteService {

    /** Las notas pasan este tiempo en la papelera antes de borrarse para siempre. */
    public static final Duration TRASH_RETENTION = Duration.ofDays(30);

    private static final int EXCERPT_LENGTH = 240;
    private static final int TAG_MAX_LENGTH = 40;

    public enum View {
        ACTIVE, FAVORITES, ARCHIVED, TRASH
    }

    public record Filter(String query, String tag, Boolean pinned, UUID taskId) {
    }

    private final NoteRepository notes;
    private final TaskService taskService;
    private final Clock clock;

    public NoteService(NoteRepository notes, TaskService taskService, Clock clock) {
        this.notes = notes;
        this.taskService = taskService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<NoteSummary> list(UUID userId, View view, Filter filter) {
        Sort sort = view == View.TRASH ? Sort.by(Sort.Order.desc("trashedAt"))
                : Sort.by(Sort.Order.desc("pinned"), Sort.Order.desc("updatedAt"));
        return notes.findAll(spec(userId, view, filter), sort).stream().map(NoteService::toSummary).toList();
    }

    @Transactional(readOnly = true)
    public List<TagResponse> tags(UUID userId) {
        return notes.countTags(userId).stream().map(t -> new TagResponse(t.getName(), t.getCount())).toList();
    }

    @Transactional(readOnly = true)
    public NoteResponse get(UUID userId, UUID noteId) {
        return toResponse(load(userId, noteId));
    }

    @Transactional
    public NoteResponse create(UUID userId, NoteRequest request) {
        Note note = new Note(userId, clock.instant());
        apply(userId, note, request);
        return toResponse(notes.save(note));
    }

    @Transactional
    public NoteResponse update(UUID userId, UUID noteId, NoteRequest request) {
        Note note = loadEditable(userId, noteId);
        apply(userId, note, request);
        return toResponse(note);
    }

    @Transactional
    public NoteResponse setFlags(UUID userId, UUID noteId, NoteFlagsRequest request) {
        Note note = loadEditable(userId, noteId);
        if (request.pinned() != null) {
            if (request.pinned() && note.getState() == State.ARCHIVED) {
                throw new ConflictException("note-archived");
            }
            note.setPinned(request.pinned());
        }
        if (request.favorite() != null) {
            note.setFavorite(request.favorite());
        }
        return toResponse(note);
    }

    @Transactional
    public NoteResponse archive(UUID userId, UUID noteId) {
        Note note = loadEditable(userId, noteId);
        note.archive();
        return toResponse(note);
    }

    @Transactional
    public NoteResponse unarchive(UUID userId, UUID noteId) {
        Note note = loadEditable(userId, noteId);
        note.unarchive();
        return toResponse(note);
    }

    @Transactional
    public NoteResponse trash(UUID userId, UUID noteId) {
        Note note = load(userId, noteId);
        if (note.getState() != State.TRASHED) {
            note.trash(clock.instant());
        }
        return toResponse(note);
    }

    @Transactional
    public NoteResponse restore(UUID userId, UUID noteId) {
        Note note = load(userId, noteId);
        note.restore();
        return toResponse(note);
    }

    /** Solo se borran para siempre las notas que ya están en la papelera. */
    @Transactional
    public void delete(UUID userId, UUID noteId) {
        Note note = load(userId, noteId);
        if (note.getState() != State.TRASHED) {
            throw new ConflictException("note-not-in-trash");
        }
        notes.delete(note);
    }

    @Transactional
    public int emptyTrash(UUID userId) {
        List<Note> trashed = notes.findTrashed(userId);
        notes.deleteAll(trashed);
        return trashed.size();
    }

    /** Borra las notas que llevan más de {@link #TRASH_RETENTION} en la papelera. */
    @Transactional
    public int purgeExpiredTrash() {
        List<Note> expired = notes.findTrashedBefore(clock.instant().minus(TRASH_RETENTION));
        notes.deleteAll(expired);
        return expired.size();
    }

    private void apply(UUID userId, Note note, NoteRequest request) {
        String title = Objects.requireNonNullElse(request.title(), "").strip();
        String body = Objects.requireNonNullElse(request.body(), "").stripTrailing();
        Set<String> tags = SearchText.normalizeTags(request.tags());
        Set<UUID> taskIds = new LinkedHashSet<>(Objects.requireNonNullElse(request.taskIds(), List.of()));
        Map<UUID, TaskRef> found = taskService.refs(userId, taskIds);
        new FieldValidationException.Collector()
                .add(title.isEmpty() && body.isBlank(), "body", "note.empty")
                .add(tags.stream().anyMatch(t -> t.length() > TAG_MAX_LENGTH), "tags", "note.tags.too-long")
                .add(found.size() != taskIds.size(), "taskIds", "note.tasks.invalid")
                .throwIfAny();
        note.edit(title, body, tags, taskIds, clock.instant());
    }

    private Note load(UUID userId, UUID noteId) {
        return notes.findByIdAndUserId(noteId, userId).orElseThrow(NotFoundException::new);
    }

    /** Las notas de la papelera solo se pueden restaurar o borrar. */
    private Note loadEditable(UUID userId, UUID noteId) {
        Note note = load(userId, noteId);
        if (note.getState() == State.TRASHED) {
            throw new ConflictException("note-in-trash");
        }
        return note;
    }

    private static Specification<Note> spec(UUID userId, View view, Filter filter) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("userId"), userId));
            switch (view) {
                case ACTIVE -> predicates.add(cb.equal(root.get("state"), State.ACTIVE));
                case ARCHIVED -> predicates.add(cb.equal(root.get("state"), State.ARCHIVED));
                case TRASH -> predicates.add(cb.equal(root.get("state"), State.TRASHED));
                case FAVORITES -> {
                    predicates.add(cb.notEqual(root.get("state"), State.TRASHED));
                    predicates.add(cb.isTrue(root.get("favorite")));
                }
            }
            if (filter.pinned() != null) {
                predicates.add(cb.equal(root.get("pinned"), filter.pinned()));
            }
            if (filter.tag() != null && !filter.tag().isBlank()) {
                Set<String> tag = SearchText.normalizeTags(List.of(filter.tag()));
                predicates.add(cb.isMember(tag.isEmpty() ? "" : tag.iterator().next(), root.get("tags")));
            }
            if (filter.taskId() != null) {
                predicates.add(cb.isMember(filter.taskId(), root.get("taskIds")));
            }
            for (String term : SearchText.terms(filter.query())) {
                predicates.add(cb.like(root.get("searchText"), SearchText.containsPattern(term), '\\'));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static NoteSummary toSummary(Note note) {
        String body = note.getBody().strip();
        String excerpt = body.length() <= EXCERPT_LENGTH ? body : body.substring(0, EXCERPT_LENGTH).stripTrailing() + "…";
        return new NoteSummary(note.getId(), note.getTitle(), excerpt, sortedTags(note), note.isPinned(),
                note.isFavorite(), note.getState(), note.getTaskIds().size(), note.getCreatedAt(), note.getUpdatedAt(),
                note.getTrashedAt());
    }

    private NoteResponse toResponse(Note note) {
        Map<UUID, TaskRef> refs = taskService.refs(note.getUserId(), note.getTaskIds());
        List<TaskRef> tasks = note.getTaskIds().stream().map(refs::get).filter(Objects::nonNull).toList();
        return new NoteResponse(note.getId(), note.getTitle(), note.getBody(), sortedTags(note), note.isPinned(),
                note.isFavorite(), note.getState(), tasks, note.getCreatedAt(), note.getUpdatedAt(),
                note.getTrashedAt());
    }

    private static List<String> sortedTags(Note note) {
        return note.getTags().stream().sorted(Comparator.naturalOrder()).toList();
    }
}
