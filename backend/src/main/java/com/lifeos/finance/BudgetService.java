package com.lifeos.finance;

import java.time.Clock;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.finance.FinanceDtos.BudgetStatus;
import com.lifeos.finance.FinanceDtos.CategoryResponse;

@Service
public class BudgetService {

    /** A partir de este porcentaje del límite se avisa de que el presupuesto está cerca. */
    public static final int WARNING_PERCENT = 80;

    public enum Level {
        OK, WARNING, EXCEEDED
    }

    private final BudgetRepository budgets;
    private final MovementRepository movements;
    private final FinanceCatalogService catalog;
    private final FinanceSetupService setup;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public BudgetService(BudgetRepository budgets, MovementRepository movements, FinanceCatalogService catalog,
            FinanceSetupService setup, ApplicationEventPublisher events, Clock clock) {
        this.budgets = budgets;
        this.movements = movements;
        this.catalog = catalog;
        this.setup = setup;
        this.events = events;
        this.clock = clock;
    }

    /** Estado de cada presupuesto en el mes, de más a menos consumido. */
    @Transactional(readOnly = true)
    public List<BudgetStatus> list(UUID userId, YearMonth month) {
        String currency = setup.currency(userId);
        return budgets.findAllForUser(userId).stream()
                .map(budget -> status(budget, month, currency))
                .sorted(Comparator.comparingDouble((BudgetStatus s) -> (double) s.spentCents() / s.amountCents())
                        .reversed().thenComparing(s -> s.category().name()))
                .toList();
    }

    /** Crea o cambia el presupuesto de una categoría de gastos. */
    @Transactional
    public BudgetStatus set(UUID userId, UUID categoryId, long amountCents, YearMonth month) {
        FinanceCategory category = catalog.loadCategory(userId, categoryId);
        new FieldValidationException.Collector()
                .add(category.getKind() != MovementKind.EXPENSE, "categoryId", "finance.budget.category.not-expense")
                .throwIfAny();
        Budget budget = budgets.findByCategoryId(categoryId)
                .map(existing -> {
                    existing.changeAmount(amountCents, clock.instant());
                    return existing;
                })
                .orElseGet(() -> budgets.save(new Budget(userId, category, amountCents, clock.instant())));
        events.publishEvent(new MovementsChanged(userId, Set.of(categoryId), Set.of(month)));
        return status(budget, month, setup.currency(userId));
    }

    @Transactional
    public void delete(UUID userId, UUID budgetId) {
        budgets.delete(budgets.findByIdAndUserId(budgetId, userId).orElseThrow(NotFoundException::new));
    }

    long spent(Budget budget, YearMonth month) {
        return movements.sumExpense(budget.getUserId(), budget.getCategory().getId(), month.atDay(1), month.atEndOfMonth());
    }

    static Level level(long spent, long limit) {
        if (spent >= limit) {
            return Level.EXCEEDED;
        }
        return spent * 100 >= limit * WARNING_PERCENT ? Level.WARNING : Level.OK;
    }

    private BudgetStatus status(Budget budget, YearMonth month, String currency) {
        long spent = spent(budget, month);
        return new BudgetStatus(budget.getId(), CategoryResponse.from(budget.getCategory()), budget.getAmountCents(),
                spent, currency, level(spent, budget.getAmountCents()));
    }
}
