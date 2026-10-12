package com.lifeos.tasks;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.tasks.TaskDtos.CategoryRequest;
import com.lifeos.tasks.TaskDtos.CategoryResponse;

@Service
public class TaskCategoryService {

    private static final UUID NONE = new UUID(0, 0);

    private final TaskCategoryRepository categories;
    private final Clock clock;

    public TaskCategoryService(TaskCategoryRepository categories, Clock clock) {
        this.categories = categories;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> list(UUID userId) {
        return categories.findByUserIdOrderByNameAsc(userId).stream().map(CategoryResponse::from).toList();
    }

    @Transactional
    public CategoryResponse create(UUID userId, CategoryRequest request) {
        String name = request.name().trim();
        checkUnique(userId, name, NONE);
        return CategoryResponse.from(categories.save(new TaskCategory(userId, name, request.color(), clock.instant())));
    }

    @Transactional
    public CategoryResponse update(UUID userId, UUID id, CategoryRequest request) {
        TaskCategory category = categories.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
        String name = request.name().trim();
        checkUnique(userId, name, id);
        category.update(name, request.color());
        return CategoryResponse.from(category);
    }

    /** Las tareas de la categoría se conservan sin categoría (ON DELETE SET NULL). */
    @Transactional
    public void delete(UUID userId, UUID id) {
        categories.delete(categories.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new));
    }

    private void checkUnique(UUID userId, String name, UUID excludeId) {
        new FieldValidationException.Collector()
                .add(categories.existsByName(userId, name, excludeId), "name", "task.category.name.duplicate")
                .throwIfAny();
    }
}
