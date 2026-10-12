package com.lifeos.fitness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.lifeos.fitness.FitnessProfile.ActivityLevel;
import com.lifeos.fitness.FitnessProfile.Experience;
import com.lifeos.fitness.FitnessProfile.Goal;

/** Peticiones y respuestas del módulo de entrenador. Pesos en kg y perímetros en cm. */
public final class FitnessDtos {

    private FitnessDtos() {
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    public record ProfileRequest(
            LocalDate birthDate,
            @DecimalMin(value = "50", message = "{fitness.height.invalid}")
            @DecimalMax(value = "260", message = "{fitness.height.invalid}")
            @Digits(integer = 3, fraction = 1, message = "{fitness.decimals.one}") BigDecimal heightCm,
            @DecimalMin(value = "20", message = "{fitness.weight.invalid}")
            @DecimalMax(value = "400", message = "{fitness.weight.invalid}")
            @Digits(integer = 3, fraction = 2, message = "{fitness.decimals.two}") BigDecimal startWeightKg,
            Goal goal,
            @Size(max = 500, message = "{fitness.text.too-long}") String goalDetails,
            ActivityLevel activityLevel,
            Experience experience,
            @Min(value = 0, message = "{fitness.days.invalid}") @Max(value = 7, message = "{fitness.days.invalid}") Integer daysPerWeek,
            @Min(value = 5, message = "{fitness.minutes.invalid}") @Max(value = 600, message = "{fitness.minutes.invalid}") Integer minutesPerSession,
            @Size(max = 1000, message = "{fitness.text.too-long}") String foodPreferences,
            @Size(max = 1000, message = "{fitness.text.too-long}") String foodAvoid,
            @Size(max = 1000, message = "{fitness.text.too-long}") String equipment,
            @Size(max = 2000, message = "{fitness.text.too-long}") String notes) {
    }

    /**
     * La edad se calcula a partir de la fecha de nacimiento y el peso actual es el del último registro con peso
     * (o el inicial si aún no hay registros).
     */
    public record ProfileResponse(LocalDate birthDate, Integer age, BigDecimal heightCm, BigDecimal startWeightKg,
            BigDecimal currentWeightKg, LocalDate currentWeightDate, Goal goal, String goalDetails,
            ActivityLevel activityLevel, Experience experience, Integer daysPerWeek, Integer minutesPerSession,
            String foodPreferences, String foodAvoid, String equipment, String notes) {
    }

    public record MeasurementRequest(
            @NotNull(message = "{fitness.measurement.date.required}") LocalDate date,
            @DecimalMin(value = "20", message = "{fitness.weight.invalid}")
            @DecimalMax(value = "400", message = "{fitness.weight.invalid}")
            @Digits(integer = 3, fraction = 2, message = "{fitness.decimals.two}") BigDecimal weightKg,
            @DecimalMin(value = "2", message = "{fitness.fat.invalid}")
            @DecimalMax(value = "70", message = "{fitness.fat.invalid}")
            @Digits(integer = 2, fraction = 1, message = "{fitness.decimals.one}") BigDecimal bodyFatPct,
            @DecimalMin(value = "10", message = "{fitness.perimeter.invalid}")
            @DecimalMax(value = "300", message = "{fitness.perimeter.invalid}")
            @Digits(integer = 3, fraction = 1, message = "{fitness.decimals.one}") BigDecimal waistCm,
            @DecimalMin(value = "10", message = "{fitness.perimeter.invalid}")
            @DecimalMax(value = "300", message = "{fitness.perimeter.invalid}")
            @Digits(integer = 3, fraction = 1, message = "{fitness.decimals.one}") BigDecimal chestCm,
            @DecimalMin(value = "10", message = "{fitness.perimeter.invalid}")
            @DecimalMax(value = "300", message = "{fitness.perimeter.invalid}")
            @Digits(integer = 3, fraction = 1, message = "{fitness.decimals.one}") BigDecimal hipCm,
            @DecimalMin(value = "10", message = "{fitness.perimeter.invalid}")
            @DecimalMax(value = "300", message = "{fitness.perimeter.invalid}")
            @Digits(integer = 3, fraction = 1, message = "{fitness.decimals.one}") BigDecimal armCm,
            @DecimalMin(value = "10", message = "{fitness.perimeter.invalid}")
            @DecimalMax(value = "300", message = "{fitness.perimeter.invalid}")
            @Digits(integer = 3, fraction = 1, message = "{fitness.decimals.one}") BigDecimal thighCm,
            @Size(max = 1000, message = "{fitness.text.too-long}") String notes) {

        boolean isEmpty() {
            return weightKg == null && bodyFatPct == null && waistCm == null && chestCm == null && hipCm == null
                    && armCm == null && thighCm == null && blankToNull(notes) == null;
        }
    }

    public record MeasurementResponse(UUID id, LocalDate date, BigDecimal weightKg, BigDecimal bodyFatPct,
            BigDecimal waistCm, BigDecimal chestCm, BigDecimal hipCm, BigDecimal armCm, BigDecimal thighCm,
            String notes) {

        static MeasurementResponse from(BodyMeasurement m) {
            return new MeasurementResponse(m.getId(), m.getDate(), m.getWeightKg(), m.getBodyFatPct(), m.getWaistCm(),
                    m.getChestCm(), m.getHipCm(), m.getArmCm(), m.getThighCm(), m.getNotes());
        }
    }
}
