package com.lifeos.fitness;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Limit;
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

    /** Ejercicios que aparecen en alguna rutina o en algún entrenamiento. */
    @Query("""
            select e.id from Exercise e where e.userId = :userId
            and (exists (select 1 from RoutineExercise re where re.exercise = e)
                 or exists (select 1 from WorkoutExercise we where we.exercise = e))
            """)
    Set<UUID> findUsedIds(UUID userId);
}

interface RoutineRepository extends JpaRepository<Routine, UUID> {

    @Query("select distinct r from Routine r left join fetch r.exercises re left join fetch re.exercise "
            + "where r.userId = :userId order by r.name")
    List<Routine> findAllWithExercises(UUID userId);

    Optional<Routine> findByIdAndUserId(UUID id, UUID userId);

    List<Routine> findByUserIdAndWeekdaysNotNull(UUID userId);

    @Query("""
            select count(r) > 0 from Routine r
            where r.userId = :userId and lower(r.name) = lower(:name) and r.id <> :excludeId
            """)
    boolean existsByName(UUID userId, String name, UUID excludeId);
}

interface WorkoutRepository extends JpaRepository<Workout, UUID> {

    Optional<Workout> findByIdAndUserId(UUID id, UUID userId);

    List<Workout> findByUserIdAndDateBetweenOrderByDateAscCreatedAtAsc(UUID userId, LocalDate from, LocalDate to);

    @Query("""
            select new com.lifeos.fitness.WorkoutDtos$WorkoutSummary(w.id, w.routineId, w.name, w.date, w.finishedAt,
                count(distinct we.id), sum(case when s.done = true then 1 else 0 end))
            from Workout w left join w.exercises we left join we.sets s
            where w.userId = :userId
            group by w.id, w.routineId, w.name, w.date, w.finishedAt, w.createdAt
            order by w.date desc, w.createdAt desc
            """)
    List<WorkoutDtos.WorkoutSummary> findSummaries(UUID userId);

    /** La última vez (anterior o del mismo día) que se terminó un entrenamiento con series hechas del ejercicio. */
    @Query("""
            select we from WorkoutExercise we join we.workout w
            where w.userId = :userId and we.exercise.id = :exerciseId and w.finishedAt is not null
              and w.id <> :excludeId and w.date <= :date
              and exists (select 1 from WorkoutSet s where s.workoutExercise = we and s.done = true)
            order by w.date desc, w.finishedAt desc
            """)
    List<WorkoutExercise> findPrevious(UUID userId, UUID exerciseId, UUID excludeId, LocalDate date, Limit limit);

    @Query("""
            select new com.lifeos.fitness.WorkoutDtos$DoneSetRow(e.id, e.name, e.type, e.archived, w.date, s.reps,
                s.weightKg, s.durationSeconds, s.distanceKm)
            from WorkoutSet s join s.workoutExercise we join we.workout w join we.exercise e
            where w.userId = :userId and w.finishedAt is not null and s.done = true
            order by w.date
            """)
    List<WorkoutDtos.DoneSetRow> findDoneSets(UUID userId);
}

interface CustomMetricRepository extends JpaRepository<CustomMetric, UUID> {

    List<CustomMetric> findByUserIdOrderByCreatedAtAsc(UUID userId);

    Optional<CustomMetric> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByUserIdAndNameIgnoreCaseAndIdNot(UUID userId, String name, UUID id);
}
