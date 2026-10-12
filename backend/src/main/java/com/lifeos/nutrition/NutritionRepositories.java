package com.lifeos.nutrition;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface FoodEntryRepository extends JpaRepository<FoodEntry, UUID> {

    Optional<FoodEntry> findByIdAndUserId(UUID id, UUID userId);

    List<FoodEntry> findByUserIdAndDateBetweenOrderByDateAscCreatedAtAsc(UUID userId, LocalDate from, LocalDate to);
}

interface NutritionDayRepository extends JpaRepository<NutritionDay, NutritionDay.Key> {

    @Query("select d from NutritionDay d where d.key.userId = :userId and d.key.date between :from and :to")
    List<NutritionDay> findBetween(UUID userId, LocalDate from, LocalDate to);
}

interface NutritionTargetRepository extends JpaRepository<NutritionTarget, UUID> {
}

interface SavedMealRepository extends JpaRepository<SavedMeal, UUID> {

    @Query("select distinct m from SavedMeal m left join fetch m.items where m.userId = :userId order by m.name")
    List<SavedMeal> findAllWithItems(UUID userId);

    Optional<SavedMeal> findByIdAndUserId(UUID id, UUID userId);

    @Query("""
            select count(m) > 0 from SavedMeal m
            where m.userId = :userId and lower(m.name) = lower(:name) and m.id <> :excludeId
            """)
    boolean existsByName(UUID userId, String name, UUID excludeId);
}

interface PlannedMealRepository extends JpaRepository<PlannedMeal, UUID> {

    Optional<PlannedMeal> findByIdAndUserId(UUID id, UUID userId);

    List<PlannedMeal> findByUserIdAndDateBetweenOrderByDateAscCreatedAtAsc(UUID userId, LocalDate from,
            LocalDate to);
}
