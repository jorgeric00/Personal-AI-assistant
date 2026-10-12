package com.lifeos.goals;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class GoalDtos {

    private GoalDtos() {
    }

    public record GoalRequest(
            @NotBlank(message = "{goals.title.required}")
            @Size(max = 120, message = "{goals.text.too-long}") String title,
            @NotNull(message = "{goals.kind.required}") GoalKind kind,
            BodyMetric metric,
            @DecimalMin(value = "0.01", message = "{goals.target.invalid}")
            @DecimalMax(value = "1000", message = "{goals.target.invalid}")
            @Digits(integer = 4, fraction = 2, message = "{goals.target.invalid}") BigDecimal targetValue,
            UUID exerciseId,
            UUID habitId,
            LocalDate targetDate,
            @Size(max = 1000, message = "{goals.text.too-long}") String notes,
            GoalStatus status) {
    }

    public record GoalResponse(UUID id, String title, GoalKind kind, BodyMetric metric, BigDecimal targetValue,
            UUID exerciseId, UUID habitId, LocalDate startDate, LocalDate targetDate, String notes, GoalStatus status,
            LocalDate achievedOn) {

        static GoalResponse from(Goal g) {
            return new GoalResponse(g.getId(), g.getTitle(), g.getKind(), g.getMetric(), g.getTargetValue(),
                    g.getExerciseId(), g.getHabitId(), g.getStartDate(), g.getTargetDate(), g.getNotes(),
                    g.getStatus(), g.getAchievedOn());
        }
    }
}
