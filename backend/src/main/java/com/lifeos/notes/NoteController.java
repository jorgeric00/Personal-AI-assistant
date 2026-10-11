package com.lifeos.notes;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.lifeos.auth.AppUserPrincipal;
import com.lifeos.notes.NoteDtos.NoteFlagsRequest;
import com.lifeos.notes.NoteDtos.NoteRequest;
import com.lifeos.notes.NoteDtos.NoteResponse;
import com.lifeos.notes.NoteDtos.NoteSummary;
import com.lifeos.notes.NoteDtos.TagResponse;

@RestController
@RequestMapping("/api")
public class NoteController {

    private final NoteService noteService;

    public NoteController(NoteService noteService) {
        this.noteService = noteService;
    }

    @GetMapping("/notes")
    public List<NoteSummary> list(@AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam(defaultValue = "ACTIVE") NoteService.View view,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) Boolean pinned,
            @RequestParam(required = false) UUID taskId) {
        return noteService.list(user.id(), view, new NoteService.Filter(q, tag, pinned, taskId));
    }

    @GetMapping("/note-tags")
    public List<TagResponse> tags(@AuthenticationPrincipal AppUserPrincipal user) {
        return noteService.tags(user.id());
    }

    @GetMapping("/notes/{id}")
    public NoteResponse get(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        return noteService.get(user.id(), id);
    }

    @PostMapping("/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public NoteResponse create(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody NoteRequest request) {
        return noteService.create(user.id(), request);
    }

    @PutMapping("/notes/{id}")
    public NoteResponse update(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody NoteRequest request) {
        return noteService.update(user.id(), id, request);
    }

    @PatchMapping("/notes/{id}")
    public NoteResponse setFlags(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @RequestBody NoteFlagsRequest request) {
        return noteService.setFlags(user.id(), id, request);
    }

    @PostMapping("/notes/{id}/archive")
    public NoteResponse archive(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        return noteService.archive(user.id(), id);
    }

    @PostMapping("/notes/{id}/unarchive")
    public NoteResponse unarchive(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        return noteService.unarchive(user.id(), id);
    }

    @PostMapping("/notes/{id}/trash")
    public NoteResponse trash(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        return noteService.trash(user.id(), id);
    }

    @PostMapping("/notes/{id}/restore")
    public NoteResponse restore(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        return noteService.restore(user.id(), id);
    }

    @DeleteMapping("/notes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        noteService.delete(user.id(), id);
    }

    @DeleteMapping("/notes/trash")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void emptyTrash(@AuthenticationPrincipal AppUserPrincipal user) {
        noteService.emptyTrash(user.id());
    }
}
