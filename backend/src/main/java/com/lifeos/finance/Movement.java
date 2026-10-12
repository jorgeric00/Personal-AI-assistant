package com.lifeos.finance;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.BatchSize;

import com.lifeos.common.text.SearchText;

@Entity
@Table(name = "finance_movement")
public class Movement {

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

    @Column(nullable = false)
    private LocalDate date;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id")
    private FinanceCategory category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private FinanceAccount account;

    @Column(nullable = false)
    private String description;

    /** Regla de la que procede, si se generó automáticamente. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recurring_id")
    private Recurring recurring;

    @Column(name = "occurrence_date")
    private LocalDate occurrenceDate;

    @Column(name = "search_text", nullable = false)
    private String searchText;

    @ElementCollection
    @CollectionTable(name = "finance_movement_tag", joinColumns = @JoinColumn(name = "movement_id"))
    @Column(name = "name")
    @BatchSize(size = 100)
    private Set<String> tags = new LinkedHashSet<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Movement() {
    }

    public Movement(UUID userId, String currency, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.currency = currency;
        this.createdAt = now;
    }

    /** Movimiento generado por una regla recurrente para una de sus apariciones. */
    public static Movement fromRecurring(Recurring rule, LocalDate occurrence, Instant now) {
        Movement movement = new Movement(rule.getUserId(), rule.getCurrency(), now);
        movement.recurring = rule;
        movement.occurrenceDate = occurrence;
        movement.edit(rule.getKind(), rule.getAmountCents(), occurrence, rule.getCategory(), rule.getAccount(),
                rule.getDescription(), Set.of(), now);
        return movement;
    }

    public void edit(MovementKind kind, long amountCents, LocalDate date, FinanceCategory category,
            FinanceAccount account, String description, Set<String> tags, Instant now) {
        this.kind = kind;
        this.amountCents = amountCents;
        this.date = date;
        this.category = category;
        this.account = account;
        this.description = description;
        this.tags.clear();
        this.tags.addAll(tags);
        this.searchText = SearchText.normalize(description + " " + String.join(" ", tags));
        this.updatedAt = now;
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

    public LocalDate getDate() {
        return date;
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

    public Recurring getRecurring() {
        return recurring;
    }

    public Set<String> getTags() {
        return tags;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
