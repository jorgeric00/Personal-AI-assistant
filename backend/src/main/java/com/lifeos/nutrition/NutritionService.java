package com.lifeos.nutrition;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.nutrition.NutritionDtos.DayResponse;
import com.lifeos.nutrition.NutritionDtos.EntryRequest;
import com.lifeos.nutrition.NutritionDtos.EntryResponse;
import com.lifeos.nutrition.NutritionDtos.FoodRequest;
import com.lifeos.nutrition.NutritionDtos.MealDay;
import com.lifeos.nutrition.NutritionDtos.SavedMealRequest;
import com.lifeos.nutrition.NutritionDtos.SavedMealResponse;
import com.lifeos.nutrition.NutritionDtos.SummaryDay;
import com.lifeos.nutrition.NutritionDtos.SummaryResponse;
import com.lifeos.nutrition.NutritionDtos.TargetRequest;
import com.lifeos.nutrition.NutritionDtos.TargetResponse;
import com.lifeos.nutrition.NutritionDtos.Totals;

/** Diario de alimentación: alimentos por comida, agua, notas, objetivos y comidas habituales. */
@Service
public class NutritionService {

    /** Rango máximo del resumen (un mes). */
    static final int MAX_SUMMARY_DAYS = 31;

    private static final UUID NONE = new UUID(0, 0);

    private final FoodEntryRepository entries;
    private final NutritionDayRepository days;
    private final NutritionTargetRepository targets;
    private final SavedMealRepository savedMeals;
    private final LifeosProperties properties;
    private final Clock clock;

    public NutritionService(FoodEntryRepository entries, NutritionDayRepository days,
            NutritionTargetRepository targets, SavedMealRepository savedMeals, LifeosProperties properties,
            Clock clock) {
        this.entries = entries;
        this.days = days;
        this.targets = targets;
        this.savedMeals = savedMeals;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public DayResponse day(UUID userId, LocalDate date) {
        List<FoodEntry> list = entries.findByUserIdAndDateBetweenOrderByDateAscCreatedAtAsc(userId, date, date);
        NutritionDay day = days.findById(new NutritionDay.Key(userId, date)).orElse(null);
        List<MealDay> meals = Arrays.stream(Meal.values()).map(meal -> {
            List<FoodEntry> ofMeal = list.stream().filter(e -> e.getMeal() == meal).toList();
            return new MealDay(meal, day == null ? null : day.note(meal),
                    ofMeal.stream().map(EntryResponse::from).toList(),
                    Totals.of(ofMeal.stream().map(FoodEntry::getFood).toList()));
        }).toList();
        return new DayResponse(date, day == null ? 0 : day.getWaterMl(), meals,
                Totals.of(list.stream().map(FoodEntry::getFood).toList()), target(userId));
    }

    @Transactional
    public EntryResponse addEntry(UUID userId, EntryRequest request) {
        checkDate(request.date());
        return EntryResponse.from(entries.save(
                new FoodEntry(userId, request.date(), request.meal(), request.food().toFood(), clock.instant())));
    }

    @Transactional
    public EntryResponse updateEntry(UUID userId, UUID id, EntryRequest request) {
        FoodEntry entry = entries.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
        checkDate(request.date());
        entry.update(request.date(), request.meal(), request.food().toFood(), clock.instant());
        return EntryResponse.from(entry);
    }

    @Transactional
    public void deleteEntry(UUID userId, UUID id) {
        entries.delete(entries.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new));
    }

    @Transactional
    public DayResponse setWater(UUID userId, LocalDate date, int waterMl) {
        checkDate(date);
        loadOrCreateDay(userId, date).setWaterMl(waterMl, clock.instant());
        days.flush();
        return day(userId, date);
    }

    @Transactional
    public DayResponse setNote(UUID userId, LocalDate date, Meal meal, String note) {
        checkDate(date);
        loadOrCreateDay(userId, date).setNote(meal, note == null || note.isBlank() ? null : note.strip(),
                clock.instant());
        days.flush();
        return day(userId, date);
    }

    @Transactional(readOnly = true)
    public TargetResponse target(UUID userId) {
        return TargetResponse.from(targets.findById(userId).orElse(null));
    }

    @Transactional
    public TargetResponse saveTarget(UUID userId, TargetRequest request) {
        NutritionTarget target = targets.findById(userId).orElseGet(() -> new NutritionTarget(userId));
        target.update(request.calories(), request.proteinG(), request.carbsG(), request.fatG(), request.waterMl(),
                clock.instant());
        return TargetResponse.from(targets.save(target));
    }

    /** Un día por fecha del rango, con lo registrado (cero si no hay nada). */
    @Transactional(readOnly = true)
    public SummaryResponse summary(UUID userId, LocalDate from, LocalDate to) {
        new FieldValidationException.Collector()
                .add(to.isBefore(from) || ChronoUnit.DAYS.between(from, to) >= MAX_SUMMARY_DAYS, "to",
                        "nutrition.range.invalid")
                .throwIfAny();
        Map<LocalDate, List<Food>> foods = entries
                .findByUserIdAndDateBetweenOrderByDateAscCreatedAtAsc(userId, from, to).stream()
                .collect(Collectors.groupingBy(FoodEntry::getDate,
                        Collectors.mapping(FoodEntry::getFood, Collectors.toList())));
        Map<LocalDate, Integer> water = days.findBetween(userId, from, to).stream()
                .collect(Collectors.toMap(NutritionDay::getDate, NutritionDay::getWaterMl));
        List<SummaryDay> result = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            result.add(new SummaryDay(d, Totals.of(foods.getOrDefault(d, List.of())), water.getOrDefault(d, 0)));
        }
        return new SummaryResponse(result, target(userId));
    }

    @Transactional(readOnly = true)
    public List<SavedMealResponse> savedMeals(UUID userId) {
        return savedMeals.findAllWithItems(userId).stream().map(SavedMealResponse::from).toList();
    }

    @Transactional
    public SavedMealResponse createSavedMeal(UUID userId, SavedMealRequest request) {
        SavedMeal meal = new SavedMeal(userId, clock.instant());
        apply(userId, meal, request, NONE);
        return SavedMealResponse.from(savedMeals.save(meal));
    }

    @Transactional
    public SavedMealResponse updateSavedMeal(UUID userId, UUID id, SavedMealRequest request) {
        SavedMeal meal = loadSavedMeal(userId, id);
        apply(userId, meal, request, id);
        savedMeals.flush();
        return SavedMealResponse.from(meal);
    }

    @Transactional
    public void deleteSavedMeal(UUID userId, UUID id) {
        savedMeals.delete(loadSavedMeal(userId, id));
    }

    /** Copia los alimentos de una comida habitual al día indicado; después se editan sueltos. */
    @Transactional
    public DayResponse logSavedMeal(UUID userId, UUID id, LocalDate date, Meal meal) {
        SavedMeal saved = loadSavedMeal(userId, id);
        checkDate(date);
        saved.getItems().forEach(
                item -> entries.save(new FoodEntry(userId, date, meal, item.getFood(), clock.instant())));
        entries.flush();
        return day(userId, date);
    }

    private void apply(UUID userId, SavedMeal meal, SavedMealRequest request, UUID excludeId) {
        String name = request.name().strip();
        List<FoodRequest> items = request.items() == null ? List.of() : request.items();
        new FieldValidationException.Collector()
                .add(savedMeals.existsByName(userId, name, excludeId), "name", "nutrition.saved.name.duplicate")
                .add(items.isEmpty(), "items", "nutrition.saved.items.empty")
                .throwIfAny();
        meal.update(name, request.meal(), items.stream().map(FoodRequest::toFood).toList(), clock.instant());
    }

    /** El diario es de lo que ya se ha comido: no admite días futuros. */
    private void checkDate(LocalDate date) {
        new FieldValidationException.Collector()
                .add(date.isAfter(LocalDate.now(clock.withZone(properties.timezone()))), "date",
                        "nutrition.date.future")
                .throwIfAny();
    }

    private NutritionDay loadOrCreateDay(UUID userId, LocalDate date) {
        return days.findById(new NutritionDay.Key(userId, date))
                .orElseGet(() -> days.save(new NutritionDay(userId, date, clock.instant())));
    }

    private SavedMeal loadSavedMeal(UUID userId, UUID id) {
        return savedMeals.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
    }
}
