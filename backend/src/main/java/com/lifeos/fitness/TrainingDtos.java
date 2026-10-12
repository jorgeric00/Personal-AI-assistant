package com.lifeos.fitness;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.util.List;
import java.util.Set;
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

import com.lifeos.fitness.Exercise.MuscleGroup;
import com.lifeos.fitness.Exercise.Type;

/** Peticiones y respuestas de ejercicios y rutinas. Pesos en kg, distancias en km y tiempos en segundos. */
public final class TrainingDtos {

    private TrainingDtos() {
    }

    public record ExerciseRequest(
            @NotBlank(message = "{fitness.exercise.name.required}")
            @Size(max = 80, message = "{fitness.text.too-long}") String name,
            @NotNull(message = "{fitness.exercise.group.required}") MuscleGroup muscleGroup,
            @NotNull(message = "{fitness.exercise.type.required}") Type type,
            @Size(max = 200, message = "{fitness.text.too-long}") String equipment,
            @Size(max = 2000, message = "{fitness.text.too-long}") String instructions,
            @Size(max = 1000, message = "{fitness.text.too-long}") String safety,
            Boolean archived) {
    }

    /** {@code inUse}: aparece en alguna rutina, así que no se puede borrar (sí archivar). */
    public record ExerciseResponse(UUID id, String name, MuscleGroup muscleGroup, Type type, String equipment,
            String instructions, String safety, boolean archived, boolean inUse) {

        static ExerciseResponse from(Exercise e, boolean inUse) {
            return new ExerciseResponse(e.getId(), e.getName(), e.getMuscleGroup(), e.getType(), e.getEquipment(),
                    e.getInstructions(), e.getSafety(), e.isArchived(), inUse);
        }
    }

    public record RoutineItemRequest(
            @NotNull(message = "{fitness.routine.exercise.required}") UUID exerciseId,
            @NotNull(message = "{fitness.routine.sets.invalid}")
            @Min(value = 1, message = "{fitness.routine.sets.invalid}")
            @Max(value = 20, message = "{fitness.routine.sets.invalid}") Integer sets,
            @Min(value = 1, message = "{fitness.routine.reps.invalid}")
            @Max(value = 200, message = "{fitness.routine.reps.invalid}") Integer repsMin,
            @Min(value = 1, message = "{fitness.routine.reps.invalid}")
            @Max(value = 200, message = "{fitness.routine.reps.invalid}") Integer repsMax,
            @DecimalMin(value = "0", message = "{fitness.routine.weight.invalid}")
            @DecimalMax(value = "500", message = "{fitness.routine.weight.invalid}")
            @Digits(integer = 3, fraction = 2, message = "{fitness.decimals.two}") BigDecimal weightKg,
            @Min(value = 1, message = "{fitness.routine.duration.invalid}")
            @Max(value = 86400, message = "{fitness.routine.duration.invalid}") Integer durationSeconds,
            @DecimalMin(value = "0.01", message = "{fitness.routine.distance.invalid}")
            @DecimalMax(value = "1000", message = "{fitness.routine.distance.invalid}")
            @Digits(integer = 4, fraction = 2, message = "{fitness.decimals.two}") BigDecimal distanceKm,
            @Min(value = 0, message = "{fitness.routine.rest.invalid}")
            @Max(value = 1800, message = "{fitness.routine.rest.invalid}") Integer restSeconds,
            @Size(max = 500, message = "{fitness.text.too-long}") String notes) {
    }

    public record RoutineRequest(
            @NotBlank(message = "{fitness.routine.name.required}")
            @Size(max = 80, message = "{fitness.text.too-long}") String name,
            @Size(max = 1000, message = "{fitness.text.too-long}") String notes,
            Set<DayOfWeek> weekdays,
            @Size(max = 30, message = "{fitness.routine.exercises.too-many}") List<@Valid RoutineItemRequest> exercises) {
    }

    public record ExerciseSummary(UUID id, String name, MuscleGroup muscleGroup, Type type, boolean archived) {

        static ExerciseSummary from(Exercise e) {
            return new ExerciseSummary(e.getId(), e.getName(), e.getMuscleGroup(), e.getType(), e.isArchived());
        }
    }

    public record RoutineItemResponse(UUID id, ExerciseSummary exercise, int sets, Integer repsMin, Integer repsMax,
            BigDecimal weightKg, Integer durationSeconds, BigDecimal distanceKm, Integer restSeconds, String notes) {

        static RoutineItemResponse from(RoutineExercise item) {
            return new RoutineItemResponse(item.getId(), ExerciseSummary.from(item.getExercise()), item.getSets(),
                    item.getRepsMin(), item.getRepsMax(), item.getWeightKg(), item.getDurationSeconds(),
                    item.getDistanceKm(), item.getRestSeconds(), item.getNotes());
        }
    }

    /** Los días van de lunes a domingo. */
    public record RoutineResponse(UUID id, String name, String notes, List<DayOfWeek> weekdays,
            List<RoutineItemResponse> exercises) {

        static RoutineResponse from(Routine r) {
            return new RoutineResponse(r.getId(), r.getName(), r.getNotes(), List.copyOf(r.getWeekdays()),
                    r.getExercises().stream().map(RoutineItemResponse::from).toList());
        }
    }
}
