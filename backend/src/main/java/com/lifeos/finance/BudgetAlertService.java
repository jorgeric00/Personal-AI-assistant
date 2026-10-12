package com.lifeos.finance;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Clock;
import java.time.YearMonth;
import java.util.Currency;
import java.util.Locale;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.finance.BudgetService.Level;
import com.lifeos.push.PushService;
import com.lifeos.push.PushService.Notification;
import com.lifeos.user.AppUser;
import com.lifeos.user.AppUserRepository;

/**
 * Avisa por notificación cuando el gasto del mes en curso llega al 80 % de un presupuesto o lo supera. Cada
 * nivel se avisa una sola vez por presupuesto y mes, aunque se sigan añadiendo gastos.
 */
@Service
public class BudgetAlertService {

    private static final Logger log = LoggerFactory.getLogger(BudgetAlertService.class);

    private final BudgetRepository budgets;
    private final BudgetService budgetService;
    private final PushService pushService;
    private final FinanceSetupService setup;
    private final AppUserRepository users;
    private final MessageSource messages;
    private final LifeosProperties properties;
    private final Clock clock;

    public BudgetAlertService(BudgetRepository budgets, BudgetService budgetService, PushService pushService, FinanceSetupService setup,
            AppUserRepository users, MessageSource messages, LifeosProperties properties, Clock clock) {
        this.budgets = budgets;
        this.budgetService = budgetService;
        this.pushService = pushService;
        this.setup = setup;
        this.users = users;
        this.messages = messages;
        this.properties = properties;
        this.clock = clock;
    }

    @TransactionalEventListener(fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onMovementsChanged(MovementsChanged event) {
        YearMonth current = YearMonth.now(clock.withZone(properties.timezone()));
        if (!event.months().contains(current)) {
            return;
        }
        for (UUID categoryId : event.categoryIds()) {
            budgets.findByCategoryId(categoryId).ifPresent(budget -> check(budget, current));
        }
    }

    private void check(Budget budget, YearMonth month) {
        long spent = budgetService.spent(budget, month);
        Level level = BudgetService.level(spent, budget.getAmountCents());
        if (level == Level.OK) {
            return;
        }
        // Al superar el límite de golpe se registra también el aviso previo para no enviarlo después.
        boolean warningIsNew = budgets.insertAlert(budget.getId(), month.toString(), Level.WARNING.name(), clock.instant()) == 1;
        boolean isNew = level == Level.WARNING ? warningIsNew
                : budgets.insertAlert(budget.getId(), month.toString(), Level.EXCEEDED.name(), clock.instant()) == 1;
        if (!isNew) {
            return;
        }
        AppUser user = users.findById(budget.getUserId()).orElseThrow();
        Locale locale = Locale.forLanguageTag(user.getLocale());
        String currency = setup.currency(budget.getUserId());
        String category = budget.getCategory().getName();
        Object[] args = {category, money(spent, currency, locale), money(budget.getAmountCents(), currency, locale),
                spent * 100 / budget.getAmountCents()};
        String key = level == Level.EXCEEDED ? "push.budget.exceeded" : "push.budget.warning";
        Notification notification = new Notification(
                messages.getMessage(key + ".title", args, locale),
                messages.getMessage(key + ".body", args, locale),
                "/finanzas?vista=BUDGETS",
                "budget-" + budget.getId() + "-" + month);
        try {
            pushService.sendToUser(user.getId(), notification);
        } catch (RuntimeException e) {
            log.warn("No se ha podido enviar el aviso de presupuesto", e);
        }
    }

    static String money(long cents, String currency, Locale locale) {
        NumberFormat format = NumberFormat.getCurrencyInstance(locale);
        format.setCurrency(Currency.getInstance(currency));
        return format.format(BigDecimal.valueOf(cents, 2));
    }
}
