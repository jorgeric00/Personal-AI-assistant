package com.lifeos.notes;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

interface NoteRepository extends JpaRepository<Note, UUID>, JpaSpecificationExecutor<Note> {

    Optional<Note> findByIdAndUserId(UUID id, UUID userId);

    @Query("""
            select t as name, count(n) as count from Note n join n.tags t
            where n.userId = :userId and n.state <> com.lifeos.notes.Note.State.TRASHED
            group by t order by t
            """)
    List<TagCount> countTags(UUID userId);

    @Query("select n from Note n where n.userId = :userId and n.state = com.lifeos.notes.Note.State.TRASHED")
    List<Note> findTrashed(UUID userId);

    @Query("select n from Note n where n.state = com.lifeos.notes.Note.State.TRASHED and n.trashedAt < :before")
    List<Note> findTrashedBefore(Instant before);

    interface TagCount {
        String getName();

        long getCount();
    }
}
