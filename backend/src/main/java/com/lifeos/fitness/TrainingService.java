package com.lifeos.fitness;

import static com.lifeos.fitness.FitnessDtos.blankToNull;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.error.ConflictException;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.fitness.TrainingDtos.ExerciseRequest;
import com.lifeos.fitness.TrainingDtos.ExerciseResponse;
import com.lifeos.fitness.TrainingDtos.RoutineItemRequest;
import com.lifeos.fitness.TrainingDtos.RoutineRequest;
import com.lifeos.fitness.TrainingDtos.RoutineResponse;

/** Catálogo de ejercicios y rutinas. */
@Service
public class TrainingService {

    private static final UUID NONE = new UUID(0, 0);

    private final ExerciseRepository exercises;
    private final RoutineRepository routines;
    private final ExerciseSetupService setup;
    private final Clock clock;

    public TrainingService(ExerciseRepository exercises, RoutineRepository routines, ExerciseSetupService setup,
            Clock clock) {
        this.exercises = exercises;
        this.routines = routines;
        this.setup = setup;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ExerciseResponse> exercises(UUID userId) {
        setup.ensureCatalog(userId);
        Set<UUID> used = exercises.findUsedIds(userId);
        return exercises.findByUserIdOrderByNameAsc(userId).stream()
                .map(e -> ExerciseResponse.from(e, used.contains(e.getId()))).toList();
    }

    @Transactional
    public ExerciseResponse createExercise(UUID userId, ExerciseRequest request) {
        setup.ensureCatalog(userId);
        String name = request.name().strip();
        checkExerciseName(userId, name, NONE);
        Exercise exercise = new Exercise(userId, name, request.muscleGroup(), request.type(),
                blankToNull(request.equipment()), blankToNull(request.instructions()), blankToNull(request.safety()),
                clock.instant());
        return ExerciseResponse.from(exercises.save(exercise), false);
    }

    @Transactional
    public ExerciseResponse updateExercise(UUID userId, UUID id, ExerciseRequest request) {
        Exercise exercise = loadExercise(userId, id);
        String name = request.name().strip();
        checkExerciseName(userId, name, id);
        exercise.update(name, request.muscleGroup(), request.type(), blankToNull(request.equipment()),
                blankToNull(request.instructions()), blankToNull(request.safety()),
                Boolean.TRUE.equals(request.archived()), clock.instant());
        return ExerciseResponse.from(exercise, exercises.findUsedIds(userId).contains(id));
    }

    /** Un ejercicio usado en una rutina no se borra (la rutina quedaría incompleta); se puede archivar. */
    @Transactional
    public void deleteExercise(UUID userId, UUID id) {
        Exercise exercise = loadExercise(userId, id);
        if (exercises.findUsedIds(userId).contains(id)) {
            throw new ConflictException("exercise-in-use");
        }
        exercises.delete(exercise);
    }

    @Transactional(readOnly = true)
    public List<RoutineResponse> routines(UUID userId) {
        return routines.findAllWithExercises(userId).stream().map(RoutineResponse::from).toList();
    }

    @Transactional
    public RoutineResponse createRoutine(UUID userId, RoutineRequest request) {
        Routine routine = new Routine(userId, clock.instant());
        apply(userId, routine, request, NONE);
        return RoutineResponse.from(routines.save(routine));
    }

    @Transactional
    public RoutineResponse updateRoutine(UUID userId, UUID id, RoutineRequest request) {
        Routine routine = loadRoutine(userId, id);
        apply(userId, routine, request, id);
        routines.flush();
        return RoutineResponse.from(routine);
    }

    @Transactional
    public void deleteRoutine(UUID userId, UUID id) {
        routines.delete(loadRoutine(userId, id));
    }

    private void apply(UUID userId, Routine routine, RoutineRequest request, UUID excludeId) {
        String name = request.name().strip();
        List<RoutineItemRequest> items = request.exercises() == null ? List.of() : request.exercises();
        Map<UUID, Exercise> owned = exercises
                .findByUserIdAndIdIn(userId, items.stream().map(RoutineItemRequest::exerciseId).toList()).stream()
                .collect(Collectors.toMap(Exercise::getId, Function.identity()));
        FieldValidationException.Collector errors = new FieldValidationException.Collector()
                .add(routines.existsByName(userId, name, excludeId), "name", "fitness.routine.name.duplicate")
                .add(items.isEmpty(), "exercises", "fitness.routine.exercises.empty");
        for (int i = 0; i < items.size(); i++) {
            RoutineItemRequest item = items.get(i);
            errors.add(!owned.containsKey(item.exerciseId()), "exercises[" + i + "].exerciseId",
                    "fitness.routine.exercise.required")
                    .add(item.repsMin() != null && item.repsMax() != null && item.repsMax() < item.repsMin(),
                            "exercises[" + i + "].repsMax", "fitness.routine.reps.range");
        }
        errors.throwIfAny();
        List<RoutineExercise> entries = new ArrayList<>();
        for (RoutineItemRequest item : items) {
            entries.add(new RoutineExercise(owned.get(item.exerciseId()), item.sets(), item.repsMin(), item.repsMax(),
                    item.weightKg(), item.durationSeconds(), item.distanceKm(), item.restSeconds(),
                    blankToNull(item.notes())));
        }
        routine.update(name, blankToNull(request.notes()), request.weekdays(), entries, clock.instant());
    }

    private void checkExerciseName(UUID userId, String name, UUID excludeId) {
        new FieldValidationException.Collector()
                .add(exercises.existsByName(userId, name, excludeId), "name", "fitness.exercise.name.duplicate")
                .throwIfAny();
    }

    private Exercise loadExercise(UUID userId, UUID id) {
        return exercises.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }

    private Routine loadRoutine(UUID userId, UUID id) {
        return routines.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }
}
