package com.lifeos.nutrition;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.lifeos.auth.AppUserPrincipal;
import com.lifeos.nutrition.NutritionDtos.DayResponse;
import com.lifeos.nutrition.NutritionDtos.EntryRequest;
import com.lifeos.nutrition.NutritionDtos.EntryResponse;
import com.lifeos.nutrition.NutritionDtos.LogSavedMealRequest;
import com.lifeos.nutrition.NutritionDtos.NoteRequest;
import com.lifeos.nutrition.NutritionDtos.SavedMealRequest;
import com.lifeos.nutrition.NutritionDtos.SavedMealResponse;
import com.lifeos.nutrition.NutritionDtos.SummaryResponse;
import com.lifeos.nutrition.NutritionDtos.TargetRequest;
import com.lifeos.nutrition.NutritionDtos.TargetResponse;
import com.lifeos.nutrition.NutritionDtos.WaterRequest;

@RestController
@RequestMapping("/api/nutrition")
public class NutritionController {

    private final NutritionService service;

    public NutritionController(NutritionService service) {
        this.service = service;
    }

    @GetMapping("/days/{date}")
    public DayResponse day(@AuthenticationPrincipal AppUserPrincipal user,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.day(user.id(), date);
    }

    @PutMapping("/days/{date}/water")
    public DayResponse water(@AuthenticationPrincipal AppUserPrincipal user,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @Valid @RequestBody WaterRequest request) {
        return service.setWater(user.id(), date, request.waterMl());
    }

    @PutMapping("/days/{date}/notes")
    public DayResponse note(@AuthenticationPrincipal AppUserPrincipal user,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @Valid @RequestBody NoteRequest request) {
        return service.setNote(user.id(), date, request.meal(), request.note());
    }

    @PostMapping("/entries")
    @ResponseStatus(HttpStatus.CREATED)
    public EntryResponse addEntry(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody EntryRequest request) {
        return service.addEntry(user.id(), request);
    }

    @PutMapping("/entries/{id}")
    public EntryResponse updateEntry(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody EntryRequest request) {
        return service.updateEntry(user.id(), id, request);
    }

    @DeleteMapping("/entries/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEntry(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        service.deleteEntry(user.id(), id);
    }

    @GetMapping("/summary")
    public SummaryResponse summary(@AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.summary(user.id(), from, to);
    }

    @GetMapping("/targets")
    public TargetResponse target(@AuthenticationPrincipal AppUserPrincipal user) {
        return service.target(user.id());
    }

    @PutMapping("/targets")
    public TargetResponse saveTarget(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody TargetRequest request) {
        return service.saveTarget(user.id(), request);
    }

    @GetMapping("/saved-meals")
    public List<SavedMealResponse> savedMeals(@AuthenticationPrincipal AppUserPrincipal user) {
        return service.savedMeals(user.id());
    }

    @PostMapping("/saved-meals")
    @ResponseStatus(HttpStatus.CREATED)
    public SavedMealResponse createSavedMeal(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody SavedMealRequest request) {
        return service.createSavedMeal(user.id(), request);
    }

    @PutMapping("/saved-meals/{id}")
    public SavedMealResponse updateSavedMeal(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody SavedMealRequest request) {
        return service.updateSavedMeal(user.id(), id, request);
    }

    @DeleteMapping("/saved-meals/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSavedMeal(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        service.deleteSavedMeal(user.id(), id);
    }

    @PostMapping("/saved-meals/{id}/log")
    public DayResponse logSavedMeal(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody LogSavedMealRequest request) {
        return service.logSavedMeal(user.id(), id, request.date(), request.meal());
    }
}
