package com.lifeos.fitness;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.lifeos.auth.AppUserPrincipal;
import com.lifeos.fitness.WorkoutDtos.RecordResponse;
import com.lifeos.fitness.WorkoutDtos.StartRequest;
import com.lifeos.fitness.WorkoutDtos.WorkoutRequest;
import com.lifeos.fitness.WorkoutDtos.WorkoutResponse;
import com.lifeos.fitness.WorkoutDtos.WorkoutSummary;

@RestController
@RequestMapping("/api/fitness")
public class WorkoutController {

    private final WorkoutService service;

    public WorkoutController(WorkoutService service) {
        this.service = service;
    }

    @GetMapping("/workouts")
    public List<WorkoutSummary> list(@AuthenticationPrincipal AppUserPrincipal user) {
        return service.list(user.id());
    }

    @PostMapping("/workouts")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkoutResponse start(@AuthenticationPrincipal AppUserPrincipal user, @RequestBody StartRequest request) {
        return service.start(user.id(), request);
    }

    @GetMapping("/workouts/{id}")
    public WorkoutResponse get(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        return service.get(user.id(), id);
    }

    @PutMapping("/workouts/{id}")
    public WorkoutResponse update(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody WorkoutRequest request) {
        return service.update(user.id(), id, request);
    }

    @DeleteMapping("/workouts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        service.delete(user.id(), id);
    }

    @GetMapping("/records")
    public List<RecordResponse> records(@AuthenticationPrincipal AppUserPrincipal user) {
        return service.records(user.id());
    }
}
