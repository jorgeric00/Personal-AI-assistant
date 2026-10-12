package com.lifeos.nutrition;

import java.math.BigDecimal;
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

/** Peticiones y respuestas de alimentación. Nutrientes en gramos, energía en kcal y agua en ml. */
public final class NutritionDtos {

    private NutritionDtos() {
    }

    public record FoodRequest(
            @NotBlank(message = "{nutrition.food.name.required}")
            @Size(max = 120, message = "{nutrition.text.too-long}") String name,
            @DecimalMin(value = "0.01", message = "{nutrition.quantity.invalid}")
            @DecimalMax(value = "99999", message = "{nutrition.quantity.invalid}")
            @Digits(integer = 5, fraction = 2, message = "{nutrition.decimals.two}") BigDecimal quantity,
            @Size(max = 20, message = "{nutrition.text.too-long}") String unit,
            @Min(value = 0, message = "{nutrition.calories.invalid}")
            @Max(value = 10000, message = "{nutrition.calories.invalid}") Integer calories,
            @DecimalMin(value = "0", message = "{nutrition.grams.invalid}")
            @DecimalMax(value = "1000", message = "{nutrition.grams.invalid}")
            @Digits(integer = 4, fraction = 1, message = "{nutrition.decimals.one}") BigDecimal proteinG,
            @DecimalMin(value = "0", message = "{nutrition.grams.invalid}")
            @DecimalMax(value = "1000", message = "{nutrition.grams.invalid}")
            @Digits(integer = 4, fraction = 1, message = "{nutrition.decimals.one}") BigDecimal carbsG,
            @DecimalMin(value = "0", message = "{nutrition.grams.invalid}")
            @DecimalMax(value = "1000", message = "{nutrition.grams.invalid}")
            @Digits(integer = 4, fraction = 1, message = "{nutrition.decimals.one}") BigDecimal fatG,
            Boolean estimated) {

        /** La unidad solo tiene sentido con cantidad; sin nutrientes no hay nada que sea estimado. */
        Food toFood() {
            boolean hasNutrients = calories != null || proteinG != null || carbsG != null || fatG != null;
            String cleanUnit = unit == null || unit.isBlank() || quantity == null ? null : unit.strip();
            return new Food(name.strip(), quantity, cleanUnit, calories, proteinG, carbsG, fatG,
                    Boolean.TRUE.equals(estimated) && hasNutrients);
        }
    }

    public record FoodResponse(String name, BigDecimal quantity, String unit, Integer calories, BigDecimal proteinG,
            BigDecimal carbsG, BigDecimal fatG, boolean estimated) {

        static FoodResponse from(Food f) {
            return new FoodResponse(f.name(), f.quantity(), f.unit(), f.calories(), f.proteinG(), f.carbsG(),
                    f.fatG(), f.estimated());
        }
    }

    public record EntryRequest(
            @NotNull(message = "{nutrition.date.required}") LocalDate date,
            @NotNull(message = "{nutrition.meal.required}") Meal meal,
            @NotNull(message = "{nutrition.food.name.required}") @Valid FoodRequest food) {
    }

    public record EntryResponse(UUID id, LocalDate date, Meal meal, FoodResponse food) {

        static EntryResponse from(FoodEntry e) {
            return new EntryResponse(e.getId(), e.getDate(), e.getMeal(), FoodResponse.from(e.getFood()));
        }
    }

    /**
     * Sumas de lo registrado. Solo suman los valores anotados: {@code withoutCalories} cuenta los alimentos sin
     * calorías y {@code estimated} indica si alguna suma incluye valores estimados.
     */
    public record Totals(int calories, BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG, int entries,
            int withoutCalories, boolean estimated) {

        static Totals of(List<Food> foods) {
            int calories = 0;
            BigDecimal protein = BigDecimal.ZERO;
            BigDecimal carbs = BigDecimal.ZERO;
            BigDecimal fat = BigDecimal.ZERO;
            int withoutCalories = 0;
            boolean estimated = false;
            for (Food f : foods) {
                if (f.calories() != null) {
                    calories += f.calories();
                } else {
                    withoutCalories++;
                }
                protein = f.proteinG() == null ? protein : protein.add(f.proteinG());
                carbs = f.carbsG() == null ? carbs : carbs.add(f.carbsG());
                fat = f.fatG() == null ? fat : fat.add(f.fatG());
                estimated |= f.estimated();
            }
            return new Totals(calories, protein, carbs, fat, foods.size(), withoutCalories, estimated);
        }
    }

    public record TargetRequest(
            @Min(value = 1, message = "{nutrition.calories.invalid}")
            @Max(value = 10000, message = "{nutrition.calories.invalid}") Integer calories,
            @DecimalMin(value = "0", message = "{nutrition.grams.invalid}")
            @DecimalMax(value = "1000", message = "{nutrition.grams.invalid}")
            @Digits(integer = 4, fraction = 1, message = "{nutrition.decimals.one}") BigDecimal proteinG,
            @DecimalMin(value = "0", message = "{nutrition.grams.invalid}")
            @DecimalMax(value = "1000", message = "{nutrition.grams.invalid}")
            @Digits(integer = 4, fraction = 1, message = "{nutrition.decimals.one}") BigDecimal carbsG,
            @DecimalMin(value = "0", message = "{nutrition.grams.invalid}")
            @DecimalMax(value = "1000", message = "{nutrition.grams.invalid}")
            @Digits(integer = 4, fraction = 1, message = "{nutrition.decimals.one}") BigDecimal fatG,
            @Min(value = 1, message = "{nutrition.water.invalid}")
            @Max(value = 10000, message = "{nutrition.water.invalid}") Integer waterMl) {
    }

    public record TargetResponse(Integer calories, BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG,
            Integer waterMl) {

        static final TargetResponse EMPTY = new TargetResponse(null, null, null, null, null);

        static TargetResponse from(NutritionTarget t) {
            return t == null ? EMPTY
                    : new TargetResponse(t.getCalories(), t.getProteinG(), t.getCarbsG(), t.getFatG(),
                            t.getWaterMl());
        }
    }

    public record MealDay(Meal meal, String note, List<EntryResponse> entries, Totals totals) {
    }

    public record DayResponse(LocalDate date, int waterMl, List<MealDay> meals, Totals totals, TargetResponse target) {
    }

    public record WaterRequest(
            @NotNull(message = "{nutrition.water.invalid}")
            @Min(value = 0, message = "{nutrition.water.invalid}")
            @Max(value = 20000, message = "{nutrition.water.invalid}") Integer waterMl) {
    }

    public record NoteRequest(
            @NotNull(message = "{nutrition.meal.required}") Meal meal,
            @Size(max = 1000, message = "{nutrition.text.too-long}") String note) {
    }

    public record SummaryDay(LocalDate date, Totals totals, int waterMl) {
    }

    public record SummaryResponse(List<SummaryDay> days, TargetResponse target) {
    }

    public record SavedMealRequest(
            @NotBlank(message = "{nutrition.saved.name.required}")
            @Size(max = 80, message = "{nutrition.text.too-long}") String name,
            Meal meal,
            @Size(max = 30, message = "{nutrition.saved.too-many}") List<@Valid FoodRequest> items) {
    }

    public record SavedMealResponse(UUID id, String name, Meal meal, List<FoodResponse> items, Totals totals) {

        static SavedMealResponse from(SavedMeal m) {
            List<Food> foods = m.getItems().stream().map(SavedMeal.Item::getFood).toList();
            return new SavedMealResponse(m.getId(), m.getName(), m.getMeal(),
                    foods.stream().map(FoodResponse::from).toList(), Totals.of(foods));
        }
    }

    public record LogSavedMealRequest(
            @NotNull(message = "{nutrition.date.required}") LocalDate date,
            @NotNull(message = "{nutrition.meal.required}") Meal meal) {
    }
}
