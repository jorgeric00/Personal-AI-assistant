package com.lifeos.agenda;

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

import com.lifeos.agenda.AgendaDtos.ActivityRequest;
import com.lifeos.agenda.AgendaDtos.ActivityResponse;
import com.lifeos.agenda.AgendaDtos.AgendaItem;
import com.lifeos.agenda.AgendaDtos.CategoryRequest;
import com.lifeos.agenda.AgendaDtos.CategoryResponse;
import com.lifeos.agenda.AgendaDtos.StatusRequest;
import com.lifeos.auth.AppUserPrincipal;

@RestController
@RequestMapping("/api/agenda")
public class AgendaController {

    private final AgendaService service;

    public AgendaController(AgendaService service) {
        this.service = service;
    }

    @GetMapping
    public List<AgendaItem> agenda(@AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.agenda(user.id(), from, to);
    }

    @GetMapping("/activities/{id}")
    public ActivityResponse activity(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        return service.activity(user.id(), id);
    }

    @PostMapping("/activities")
    @ResponseStatus(HttpStatus.CREATED)
    public ActivityResponse create(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody ActivityRequest request) {
        return service.create(user.id(), request);
    }

    @PutMapping("/activities/{id}")
    public ActivityResponse update(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody ActivityRequest request) {
        return service.update(user.id(), id, request);
    }

    @DeleteMapping("/activities/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        service.delete(user.id(), id);
    }

    @PutMapping("/activities/{id}/occurrences/{date}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setStatus(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @Valid @RequestBody StatusRequest request) {
        service.setStatus(user.id(), id, date, request.status());
    }

    @GetMapping("/categories")
    public List<CategoryResponse> categories(@AuthenticationPrincipal AppUserPrincipal user) {
        return service.categories(user.id());
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryResponse createCategory(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody CategoryRequest request) {
        return service.createCategory(user.id(), request);
    }

    @PutMapping("/categories/{id}")
    public CategoryResponse updateCategory(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody CategoryRequest request) {
        return service.updateCategory(user.id(), id, request);
    }

    @DeleteMapping("/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        service.deleteCategory(user.id(), id);
    }
}
