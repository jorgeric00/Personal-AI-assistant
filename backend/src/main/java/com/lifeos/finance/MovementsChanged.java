package com.lifeos.finance;

import java.time.YearMonth;
import java.util.Set;
import java.util.UUID;

/** Se han creado, cambiado o borrado movimientos de esas categorías y meses (para revisar presupuestos). */
public record MovementsChanged(UUID userId, Set<UUID> categoryIds, Set<YearMonth> months) {
}
