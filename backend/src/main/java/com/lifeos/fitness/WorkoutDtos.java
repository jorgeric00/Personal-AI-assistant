package com.lifeos.fitness;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.lifeos.fitness.Exercise.Type;
import com.lifeos.fitness.TrainingDtos.ExerciseSummary;

/** Peticiones y respuestas de entrenamientos. Pesos en kg, distancias en km y tiempos en segundos. */
public final class WorkoutDtos {

    private WorkoutDtos() {
    }

    /** Empieza un entrenamiento desde una rutina (copiando sus ejercicios) o libre. Sin fecha, es hoy. */
    public record StartRequest(UUID routineId, LocalDate date) {
    }

    public record SetRequest(
            @Min(value = 0, message = "{fitness.workout.reps.invalid}")
            @Max(value = 1000, message = "{fitness.workout.reps.invalid}") Integer reps,
            @DecimalMin(value = "0", message = "{fitness.routine.weight.invalid}")
            @DecimalMax(value = "500", message = "{fitness.routine.weight.invalid}")
            @Digits(integer = 3, fraction = 2, message = "{fitness.decimals.two}") BigDecimal weightKg,
            @Min(value = 1, message = "{fitness.routine.duration.invalid}")
            @Max(value = 86400, message = "{fitness.routine.duration.invalid}") Integer durationSeconds,
            @DecimalMin(value = "0.01", message = "{fitness.routine.distance.invalid}")
            @DecimalMax(value = "1000", message = "{fitness.routine.distance.invalid}")
            @Digits(integer = 4, fraction = 2, message = "{fitness.decimals.two}") BigDecimal distanceKm,
            Boolean done) {

        boolean isEmpty() {
            return reps == null && durationSeconds == null && distanceKm == null;
        }
    }

    /** Los campos de objetivo se conservan tal como vinieron de la rutina; el cliente los devuelve sin cambios. */
    public record WorkoutExerciseRequest(
            @NotNull(message = "{fitness.routine.exercise.required}") UUID exerciseId,
            Integer targetSets, Integer targetRepsMin, Integer targetRepsMax, BigDecimal targetWeightKg,
            Integer targetDurationSeconds, BigDecimal targetDistanceKm, Integer restSeconds,
            @Size(max = 500, message = "{fitness.text.too-long}") String notes,
            @Size(max = 30, message = "{fitness.workout.sets.too-many}") List<@Valid SetRequest> sets) {
    }

    public record WorkoutRequest(
            @NotBlank(message = "{fitness.routine.name.required}")
            @Size(max = 80, message = "{fitness.text.too-long}") String name,
            @NotNull(message = "{fitness.measurement.date.required}") LocalDate date,
            @Min(value = 1, message = "{fitness.workout.effort.invalid}")
            @Max(value = 10, message = "{fitness.workout.effort.invalid}") Integer effort,
            @Size(max = 2000, message = "{fitness.text.too-long}") String notes,
            Boolean finished,
            @Size(max = 40, message = "{fitness.workout.exercises.too-many}") List<@Valid WorkoutExerciseRequest> exercises) {
    }

    public record SetResponse(UUID id, Integer reps, BigDecimal weightKg, Integer durationSeconds,
            BigDecimal distanceKm, boolean done) {

        static SetResponse from(WorkoutSet s) {
            return new SetResponse(s.getId(), s.getReps(), s.getWeightKg(), s.getDurationSeconds(), s.getDistanceKm(),
                    s.isDone());
        }
    }

    /** Series hechas la última vez que se terminó un entrenamiento con este ejercicio. */
    public record PreviousResponse(UUID workoutId, LocalDate date, List<SetResponse> sets) {
    }

    public record WorkoutExerciseResponse(UUID id, ExerciseSummary exercise, Integer targetSets,
            Integer targetRepsMin, Integer targetRepsMax, BigDecimal targetWeightKg, Integer targetDurationSeconds,
            BigDecimal targetDistanceKm, Integer restSeconds, String notes, List<SetResponse> sets,
            PreviousResponse previous) {
    }

    public record WorkoutResponse(UUID id, UUID routineId, String name, LocalDate date, boolean finished,
            Instant finishedAt, Integer effort, String notes, List<WorkoutExerciseResponse> exercises) {
    }

    /** Resumen para el historial: cuántos ejercicios y series hechas tiene. */
    public record WorkoutSummary(UUID id, UUID routineId, String name, LocalDate date, boolean finished,
            Instant finishedAt, long exerciseCount, long doneSets) {

        public WorkoutSummary(UUID id, UUID routineId, String name, LocalDate date, Instant finishedAt,
                Long exerciseCount, Long doneSets) {
            this(id, routineId, name, date, finishedAt != null, finishedAt, exerciseCount == null ? 0 : exerciseCount,
                    doneSets == null ? 0 : doneSets);
        }
    }

    /** Fila de una serie hecha en un entrenamiento terminado, para calcular récords. */
    public record DoneSetRow(UUID exerciseId, String exerciseName, Type type, boolean archived, LocalDate date,
            Integer reps, BigDecimal weightKg, Integer durationSeconds, BigDecimal distanceKm) {

        public DoneSetRow(UUID exerciseId, String exerciseName, Type type, boolean archived, LocalDate date,
                Short reps, BigDecimal weightKg, Integer durationSeconds, BigDecimal distanceKm) {
            this(exerciseId, exerciseName, type, archived, date, reps == null ? null : reps.intValue(), weightKg,
                    durationSeconds, distanceKm);
        }
    }

    /** Mejores marcas de un ejercicio en entrenamientos terminados. Cada valor lleva la fecha en que se logró. */
    public record RecordResponse(UUID exerciseId, String exerciseName, Type type, long sessions,
            BigDecimal bestWeightKg, Integer bestWeightReps, LocalDate bestWeightDate, Integer bestReps,
            LocalDate bestRepsDate, Integer longestDurationSeconds, LocalDate longestDurationDate,
            BigDecimal longestDistanceKm, LocalDate longestDistanceDate) {
    }
}
