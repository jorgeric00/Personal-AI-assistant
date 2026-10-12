package com.lifeos.nutrition;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * Un alimento con su cantidad y nutrientes, todo opcional salvo el nombre. {@code estimated} indica que los
 * nutrientes son una estimación del usuario y no un dato confirmado.
 */
@Embeddable
public record Food(
        @Column(nullable = false) String name,
        BigDecimal quantity,
        String unit,
        Integer calories,
        @Column(name = "protein_g") BigDecimal proteinG,
        @Column(name = "carbs_g") BigDecimal carbsG,
        @Column(name = "fat_g") BigDecimal fatG,
        @Column(nullable = false) boolean estimated) {

    public boolean hasNutrients() {
        return calories != null || proteinG != null || carbsG != null || fatG != null;
    }
}
