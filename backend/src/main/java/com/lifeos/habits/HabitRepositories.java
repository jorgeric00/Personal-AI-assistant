package com.lifeos.habits;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface HabitRepository extends JpaRepository<Habit, UUID> {

    Optional<Habit> findByIdAndUserId(UUID id, UUID userId);

    List<Habit> findByUserIdOrderByCreatedAtAsc(UUID userId);

    List<Habit> findByArchivedFalseAndReminderTimeNotNull();

    @Query("""
            select count(h) > 0 from Habit h
            where h.userId = :userId and lower(h.name) = lower(:name) and h.id <> :excludeId
            """)
    boolean existsByName(UUID userId, String name, UUID excludeId);
}

interface HabitCheckRepository extends JpaRepository<HabitCheck, HabitCheck.Key> {

    @Query("""
            select c from HabitCheck c
            where c.key.habitId in :habitIds and c.key.date between :from and :to
            order by c.key.date
            """)
    List<HabitCheck> findBetween(Collection<UUID> habitIds, LocalDate from, LocalDate to);
}
