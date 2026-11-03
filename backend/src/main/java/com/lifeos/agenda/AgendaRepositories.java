package com.lifeos.agenda;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface ActivityCategoryRepository extends JpaRepository<ActivityCategory, UUID> {

    /** Marca las categorías iniciales como creadas; devuelve 1 solo a la petición que lo marca. */
    @Modifying
    @Query(value = "insert into agenda_settings (user_id, created_at) values (:userId, :now) on conflict do nothing",
            nativeQuery = true)
    int insertSettingsIfAbsent(UUID userId, Instant now);

    List<ActivityCategory> findByUserIdOrderByNameAsc(UUID userId);

    Optional<ActivityCategory> findByIdAndUserId(UUID id, UUID userId);

    @Query("""
            select count(c) > 0 from ActivityCategory c
            where c.userId = :userId and lower(c.name) = lower(:name) and c.id <> :excludeId
            """)
    boolean existsByName(UUID userId, String name, UUID excludeId);

    @Query("select distinct a.category.id from Activity a where a.userId = :userId")
    Set<UUID> findUsedIds(UUID userId);
}

interface ActivityRepository extends JpaRepository<Activity, UUID> {

    Optional<Activity> findByIdAndUserId(UUID id, UUID userId);

    /** Actividades que pueden tener apariciones en el rango: las repetidas que ya empezaron y las sueltas que lo tocan. */
    @Query("""
            select a from Activity a join fetch a.category
            where a.userId = :userId and a.startDate <= :to
              and (a.recurrenceFrequency is not null or a.endDate >= :from)
            """)
    List<Activity> findCandidates(UUID userId, LocalDate from, LocalDate to);

    /** Actividades con aviso que aún pueden tener apariciones desde {@code from}. */
    @Query("""
            select a from Activity a
            where a.reminderMinutesBefore is not null
              and (a.recurrenceFrequency is not null or a.startDate >= :from)
              and (a.recurrenceUntil is null or a.recurrenceUntil >= :from)
            """)
    List<Activity> findWithReminderFrom(LocalDate from);
}

interface ActivityOccurrenceRepository extends JpaRepository<ActivityOccurrence, ActivityOccurrence.Key> {

    @Query("select o from ActivityOccurrence o where o.key.activityId in :ids")
    List<ActivityOccurrence> findByActivityIds(Collection<UUID> ids);
}
