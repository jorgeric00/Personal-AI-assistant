package com.lifeos.fitness;

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

interface FitnessProfileRepository extends JpaRepository<FitnessProfile, UUID> {
}

interface BodyMeasurementRepository extends JpaRepository<BodyMeasurement, UUID> {

    List<BodyMeasurement> findByUserIdOrderByDateDesc(UUID userId);

    Optional<BodyMeasurement> findByIdAndUserId(UUID id, UUID userId);

    Optional<BodyMeasurement> findByUserIdAndDate(UUID userId, LocalDate date);

    Optional<BodyMeasurement> findFirstByUserIdAndWeightKgNotNullOrderByDateDesc(UUID userId);
}

interface ExerciseRepository extends JpaRepository<Exercise, UUID> {

    /** Marca el catálogo como creado; devuelve 1 solo a la petición que lo marca. */
    @Modifying
    @Query(value = "insert into fitness_settings (user_id, created_at) values (:userId, :now) on conflict do nothing",
            nativeQuery = true)
    int insertSettingsIfAbsent(UUID userId, Instant now);

    List<Exercise> findByUserIdOrderByNameAsc(UUID userId);

    Optional<Exercise> findByIdAndUserId(UUID id, UUID userId);

    List<Exercise> findByUserIdAndIdIn(UUID userId, Collection<UUID> ids);

    @Query("""
            select count(e) > 0 from Exercise e
            where e.userId = :userId and lower(e.name) = lower(:name) and e.id <> :excludeId
            """)
    boolean existsByName(UUID userId, String name, UUID excludeId);

    /** Ejercicios que aparecen en alguna rutina (o, más adelante, en algún entrenamiento). */
    @Query("select distinct re.exercise.id from RoutineExercise re where re.exercise.userId = :userId")
    Set<UUID> findUsedIds(UUID userId);
}

interface RoutineRepository extends JpaRepository<Routine, UUID> {

    @Query("select distinct r from Routine r left join fetch r.exercises re left join fetch re.exercise "
            + "where r.userId = :userId order by r.name")
    List<Routine> findAllWithExercises(UUID userId);

    Optional<Routine> findByIdAndUserId(UUID id, UUID userId);

    @Query("""
            select count(r) > 0 from Routine r
            where r.userId = :userId and lower(r.name) = lower(:name) and r.id <> :excludeId
            """)
    boolean existsByName(UUID userId, String name, UUID excludeId);
}
