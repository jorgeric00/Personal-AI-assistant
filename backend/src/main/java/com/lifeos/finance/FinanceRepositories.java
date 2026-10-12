package com.lifeos.finance;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
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

    @Query("""
            select coalesce(sum(m.amountCents), 0) from Movement m
            where m.userId = :userId and m.category.id = :categoryId and m.kind = com.lifeos.finance.MovementKind.EXPENSE
              and m.date between :from and :to
            """)
    long sumExpense(UUID userId, UUID categoryId, LocalDate from, LocalDate to);

    /** Movimientos para exportar, en orden cronológico. */
    @Query("""
            select m from Movement m join fetch m.category left join fetch m.account
            where m.userId = :userId and m.date between :from and :to
            order by m.date asc, m.createdAt asc
            """)
    List<Movement> findForExport(UUID userId, LocalDate from, LocalDate to);

    @Query("""
            select count(m) from Movement m
            where m.userId = :userId and m.kind = :kind and m.amountCents = :amountCents and m.date = :date
              and m.category.id = :categoryId and m.description = :description
            """)
    long countSame(UUID userId, MovementKind kind, long amountCents, LocalDate date, UUID categoryId,
            String description);

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

interface RecurringRepository extends JpaRepository<Recurring, UUID> {

    @Query("""
            select r from Recurring r join fetch r.category left join fetch r.account
            where r.userId = :userId order by r.nextDate asc nulls last, r.createdAt asc
            """)
    List<Recurring> findAllForUser(UUID userId);

    Optional<Recurring> findByIdAndUserId(UUID id, UUID userId);

    /** Reglas con apariciones pendientes, bloqueadas para que dos procesos no generen la misma. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Recurring r where r.userId = :userId and r.nextDate <= :today")
    List<Recurring> lockDueForUser(UUID userId, LocalDate today);

    @Query("select distinct r.userId from Recurring r where r.nextDate <= :today")
    List<UUID> findUsersWithDue(LocalDate today);
}

interface BudgetRepository extends JpaRepository<Budget, UUID> {

    @Query("select b from Budget b join fetch b.category where b.userId = :userId")
    List<Budget> findAllForUser(UUID userId);

    Optional<Budget> findByCategoryId(UUID categoryId);

    Optional<Budget> findByIdAndUserId(UUID id, UUID userId);

    /** Registra un aviso; devuelve 1 solo la primera vez para ese presupuesto, mes y nivel. */
    @Modifying
    @Query(value = """
            insert into finance_budget_alert (budget_id, month, level, sent_at) values (:budgetId, :month, :level, :now)
            on conflict do nothing
            """, nativeQuery = true)
    int insertAlert(UUID budgetId, String month, String level, Instant now);
}
