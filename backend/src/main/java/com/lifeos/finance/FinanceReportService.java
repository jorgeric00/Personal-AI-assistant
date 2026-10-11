package com.lifeos.finance;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.finance.FinanceDtos.CategoryTotal;
import com.lifeos.finance.FinanceDtos.MonthSummary;
import com.lifeos.finance.FinanceDtos.Totals;
import com.lifeos.finance.FinanceDtos.Trend;
import com.lifeos.finance.FinanceDtos.TrendPoint;
import com.lifeos.finance.MovementRepository.CategorySum;
import com.lifeos.finance.MovementRepository.KindSum;
import com.lifeos.finance.MovementRepository.MonthSum;

/**
 * Resúmenes calculados en la base de datos con enteros (céntimos). Todas las cifras están en la moneda del
 * usuario; mientras no haya conversión de divisas se asume que todos los movimientos usan la misma.
 */
@Service
public class FinanceReportService {

    public static final int MAX_TREND_MONTHS = 36;

    private final MovementRepository movements;
    private final FinanceCategoryRepository categories;
    private final FinanceSetupService setup;
    private final RecurringService recurring;

    public FinanceReportService(MovementRepository movements, FinanceCategoryRepository categories,
            FinanceSetupService setup, RecurringService recurring) {
        this.movements = movements;
        this.categories = categories;
        this.setup = setup;
        this.recurring = recurring;
    }

    @Transactional(readOnly = true)
    public MonthSummary month(UUID userId, YearMonth month) {
        String currency = setup.currency(userId);
        recurring.generateDue(userId);
        List<CategorySum> sums = movements.sumByCategory(userId, month.atDay(1), month.atEndOfMonth());
        Map<UUID, FinanceCategory> byId = categories.findByUserIdOrderByKindAscNameAsc(userId).stream()
                .collect(Collectors.toMap(FinanceCategory::getId, Function.identity()));

        List<CategoryTotal> byCategory = sums.stream()
                .map(s -> {
                    FinanceCategory category = byId.get(s.getCategoryId());
                    return new CategoryTotal(s.getCategoryId(), category.getName(), category.getColor(), s.getKind(),
                            s.getTotal());
                })
                .sorted(Comparator.comparing(CategoryTotal::kind).reversed()
                        .thenComparing(Comparator.comparingLong(CategoryTotal::amountCents).reversed())
                        .thenComparing(CategoryTotal::name))
                .toList();

        YearMonth previous = month.minusMonths(1);
        return new MonthSummary(month.toString(), currency, totals(sums), previous.toString(),
                totals(movements.sumByCategory(userId, previous.atDay(1), previous.atEndOfMonth())), byCategory);
    }

    /** Evolución de los últimos {@code months} meses hasta {@code to} incluido. */
    @Transactional(readOnly = true)
    public Trend trend(UUID userId, YearMonth to, int months) {
        String currency = setup.currency(userId);
        recurring.generateDue(userId);
        YearMonth from = to.minusMonths(months - 1L);
        LocalDate start = from.atDay(1);

        Map<YearMonth, long[]> perMonth = new HashMap<>();
        for (MonthSum sum : movements.sumByMonth(userId, start, to.atEndOfMonth())) {
            long[] values = perMonth.computeIfAbsent(YearMonth.of(sum.getYear(), sum.getMonth()), k -> new long[2]);
            values[sum.getKind() == MovementKind.INCOME ? 0 : 1] += sum.getTotal();
        }
        long savings = 0;
        for (KindSum sum : movements.sumBefore(userId, start)) {
            savings += sum.getKind() == MovementKind.INCOME ? sum.getTotal() : -sum.getTotal();
        }

        List<TrendPoint> points = new ArrayList<>();
        for (YearMonth month = from; !month.isAfter(to); month = month.plusMonths(1)) {
            long[] values = perMonth.getOrDefault(month, new long[2]);
            long balance = values[0] - values[1];
            savings += balance;
            points.add(new TrendPoint(month.toString(), values[0], values[1], balance, savings));
        }
        return new Trend(currency, points);
    }

    private static Totals totals(List<CategorySum> sums) {
        long income = 0;
        long expense = 0;
        for (CategorySum sum : sums) {
            if (sum.getKind() == MovementKind.INCOME) {
                income += sum.getTotal();
            } else {
                expense += sum.getTotal();
            }
        }
        return Totals.of(income, expense);
    }
}
