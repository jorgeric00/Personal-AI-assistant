package com.lifeos.finance;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "finance_settings")
public class FinanceSettings {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false)
    private String currency;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected FinanceSettings() {
    }

    public FinanceSettings(UUID userId, String currency, Instant now) {
        this.userId = userId;
        this.currency = currency;
        this.createdAt = now;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getCurrency() {
        return currency;
    }
}
