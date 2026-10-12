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
import com.lifeos.fitness.TrainingDtos.ExerciseRequest;
import com.lifeos.fitness.TrainingDtos.ExerciseResponse;
import com.lifeos.fitness.TrainingDtos.RoutineRequest;
import com.lifeos.fitness.TrainingDtos.RoutineResponse;

@RestController
@RequestMapping("/api/fitness")
public class TrainingController {

    private final TrainingService service;

    public TrainingController(TrainingService service) {
        this.service = service;
    }

    @GetMapping("/exercises")
    public List<ExerciseResponse> exercises(@AuthenticationPrincipal AppUserPrincipal user) {
        return service.exercises(user.id());
    }

    @PostMapping("/exercises")
    @ResponseStatus(HttpStatus.CREATED)
    public ExerciseResponse createExercise(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody ExerciseRequest request) {
        return service.createExercise(user.id(), request);
    }

    @PutMapping("/exercises/{id}")
    public ExerciseResponse updateExercise(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody ExerciseRequest request) {
        return service.updateExercise(user.id(), id, request);
    }

    @DeleteMapping("/exercises/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteExercise(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        service.deleteExercise(user.id(), id);
    }

    @GetMapping("/routines")
    public List<RoutineResponse> routines(@AuthenticationPrincipal AppUserPrincipal user) {
        return service.routines(user.id());
    }

    @PostMapping("/routines")
    @ResponseStatus(HttpStatus.CREATED)
    public RoutineResponse createRoutine(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody RoutineRequest request) {
        return service.createRoutine(user.id(), request);
    }

    @PutMapping("/routines/{id}")
    public RoutineResponse updateRoutine(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody RoutineRequest request) {
        return service.updateRoutine(user.id(), id, request);
    }

    @DeleteMapping("/routines/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRoutine(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        service.deleteRoutine(user.id(), id);
    }
}
