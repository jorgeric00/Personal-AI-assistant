package com.lifeos.tasks;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface TaskRepository extends JpaRepository<Task, UUID> {

    Optional<Task> findByIdAndUserId(UUID id, UUID userId);

    List<Task> findByUserIdAndIdIn(UUID userId, Collection<UUID> ids);

    @Query("""
            select t from Task t left join fetch t.category
            where t.userId = :userId and t.status <> com.lifeos.tasks.Task.Status.DONE
            order by t.dueDate asc nulls last, t.dueTime asc nulls last, t.priority desc, t.createdAt asc
            """)
    List<Task> findOpen(UUID userId);

    @Query("""
            select t from Task t left join fetch t.category
            where t.userId = :userId and t.status = com.lifeos.tasks.Task.Status.DONE
            order by t.completedAt desc
            """)
    List<Task> findDone(UUID userId, Limit limit);

    /** Tareas con aviso cuya próxima aparición es anterior a {@code until} (de todos los usuarios). */
    @Query("""
            select t from Task t
            where t.status <> com.lifeos.tasks.Task.Status.DONE and t.reminderMinutesBefore is not null
              and t.dueTime is not null and t.dueDate <= :until
            """)
    List<Task> findWithNotificationUntil(LocalDate until);

    @Query("""
            select t from Task t left join fetch t.category
            where t.userId = :userId and t.status = com.lifeos.tasks.Task.Status.DONE
              and t.dueDate between :from and :to
            """)
    List<Task> findDoneBetween(UUID userId, LocalDate from, LocalDate to);
}

interface TaskCategoryRepository extends JpaRepository<TaskCategory, UUID> {

    List<TaskCategory> findByUserIdOrderByNameAsc(UUID userId);

    Optional<TaskCategory> findByIdAndUserId(UUID id, UUID userId);

    @Query("select count(c) > 0 from TaskCategory c where c.userId = :userId and lower(c.name) = lower(:name) and c.id <> :excludeId")
    boolean existsByName(UUID userId, String name, UUID excludeId);
}

interface TaskCompletionRepository extends JpaRepository<TaskCompletion, TaskCompletion.Key> {

    @Query("""
            select c from TaskCompletion c, Task t
            where c.key.taskId = t.id and t.userId = :userId and c.key.occurrenceDate between :from and :to
            """)
    List<TaskCompletion> findBetween(UUID userId, LocalDate from, LocalDate to);
}
