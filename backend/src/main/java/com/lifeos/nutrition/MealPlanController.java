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
import com.lifeos.nutrition.NutritionDtos.CopyWeekRequest;
import com.lifeos.nutrition.NutritionDtos.PlanRequest;
import com.lifeos.nutrition.NutritionDtos.PlanResponse;
import com.lifeos.nutrition.NutritionDtos.PreparedRequest;

@RestController
@RequestMapping("/api/nutrition/plan")
public class MealPlanController {

    private final MealPlanService service;

    public MealPlanController(MealPlanService service) {
        this.service = service;
    }

    @GetMapping
    public List<PlanResponse> list(@AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.list(user.id(), from, to);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlanResponse create(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody PlanRequest request) {
        return service.create(user.id(), request);
    }

    @PutMapping("/{id}")
    public PlanResponse update(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody PlanRequest request) {
        return service.update(user.id(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        service.delete(user.id(), id);
    }

    @PutMapping("/{id}/prepared")
    public PlanResponse prepared(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody PreparedRequest request) {
        return service.setPrepared(user.id(), id, request.prepared());
    }

    @PostMapping("/{id}/log")
    public PlanResponse log(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        return service.log(user.id(), id);
    }

    @PostMapping("/copy-week")
    public List<PlanResponse> copyWeek(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody CopyWeekRequest request) {
        return service.copyWeek(user.id(), request.from(), request.to());
    }
}
