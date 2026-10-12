package com.lifeos.tasks;

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
import com.lifeos.tasks.Task.Kind;
import com.lifeos.tasks.Task.Priority;
import com.lifeos.tasks.Task.Status;
import com.lifeos.tasks.TaskDtos.CalendarEntry;
import com.lifeos.tasks.TaskDtos.CategoryRequest;
import com.lifeos.tasks.TaskDtos.CategoryResponse;
import com.lifeos.tasks.TaskDtos.OccurrenceRequest;
import com.lifeos.tasks.TaskDtos.PostponeRequest;
import com.lifeos.tasks.TaskDtos.TaskRequest;
import com.lifeos.tasks.TaskDtos.TaskResponse;

@RestController
@RequestMapping("/api")
public class TaskController {

    private final TaskService taskService;
    private final TaskCategoryService categoryService;

    public TaskController(TaskService taskService, TaskCategoryService categoryService) {
        this.taskService = taskService;
        this.categoryService = categoryService;
    }

    @GetMapping("/tasks")
    public List<TaskResponse> list(@AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam(defaultValue = "ALL") TaskService.View view,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) Priority priority,
            @RequestParam(required = false) Kind kind,
            @RequestParam(required = false) Status status) {
        return taskService.list(user.id(), view, new TaskService.Filter(categoryId, priority, kind, status));
    }

    @GetMapping("/tasks/calendar")
    public List<CalendarEntry> calendar(@AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return taskService.calendar(user.id(), from, to);
    }

    @GetMapping("/tasks/{id}")
    public TaskResponse get(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        return taskService.get(user.id(), id);
    }

    @PostMapping("/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse create(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody TaskRequest request) {
        return taskService.create(user.id(), request);
    }

    @PutMapping("/tasks/{id}")
    public TaskResponse update(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody TaskRequest request) {
        return taskService.update(user.id(), id, request);
    }

    @DeleteMapping("/tasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        taskService.delete(user.id(), id);
    }

    @PostMapping("/tasks/{id}/complete")
    public TaskResponse complete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody OccurrenceRequest request) {
        return taskService.complete(user.id(), id, request.occurrenceDate());
    }

    @PostMapping("/tasks/{id}/uncomplete")
    public TaskResponse uncomplete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody OccurrenceRequest request) {
        return taskService.uncomplete(user.id(), id, request.occurrenceDate());
    }

    @PostMapping("/tasks/{id}/postpone")
    public TaskResponse postpone(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody PostponeRequest request) {
        return taskService.postpone(user.id(), id, request.date());
    }

    @GetMapping("/task-categories")
    public List<CategoryResponse> categories(@AuthenticationPrincipal AppUserPrincipal user) {
        return categoryService.list(user.id());
    }

    @PostMapping("/task-categories")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryResponse createCategory(@AuthenticationPrincipal AppUserPrincipal user,
            @Valid @RequestBody CategoryRequest request) {
        return categoryService.create(user.id(), request);
    }

    @PutMapping("/task-categories/{id}")
    public CategoryResponse updateCategory(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody CategoryRequest request) {
        return categoryService.update(user.id(), id, request);
    }

    @DeleteMapping("/task-categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable UUID id) {
        categoryService.delete(user.id(), id);
    }
}
