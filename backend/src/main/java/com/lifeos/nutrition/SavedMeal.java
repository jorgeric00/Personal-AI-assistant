package com.lifeos.nutrition;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/** Comida habitual: alimentos que se añaden juntos a un día con un toque. */
@Entity
@Table(name = "saved_meal")
public class SavedMeal {

    @Entity(name = "SavedMealItem")
    @Table(name = "saved_meal_item")
    public static class Item {

        @Id
        private UUID id;

        @ManyToOne(fetch = FetchType.LAZY, optional = false)
        @JoinColumn(name = "saved_meal_id")
        private SavedMeal savedMeal;

        @Column(nullable = false)
        private short position;

        @Embedded
        private Food food;

        protected Item() {
        }

        Item(SavedMeal savedMeal, int position, Food food) {
            this.id = UUID.randomUUID();
            this.savedMeal = savedMeal;
            this.position = (short) position;
            this.food = food;
        }

        public Food getFood() {
            return food;
        }
    }

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    private Meal meal;

    @OneToMany(mappedBy = "savedMeal", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    private List<Item> items = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected SavedMeal() {
    }

    public SavedMeal(UUID userId, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.createdAt = now;
    }

    public void update(String name, Meal meal, List<Food> foods, Instant now) {
        this.name = name;
        this.meal = meal;
        this.items.clear();
        for (int i = 0; i < foods.size(); i++) {
            this.items.add(new Item(this, i, foods.get(i)));
        }
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public Meal getMeal() {
        return meal;
    }

    public List<Item> getItems() {
        return items;
    }
}
