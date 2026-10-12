package com.lifeos.nutrition;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.common.error.ConflictException;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.nutrition.NutritionDtos.PlanRequest;
import com.lifeos.nutrition.NutritionDtos.PlanResponse;

/** Planificación semanal de comidas y preparación anticipada. Lo planificado solo pasa al diario al registrarlo. */
@Service
public class MealPlanService {

    private static final Comparator<PlannedMeal> ORDER = Comparator.comparing(PlannedMeal::getDate)
            .thenComparing(PlannedMeal::getMeal);

    private final PlannedMealRepository plans;
    private final SavedMealRepository savedMeals;
    private final FoodEntryRepository entries;
    private final LifeosProperties properties;
    private final Clock clock;

    public MealPlanService(PlannedMealRepository plans, SavedMealRepository savedMeals, FoodEntryRepository entries,
            LifeosProperties properties, Clock clock) {
        this.plans = plans;
        this.savedMeals = savedMeals;
        this.entries = entries;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<PlanResponse> list(UUID userId, LocalDate from, LocalDate to) {
        new FieldValidationException.Collector()
                .add(to.isBefore(from) || ChronoUnit.DAYS.between(from, to) >= NutritionService.MAX_SUMMARY_DAYS, "to",
                        "nutrition.range.invalid")
                .throwIfAny();
        return find(userId, from, to).stream().map(PlanResponse::from).toList();
    }

    @Transactional
    public PlanResponse create(UUID userId, PlanRequest request) {
        PlannedMeal plan = new PlannedMeal(userId, clock.instant());
        apply(userId, plan, request);
        return PlanResponse.from(plans.save(plan));
    }

    @Transactional
    public PlanResponse update(UUID userId, UUID id, PlanRequest request) {
        PlannedMeal plan = load(userId, id);
        apply(userId, plan, request);
        return PlanResponse.from(plan);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        plans.delete(load(userId, id));
    }

    @Transactional
    public PlanResponse setPrepared(UUID userId, UUID id, boolean prepared) {
        PlannedMeal plan = load(userId, id);
        plan.setPrepared(prepared && plan.getPrepDate() != null, clock.instant());
        return PlanResponse.from(plan);
    }

    /**
     * Pasa la comida planificada al diario: copia los alimentos de su comida habitual o, si no tiene, anota solo el
     * título (sin nutrientes, que no se inventan).
     */
    @Transactional
    public PlanResponse log(UUID userId, UUID id) {
        PlannedMeal plan = load(userId, id);
        if (plan.getLoggedAt() != null) {
            throw new ConflictException("planned-meal-logged");
        }
        new FieldValidationException.Collector()
                .add(plan.getDate().isAfter(today()), "date", "nutrition.plan.log.future")
                .throwIfAny();
        List<Food> foods = plan.getSavedMealId() == null ? List.of()
                : savedMeals.findByIdAndUserId(plan.getSavedMealId(), userId)
                        .map(saved -> saved.getItems().stream().map(SavedMeal.Item::getFood).toList())
                        .orElse(List.of());
        if (foods.isEmpty()) {
            foods = List.of(new Food(plan.getTitle(), null, null, null, null, null, null, false));
        }
        foods.forEach(food -> entries.save(new FoodEntry(userId, plan.getDate(), plan.getMeal(), food,
                clock.instant())));
        plan.markLogged(clock.instant());
        return PlanResponse.from(plan);
    }

    /** Copia los 7 días que empiezan en from a los 7 que empiezan en to, sin preparar ni registrar. */
    @Transactional
    public List<PlanResponse> copyWeek(UUID userId, LocalDate from, LocalDate to) {
        new FieldValidationException.Collector()
                .add(from.equals(to), "to", "nutrition.plan.copy.same")
                .throwIfAny();
        long shift = ChronoUnit.DAYS.between(from, to);
        find(userId, from, from.plusDays(6)).forEach(plan -> plans.save(plan.copyTo(plan.getDate().plusDays(shift),
                plan.getPrepDate() == null ? null : plan.getPrepDate().plusDays(shift), clock.instant())));
        plans.flush();
        return find(userId, to, to.plusDays(6)).stream().map(PlanResponse::from).toList();
    }

    private void apply(UUID userId, PlannedMeal plan, PlanRequest request) {
        SavedMeal saved = request.savedMealId() == null ? null
                : savedMeals.findByIdAndUserId(request.savedMealId(), userId).orElse(null);
        String title = request.title() == null || request.title().isBlank()
                ? (saved == null ? null : saved.getName())
                : request.title().strip();
        new FieldValidationException.Collector()
                .add(request.savedMealId() != null && saved == null, "savedMealId", "nutrition.plan.saved.missing")
                .add(title == null, "title", "nutrition.plan.title.required")
                .add(request.prepDate() != null && request.prepDate().isAfter(request.date()), "prepDate",
                        "nutrition.plan.prep.after")
                .throwIfAny();
        String notes = request.notes() == null || request.notes().isBlank() ? null : request.notes().strip();
        plan.update(request.date(), request.meal(), title, request.savedMealId(), notes, request.prepDate(),
                clock.instant());
    }

    private List<PlannedMeal> find(UUID userId, LocalDate from, LocalDate to) {
        return plans.findByUserIdAndDateBetweenOrderByDateAscCreatedAtAsc(userId, from, to).stream().sorted(ORDER)
                .toList();
    }

    private PlannedMeal load(UUID userId, UUID id) {
        return plans.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(properties.timezone()));
    }
}
