package com.lifeos.finance;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Los importes viajan en céntimos (enteros) para no perder precisión. */
public final class FinanceDtos {

    private FinanceDtos() {
    }

    public record CategoryRequest(
            @NotNull(message = "{finance.category.kind.required}") MovementKind kind,
            @NotBlank(message = "{finance.category.name.required}")
            @Size(max = 50, message = "{finance.category.name.too-long}") String name,
            @NotNull(message = "{finance.category.color.invalid}")
            @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "{finance.category.color.invalid}") String color,
            Boolean archived) {
    }

    public record CategoryResponse(UUID id, MovementKind kind, String name, String color, boolean archived) {

        static CategoryResponse from(FinanceCategory category) {
            return new CategoryResponse(category.getId(), category.getKind(), category.getName(), category.getColor(),
                    category.isArchived());
        }
    }

    public record AccountRequest(
            @NotBlank(message = "{finance.account.name.required}")
            @Size(max = 50, message = "{finance.account.name.too-long}") String name) {
    }

    public record AccountResponse(UUID id, String name) {

        static AccountResponse from(FinanceAccount account) {
            return account == null ? null : new AccountResponse(account.getId(), account.getName());
        }
    }

    public record MovementRequest(
            @NotNull(message = "{finance.movement.kind.required}") MovementKind kind,
            @NotNull(message = "{finance.movement.amount.invalid}")
            @Min(value = 1, message = "{finance.movement.amount.invalid}")
            @Max(value = 100_000_000_000L, message = "{finance.movement.amount.too-big}") Long amountCents,
            @NotNull(message = "{finance.movement.date.required}") LocalDate date,
            @NotNull(message = "{finance.movement.category.required}") UUID categoryId,
            UUID accountId,
            @Size(max = 200, message = "{finance.movement.description.too-long}") String description,
            @Size(max = 20, message = "{finance.movement.tags.too-many}") List<String> tags) {
    }

    /** recurringId indica que el movimiento lo generó una regla recurrente. */
    public record MovementResponse(UUID id, MovementKind kind, long amountCents, String currency, LocalDate date,
            CategoryResponse category, AccountResponse account, String description, List<String> tags,
            UUID recurringId, Instant createdAt, Instant updatedAt) {
    }

    public record RecurringRequest(
            @NotNull(message = "{finance.movement.kind.required}") MovementKind kind,
            @NotNull(message = "{finance.movement.amount.invalid}")
            @Min(value = 1, message = "{finance.movement.amount.invalid}")
            @Max(value = 100_000_000_000L, message = "{finance.movement.amount.too-big}") Long amountCents,
            @NotNull(message = "{finance.movement.category.required}") UUID categoryId,
            UUID accountId,
            @Size(max = 200, message = "{finance.movement.description.too-long}") String description,
            @NotNull(message = "{finance.recurring.frequency.required}") Recurring.Frequency frequency,
            @NotNull(message = "{finance.recurring.every.invalid}")
            @Min(value = 1, message = "{finance.recurring.every.invalid}")
            @Max(value = 12, message = "{finance.recurring.every.invalid}") Integer every,
            @NotNull(message = "{finance.movement.date.required}") LocalDate startDate,
            LocalDate untilDate) {
    }

    public record RecurringResponse(UUID id, MovementKind kind, long amountCents, String currency,
            CategoryResponse category, AccountResponse account, String description, Recurring.Frequency frequency,
            int every, LocalDate startDate, LocalDate untilDate, LocalDate nextDate) {

        static RecurringResponse from(Recurring rule) {
            return new RecurringResponse(rule.getId(), rule.getKind(), rule.getAmountCents(), rule.getCurrency(),
                    CategoryResponse.from(rule.getCategory()), AccountResponse.from(rule.getAccount()),
                    rule.getDescription(), rule.getFrequency(), rule.getEvery(), rule.getStartDate(),
                    rule.getUntilDate(), rule.getNextDate());
        }
    }

    public record BudgetRequest(
            @NotNull(message = "{finance.movement.category.required}") UUID categoryId,
            @NotNull(message = "{finance.movement.amount.invalid}")
            @Min(value = 1, message = "{finance.movement.amount.invalid}")
            @Max(value = 100_000_000_000L, message = "{finance.movement.amount.too-big}") Long amountCents) {
    }

    public record BudgetStatus(UUID id, CategoryResponse category, long amountCents, long spentCents, String currency,
            BudgetService.Level level) {
    }

    /** Resultado de una importación CSV. Si hay errores no se importa nada. */
    public record ImportResult(int imported, int skippedDuplicates, List<String> createdCategories,
            List<String> createdAccounts, List<ImportError> errors) {
    }

    public record ImportError(int line, String message) {
    }

    public record Totals(long incomeCents, long expenseCents, long balanceCents) {

        static Totals of(long income, long expense) {
            return new Totals(income, expense, income - expense);
        }
    }

    public record MovementPage(List<MovementResponse> items, int page, int size, long totalItems, Totals totals,
            String currency) {
    }

    public record CategoryTotal(UUID categoryId, String name, String color, MovementKind kind, long amountCents) {
    }

    /** Resumen de un mes con el mes anterior para comparar. */
    public record MonthSummary(String month, String currency, Totals totals, String previousMonth,
            Totals previousTotals, List<CategoryTotal> byCategory) {
    }

    /** Un mes de la evolución: ingresos, gastos, balance del mes y ahorro acumulado desde el primer movimiento. */
    public record TrendPoint(String month, long incomeCents, long expenseCents, long balanceCents,
            long savingsCents) {
    }

    public record Trend(String currency, List<TrendPoint> points) {
    }

    public record TagResponse(String name, long count) {
    }
}
