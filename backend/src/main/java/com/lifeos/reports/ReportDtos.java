package com.lifeos.reports;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.lifeos.habits.HabitFrequency;

public final class ReportDtos {

    private ReportDtos() {
    }

    /**
     * Informe de un periodo comparado con el anterior. Si el periodo está en curso solo cuenta hasta hoy
     * ({@code to}) y el anterior se recorta al mismo número de días, para comparar tramos equivalentes.
     */
    public record ReportResponse(ReportPeriod period, LocalDate start, LocalDate end, LocalDate to, boolean partial,
            LocalDate previousFrom, LocalDate previousTo, Tasks tasks, Finance finance, Training training,
            Nutrition nutrition, List<HabitSummary> habits, List<BodyChange> body) {
    }

    public record Tasks(int completed, int previousCompleted) {
    }

    /** Importes en céntimos en la moneda del usuario; currency es null si aún no ha usado finanzas. */
    public record Finance(String currency, long incomeCents, long expenseCents, long previousIncomeCents,
            long previousExpenseCents, List<CategoryAmount> topExpenses) {
    }

    public record CategoryAmount(UUID id, String name, String color, long amountCents) {
    }

    public record Training(int workouts, int previousWorkouts, int setsDone, int previousSetsDone) {
    }

    /**
     * loggedDays: días con algún alimento anotado. averageCalories: media de los días con calorías anotadas (null si
     * no hay ninguno). estimated: si alguna de esas calorías es una estimación.
     */
    public record Nutrition(int loggedDays, int previousLoggedDays, Integer averageCalories,
            Integer previousAverageCalories, boolean estimated) {
    }

    /**
     * done: días marcados. En los diarios, expected son los días que tocaban (sin contar hoy si aún no está
     * marcado); en los semanales es null porque su objetivo es por semana.
     */
    public record HabitSummary(UUID id, String name, String color, HabitFrequency frequency, Integer timesPerWeek,
            int done, Integer expected, int previousDone, Integer previousExpected) {
    }

    /** Primer y último valor registrados dentro del periodo para una medida. */
    public record BodyChange(String metric, LocalDate firstDate, BigDecimal first, LocalDate lastDate,
            BigDecimal last, int count) {
    }
}
