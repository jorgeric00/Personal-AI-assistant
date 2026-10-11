package com.lifeos.finance;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Límite mensual de gasto para una categoría. */
@Entity
@Table(name = "finance_budget")
public class Budget {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id")
    private FinanceCategory category;

    @Column(name = "amount_cents", nullable = false)
    private long amountCents;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Budget() {
    }

    public Budget(UUID userId, FinanceCategory category, long amountCents, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.category = category;
        this.amountCents = amountCents;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void changeAmount(long amountCents, Instant now) {
        this.amountCents = amountCents;
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public FinanceCategory getCategory() {
        return category;
    }

    public long getAmountCents() {
        return amountCents;
    }
}
