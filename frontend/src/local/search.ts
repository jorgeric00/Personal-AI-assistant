/** Búsqueda sin distinguir mayúsculas ni tildes ("cafe" encuentra "Café"), como SearchText del servidor. */

export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
}

/** Palabras de la búsqueda (como máximo 10); todas deben aparecer. */
export function searchTerms(query: string | null): string[] {
  if (query === null || query.trim() === '') return []
  return [...new Set(normalizeSearch(query).trim().split(/\s+/))].slice(0, 10)
}

/** Etiquetas en minúsculas, sin "#" inicial, con los espacios agrupados y sin repetir. */
export function normalizeTags(tags: string[]): string[] {
  const result = new Set<string>()
  for (const tag of tags) {
    const normalized = tag.trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ').toLowerCase()
    if (normalized !== '') result.add(normalized)
  }
  return [...result]
}
