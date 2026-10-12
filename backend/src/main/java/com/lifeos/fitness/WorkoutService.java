package com.lifeos.fitness;

import static com.lifeos.fitness.FitnessDtos.blankToNull;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;

import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.fitness.TrainingDtos.ExerciseSummary;
import com.lifeos.fitness.WorkoutDtos.DoneSetRow;
import com.lifeos.fitness.WorkoutDtos.PreviousResponse;
import com.lifeos.fitness.WorkoutDtos.RecordResponse;
import com.lifeos.fitness.WorkoutDtos.SetRequest;
import com.lifeos.fitness.WorkoutDtos.SetResponse;
import com.lifeos.fitness.WorkoutDtos.StartRequest;
import com.lifeos.fitness.WorkoutDtos.WorkoutExerciseRequest;
import com.lifeos.fitness.WorkoutDtos.WorkoutExerciseResponse;
import com.lifeos.fitness.WorkoutDtos.WorkoutRequest;
import com.lifeos.fitness.WorkoutDtos.WorkoutResponse;
import com.lifeos.fitness.WorkoutDtos.WorkoutSummary;

/** Entrenamientos: empezar, anotar series, terminar, historial y récords. */
@Service
public class WorkoutService {

    private final WorkoutRepository workouts;
    private final RoutineRepository routines;
    private final ExerciseRepository exercises;
    private final MessageSource messages;
    private final Clock clock;
    private final LifeosProperties properties;

    public WorkoutService(WorkoutRepository workouts, RoutineRepository routines, ExerciseRepository exercises,
            MessageSource messages, Clock clock, LifeosProperties properties) {
        this.workouts = workouts;
        this.routines = routines;
        this.exercises = exercises;
        this.messages = messages;
        this.clock = clock;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public List<WorkoutSummary> list(UUID userId) {
        return workouts.findSummaries(userId);
    }

    @Transactional(readOnly = true)
    public WorkoutResponse get(UUID userId, UUID id) {
        return toResponse(userId, load(userId, id));
    }

    /** Desde una rutina copia sus ejercicios, su objetivo y series vacías: nada cuenta como hecho hasta marcarlo. */
    @Transactional
    public WorkoutResponse start(UUID userId, StartRequest request) {
        LocalDate date = request.date() == null ? today() : request.date();
        checkDate(date);
        Workout workout;
        if (request.routineId() != null) {
            Routine routine = routines.findByIdAndUserId(request.routineId(), userId)
                    .orElseThrow(NotFoundException::new);
            workout = new Workout(userId, routine.getId(), routine.getName(), date, clock.instant());
            workout.replaceExercises(routine.getExercises().stream().map(WorkoutExercise::fromRoutine).toList());
        } else {
            workout = new Workout(userId, null,
                    messages.getMessage("fitness.workout.free", null, LocaleContextHolder.getLocale()), date,
                    clock.instant());
        }
        return toResponse(userId, workouts.save(workout));
    }

    @Transactional
    public WorkoutResponse update(UUID userId, UUID id, WorkoutRequest request) {
        Workout workout = load(userId, id);
        List<WorkoutExerciseRequest> items = request.exercises() == null ? List.of() : request.exercises();
        Map<UUID, Exercise> owned = exercises
                .findByUserIdAndIdIn(userId, items.stream().map(WorkoutExerciseRequest::exerciseId).toList()).stream()
                .collect(Collectors.toMap(Exercise::getId, Function.identity()));
        boolean finished = Boolean.TRUE.equals(request.finished());
        FieldValidationException.Collector errors = new FieldValidationException.Collector()
                .add(request.date().isAfter(today()), "date", "fitness.measurement.date.future");
        boolean anyDone = false;
        for (int i = 0; i < items.size(); i++) {
            WorkoutExerciseRequest item = items.get(i);
            errors.add(!owned.containsKey(item.exerciseId()), "exercises[" + i + "].exerciseId",
                    "fitness.routine.exercise.required");
            List<SetRequest> sets = item.sets() == null ? List.of() : item.sets();
            for (int j = 0; j < sets.size(); j++) {
                SetRequest set = sets.get(j);
                boolean done = Boolean.TRUE.equals(set.done());
                anyDone |= done;
                errors.add(done && set.isEmpty(), "exercises[" + i + "].sets[" + j + "]", "fitness.workout.set.empty");
            }
        }
        errors.add(finished && !anyDone, "exercises", "fitness.workout.nothing-done").throwIfAny();

        List<WorkoutExercise> entries = new ArrayList<>();
        for (WorkoutExerciseRequest item : items) {
            List<WorkoutSet> sets = (item.sets() == null ? List.<SetRequest>of() : item.sets()).stream()
                    .map(s -> new WorkoutSet(s.reps(), s.weightKg(), s.durationSeconds(), s.distanceKm(),
                            Boolean.TRUE.equals(s.done())))
                    .toList();
            entries.add(new WorkoutExercise(owned.get(item.exerciseId()), item.targetSets(), item.targetRepsMin(),
                    item.targetRepsMax(), item.targetWeightKg(), item.targetDurationSeconds(),
                    item.targetDistanceKm(), item.restSeconds(), blankToNull(item.notes()), sets));
        }
        workout.update(request.name().strip(), request.date(), request.effort(), blankToNull(request.notes()), finished,
                entries, clock.instant());
        workouts.flush();
        return toResponse(userId, workout);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        workouts.delete(load(userId, id));
    }

    /** Mejores marcas por ejercicio, solo con series marcadas como hechas en entrenamientos terminados. */
    @Transactional(readOnly = true)
    public List<RecordResponse> records(UUID userId) {
        Map<UUID, List<DoneSetRow>> byExercise = workouts.findDoneSets(userId).stream()
                .collect(Collectors.groupingBy(DoneSetRow::exerciseId, LinkedHashMap::new, Collectors.toList()));
        List<RecordResponse> result = new ArrayList<>();
        byExercise.forEach((exerciseId, rows) -> {
            DoneSetRow first = rows.getFirst();
            long sessions = rows.stream().map(DoneSetRow::date).distinct().count();
            // A igualdad de marca, cuenta la primera vez que se logró (las filas van por fecha).
            DoneSetRow weight = best(rows, r -> r.weightKg() != null && r.weightKg().signum() > 0,
                    Comparator.comparing(DoneSetRow::weightKg).thenComparing(r -> r.reps() == null ? 0 : r.reps()));
            DoneSetRow reps = best(rows, r -> r.reps() != null && r.reps() > 0, Comparator.comparing(DoneSetRow::reps));
            DoneSetRow duration = best(rows, r -> r.durationSeconds() != null,
                    Comparator.comparing(DoneSetRow::durationSeconds));
            DoneSetRow distance = best(rows, r -> r.distanceKm() != null, Comparator.comparing(DoneSetRow::distanceKm));
            result.add(new RecordResponse(exerciseId, first.exerciseName(), first.type(), sessions,
                    weight == null ? null : weight.weightKg(), weight == null ? null : weight.reps(),
                    weight == null ? null : weight.date(), reps == null ? null : reps.reps(),
                    reps == null ? null : reps.date(), duration == null ? null : duration.durationSeconds(),
                    duration == null ? null : duration.date(), distance == null ? null : distance.distanceKm(),
                    distance == null ? null : distance.date()));
        });
        result.sort(Comparator.comparing(RecordResponse::exerciseName, String.CASE_INSENSITIVE_ORDER));
        return result;
    }

    private static DoneSetRow best(List<DoneSetRow> rows, Predicate<DoneSetRow> applies,
            Comparator<DoneSetRow> order) {
        DoneSetRow best = null;
        for (DoneSetRow row : rows) {
            if (applies.test(row) && (best == null || order.compare(row, best) > 0)) {
                best = row;
            }
        }
        return best;
    }

    private WorkoutResponse toResponse(UUID userId, Workout w) {
        List<WorkoutExerciseResponse> items = w.getExercises().stream().map(we -> {
            PreviousResponse previous = workouts
                    .findPrevious(userId, we.getExercise().getId(), w.getId(), w.getDate(), Limit.of(1)).stream()
                    .findFirst()
                    .map(p -> new PreviousResponse(p.getWorkout().getId(), p.getWorkout().getDate(),
                            p.getSets().stream().filter(WorkoutSet::isDone).map(SetResponse::from).toList()))
                    .orElse(null);
            return new WorkoutExerciseResponse(we.getId(), ExerciseSummary.from(we.getExercise()), we.getTargetSets(),
                    we.getTargetRepsMin(), we.getTargetRepsMax(), we.getTargetWeightKg(),
                    we.getTargetDurationSeconds(), we.getTargetDistanceKm(), we.getRestSeconds(), we.getNotes(),
                    we.getSets().stream().map(SetResponse::from).toList(), previous);
        }).toList();
        return new WorkoutResponse(w.getId(), w.getRoutineId(), w.getName(), w.getDate(), w.getFinishedAt() != null,
                w.getFinishedAt(), w.getEffort(), w.getNotes(), items);
    }

    private void checkDate(LocalDate date) {
        new FieldValidationException.Collector().add(date.isAfter(today()), "date", "fitness.measurement.date.future")
                .throwIfAny();
    }

    private Workout load(UUID userId, UUID id) {
        return workouts.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(properties.timezone()));
    }
}
