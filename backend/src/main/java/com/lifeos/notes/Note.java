package com.lifeos.notes;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

import org.hibernate.annotations.BatchSize;

@Entity
@Table(name = "note")
public class Note {

    public enum State {
        ACTIVE, ARCHIVED, TRASHED
    }

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private State state;

    private boolean pinned;

    private boolean favorite;

    @Column(name = "search_text", nullable = false)
    private String searchText;

    @ElementCollection
    @CollectionTable(name = "note_tag", joinColumns = @JoinColumn(name = "note_id"))
    @Column(name = "name")
    @BatchSize(size = 100)
    private Set<String> tags = new LinkedHashSet<>();

    @ElementCollection
    @CollectionTable(name = "note_task", joinColumns = @JoinColumn(name = "note_id"))
    @Column(name = "task_id")
    @BatchSize(size = 100)
    private Set<UUID> taskIds = new LinkedHashSet<>();

    @Column(name = "trashed_at")
    private Instant trashedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Note() {
    }

    public Note(UUID userId, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.state = State.ACTIVE;
        this.title = "";
        this.body = "";
        this.searchText = "";
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void edit(String title, String body, Set<String> tags, Set<UUID> taskIds, Instant now) {
        this.title = title;
        this.body = body;
        this.tags.clear();
        this.tags.addAll(tags);
        this.taskIds.clear();
        this.taskIds.addAll(taskIds);
        this.searchText = SearchText.normalize(title + "\n" + body + "\n" + String.join(" ", tags));
        this.updatedAt = now;
    }

    public void setPinned(boolean pinned) {
        this.pinned = pinned;
    }

    public void setFavorite(boolean favorite) {
        this.favorite = favorite;
    }

    public void archive() {
        this.state = State.ARCHIVED;
        this.pinned = false;
    }

    public void unarchive() {
        this.state = State.ACTIVE;
    }

    public void trash(Instant now) {
        this.state = State.TRASHED;
        this.pinned = false;
        this.trashedAt = now;
    }

    public void restore() {
        this.state = State.ACTIVE;
        this.trashedAt = null;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public State getState() {
        return state;
    }

    public boolean isPinned() {
        return pinned;
    }

    public boolean isFavorite() {
        return favorite;
    }

    public Set<String> getTags() {
        return tags;
    }

    public Set<UUID> getTaskIds() {
        return taskIds;
    }

    public Instant getTrashedAt() {
        return trashedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
