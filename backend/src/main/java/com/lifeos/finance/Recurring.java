package com.lifeos.finance;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Ingreso o gasto que se repite. Las apariciones se calculan desde la fecha de inicio (la n-ésima es inicio + n
 * periodos), así un día 31 cae el último día de los meses cortos sin desplazar los siguientes.
 */
@Entity
@Table(name = "finance_recurring")
public class Recurring {

    public enum Frequency {
        WEEKLY, MONTHLY, YEARLY
    }

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MovementKind kind;

    @Column(name = "amount_cents", nullable = false)
    private long amountCents;

    @Column(nullable = false)
    private String currency;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id")
    private FinanceCategory category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private FinanceAccount account;

    @Column(nullable = false)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Frequency frequency;

    @Column(name = "every_n", nullable = false)
    private int every;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "until_date")
    private LocalDate untilDate;

    @Column(name = "next_index", nullable = false)
    private int nextIndex;

    /** Próxima aparición pendiente de generar; null cuando ya no quedan. */
    @Column(name = "next_date")
    private LocalDate nextDate;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Recurring() {
    }

    public Recurring(UUID userId, MovementKind kind, long amountCents, String currency, FinanceCategory category,
            FinanceAccount account, String description, Frequency frequency, int every, LocalDate startDate,
            LocalDate untilDate, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.kind = kind;
        this.amountCents = amountCents;
        this.currency = currency;
        this.category = category;
        this.account = account;
        this.description = description;
        this.frequency = frequency;
        this.every = every;
        this.startDate = startDate;
        this.untilDate = untilDate;
        this.nextIndex = 0;
        this.nextDate = startDate;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public LocalDate occurrence(int index) {
        long periods = (long) index * every;
        return switch (frequency) {
            case WEEKLY -> startDate.plusWeeks(periods);
            case MONTHLY -> startDate.plusMonths(periods);
            case YEARLY -> startDate.plusYears(periods);
        };
    }

    /** Marca la aparición actual como generada y calcula la siguiente. */
    public void advance(Instant now) {
        nextIndex++;
        LocalDate next = occurrence(nextIndex);
        nextDate = untilDate != null && next.isAfter(untilDate) ? null : next;
        updatedAt = now;
    }

    /** Deja de generar apariciones a partir de {@code date} (incluida). */
    public void stopFrom(LocalDate date, Instant now) {
        LocalDate last = date.minusDays(1);
        untilDate = last.isBefore(startDate) ? startDate.minusDays(1) : last;
        if (nextDate != null && nextDate.isAfter(untilDate)) {
            nextDate = null;
        }
        updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public MovementKind getKind() {
        return kind;
    }

    public long getAmountCents() {
        return amountCents;
    }

    public String getCurrency() {
        return currency;
    }

    public FinanceCategory getCategory() {
        return category;
    }

    public FinanceAccount getAccount() {
        return account;
    }

    public String getDescription() {
        return description;
    }

    public Frequency getFrequency() {
        return frequency;
    }

    public int getEvery() {
        return every;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getUntilDate() {
        return untilDate;
    }

    public LocalDate getNextDate() {
        return nextDate;
    }
}
