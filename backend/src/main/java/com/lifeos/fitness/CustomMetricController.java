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
import com.lifeos.fitness.FitnessDtos.CustomMetricRequest;
import com.lifeos.fitness.FitnessDtos.CustomMetricResponse;

@RestController
@RequestMapping("/api/fitness/metrics")
public class CustomMetricController {

    private final CustomMetricService service;

    public CustomMetricController(CustomMetricService service) {
        this.service = service;
    }

    @GetMapping
    public List<CustomMetricResponse> list(@AuthenticationPrincipal AppUserPrincipal user) {
        return service.list(user.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CustomMetricResponse create(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody CustomMetricRequest request) {
        return service.create(user.id(), request);
    }

    @PutMapping("/{id}")
    public CustomMetricResponse update(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody CustomMetricRequest request) {
        return service.update(user.id(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        service.delete(user.id(), id);
    }
}
