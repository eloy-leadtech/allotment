const DIACRITICS = /[̀-ͯ]/g;

/** Lowercase, accent-stripped, hyphenated slug. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Stable synthetic player id. The source `id_plantilla` is only a per-team slot
 * (not unique across teams/seasons), so we derive our own from stable facts.
 */
export function syntheticPlayerId(
  nombreCompleto: string,
  birthYear: number | null,
  teamId: string,
): string {
  return [teamId, slugify(nombreCompleto), birthYear ?? 'na'].join('-');
}
