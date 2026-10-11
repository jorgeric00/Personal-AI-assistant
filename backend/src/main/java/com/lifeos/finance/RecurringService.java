package com.lifeos.finance;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.lifeos.common.config.LifeosProperties;
import com.lifeos.common.error.FieldValidationException;
import com.lifeos.common.error.NotFoundException;
import com.lifeos.finance.FinanceDtos.RecurringRequest;
import com.lifeos.finance.FinanceDtos.RecurringResponse;

/**
 * Movimientos recurrentes. Cada aparición se genera una sola vez como un movimiento normal, cuando llega su
 * fecha: al crear la regla (las apariciones ya pasadas), al consultar finanzas y cada hora en segundo plano.
 */
@Service
public class RecurringService {

    /** Límite de apariciones generadas de una vez por regla (evita bucles con fechas de inicio muy antiguas). */
    static final int MAX_PER_RUN = 400;

    private final RecurringRepository rules;
    private final MovementRepository movements;
    private final FinanceCatalogService catalog;
    private final FinanceSetupService setup;
    private final ApplicationEventPublisher events;
    private final LifeosProperties properties;
    private final Clock clock;

    public RecurringService(RecurringRepository rules, MovementRepository movements, FinanceCatalogService catalog,
            FinanceSetupService setup, ApplicationEventPublisher events, LifeosProperties properties, Clock clock) {
        this.rules = rules;
        this.movements = movements;
        this.catalog = catalog;
        this.setup = setup;
        this.events = events;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<RecurringResponse> list(UUID userId) {
        return rules.findAllForUser(userId).stream().map(RecurringResponse::from).toList();
    }

    @Transactional
    public RecurringResponse create(UUID userId, RecurringRequest request) {
        FinanceCategory category = catalog.loadCategory(userId, request.categoryId());
        FinanceAccount account = request.accountId() == null ? null : catalog.loadAccount(userId, request.accountId());
        LocalDate today = today();
        new FieldValidationException.Collector()
                .add(category.getKind() != request.kind(), "categoryId", "finance.movement.category.kind-mismatch")
                .add(category.isArchived(), "categoryId", "finance.movement.category.archived")
                .add(request.startDate().isBefore(today.minusYears(5)), "startDate", "finance.recurring.start.too-old")
                .add(request.untilDate() != null && request.untilDate().isBefore(request.startDate()), "untilDate",
                        "finance.recurring.until.before-start")
                .throwIfAny();
        Recurring rule = rules.save(new Recurring(userId, request.kind(), request.amountCents(), setup.currency(userId),
                category, account, Objects.requireNonNullElse(request.description(), "").strip(), request.frequency(),
                request.every(), request.startDate(), request.untilDate(), clock.instant()));
        generate(userId, List.of(rule), today);
        return RecurringResponse.from(rule);
    }

    /** Deja de repetir desde hoy; los movimientos ya generados se conservan. */
    @Transactional
    public RecurringResponse stop(UUID userId, UUID id) {
        Recurring rule = rules.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new);
        rule.stopFrom(today().plusDays(1), clock.instant());
        return RecurringResponse.from(rule);
    }

    /** Borra la regla; los movimientos generados se conservan como movimientos sueltos. */
    @Transactional
    public void delete(UUID userId, UUID id) {
        rules.delete(rules.findByIdAndUserId(id, userId).orElseThrow(NotFoundException::new));
    }

    /** Genera las apariciones pendientes del usuario en una transacción propia (válido desde lecturas). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int generateDue(UUID userId) {
        LocalDate today = today();
        return generate(userId, rules.lockDueForUser(userId, today), today);
    }

    @Transactional(readOnly = true)
    public List<UUID> usersWithDue() {
        return rules.findUsersWithDue(today());
    }

    private int generate(UUID userId, List<Recurring> due, LocalDate today) {
        Set<UUID> categories = new HashSet<>();
        Set<YearMonth> months = new HashSet<>();
        int created = 0;
        for (Recurring rule : due) {
            for (int i = 0; i < MAX_PER_RUN && rule.getNextDate() != null && !rule.getNextDate().isAfter(today); i++) {
                movements.save(Movement.fromRecurring(rule, rule.getNextDate(), clock.instant()));
                categories.add(rule.getCategory().getId());
                months.add(YearMonth.from(rule.getNextDate()));
                rule.advance(clock.instant());
                created++;
            }
        }
        if (created > 0) {
            events.publishEvent(new MovementsChanged(userId, categories, months));
        }
        return created;
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(properties.timezone()));
    }
}
