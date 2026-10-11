package com.lifeos.finance;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface FinanceSettingsRepository extends JpaRepository<FinanceSettings, UUID> {

    /** Crea los ajustes si no existen; devuelve 1 solo a la petición que los ha creado. */
    @Modifying
    @Query(value = """
            insert into finance_settings (user_id, currency, created_at) values (:userId, :currency, :now)
            on conflict do nothing
            """, nativeQuery = true)
    int insertIfAbsent(UUID userId, String currency, Instant now);
}

interface FinanceCategoryRepository extends JpaRepository<FinanceCategory, UUID> {

    List<FinanceCategory> findByUserIdOrderByKindAscNameAsc(UUID userId);

    Optional<FinanceCategory> findByIdAndUserId(UUID id, UUID userId);

    @Query("""
            select count(c) > 0 from FinanceCategory c
            where c.userId = :userId and c.kind = :kind and lower(c.name) = lower(:name) and c.id <> :excludeId
            """)
    boolean existsByName(UUID userId, MovementKind kind, String name, UUID excludeId);
}

interface FinanceAccountRepository extends JpaRepository<FinanceAccount, UUID> {

    List<FinanceAccount> findByUserIdOrderByNameAsc(UUID userId);

    Optional<FinanceAccount> findByIdAndUserId(UUID id, UUID userId);

    @Query("""
            select count(a) > 0 from FinanceAccount a
            where a.userId = :userId and lower(a.name) = lower(:name) and a.id <> :excludeId
            """)
    boolean existsByName(UUID userId, String name, UUID excludeId);
}

interface MovementRepository extends JpaRepository<Movement, UUID> {

    Optional<Movement> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByCategoryId(UUID categoryId);

    /** Sumas por categoría y tipo en un intervalo de fechas. */
    @Query("""
            select m.category.id as categoryId, m.kind as kind, sum(m.amountCents) as total from Movement m
            where m.userId = :userId and m.date between :from and :to
            group by m.category.id, m.kind
            """)
    List<CategorySum> sumByCategory(UUID userId, LocalDate from, LocalDate to);

    /** Sumas por mes y tipo en un intervalo de fechas. */
    @Query("""
            select year(m.date) as year, month(m.date) as month, m.kind as kind, sum(m.amountCents) as total
            from Movement m
            where m.userId = :userId and m.date between :from and :to
            group by year(m.date), month(m.date), m.kind
            """)
    List<MonthSum> sumByMonth(UUID userId, LocalDate from, LocalDate to);

    /** Sumas por tipo antes de una fecha (para el ahorro acumulado). */
    @Query("""
            select m.kind as kind, sum(m.amountCents) as total from Movement m
            where m.userId = :userId and m.date < :before
            group by m.kind
            """)
    List<KindSum> sumBefore(UUID userId, LocalDate before);

    @Query("""
            select t as name, count(m) as count from Movement m join m.tags t
            where m.userId = :userId group by t order by t
            """)
    List<TagCount> countTags(UUID userId);

    interface CategorySum {
        UUID getCategoryId();

        MovementKind getKind();

        long getTotal();
    }

    interface MonthSum {
        int getYear();

        int getMonth();

        MovementKind getKind();

        long getTotal();
    }

    interface KindSum {
        MovementKind getKind();

        long getTotal();
    }

    interface TagCount {
        String getName();

        long getCount();
    }
}
