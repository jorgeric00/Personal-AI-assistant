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
import com.lifeos.fitness.FitnessDtos.MeasurementRequest;
import com.lifeos.fitness.FitnessDtos.MeasurementResponse;
import com.lifeos.fitness.FitnessDtos.ProfileRequest;
import com.lifeos.fitness.FitnessDtos.ProfileResponse;

@RestController
@RequestMapping("/api/fitness")
public class FitnessController {

    private final FitnessService service;

    public FitnessController(FitnessService service) {
        this.service = service;
    }

    @GetMapping("/profile")
    public ProfileResponse profile(@AuthenticationPrincipal AppUserPrincipal user) {
        return service.profile(user.id());
    }

    @PutMapping("/profile")
    public ProfileResponse updateProfile(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody ProfileRequest request) {
        return service.updateProfile(user.id(), request);
    }

    @GetMapping("/measurements")
    public List<MeasurementResponse> measurements(@AuthenticationPrincipal AppUserPrincipal user) {
        return service.measurements(user.id());
    }

    @PostMapping("/measurements")
    @ResponseStatus(HttpStatus.CREATED)
    public MeasurementResponse createMeasurement(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody MeasurementRequest request) {
        return service.createMeasurement(user.id(), request);
    }

    @PutMapping("/measurements/{id}")
    public MeasurementResponse updateMeasurement(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody MeasurementRequest request) {
        return service.updateMeasurement(user.id(), id, request);
    }

    @DeleteMapping("/measurements/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMeasurement(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        service.deleteMeasurement(user.id(), id);
    }
}
