import { PLANTS, type PlantDef } from './plants';
import { SEASONS, type Season } from './seasons';

/**
 * UI round 2 (#6383805035): bloom-season presentation, DERIVED from the
 * engine's own bloom-window data (PLANTS[].bloom — the same array the
 * pollinator engine and season succession use). ONE SOURCE: no hand-written
 * season strings or groupings anywhere in the UI; everything below is
 * computed from the data, so a plant edit re-flows the palette for free.
 */

/** canonical season order for display (the year's flow) */
export const SEASON_ORDER: Season[] = SEASONS;

/** tooltip line for a flower chip — derived from the bloom windows */
export function bloomSeasonsLabel(plant: PlantDef): string {
  const seasons = SEASON_ORDER.filter((s) => plant.bloom.includes(s));
  if (seasons.length === 0) return 'blooms rarely — keep tending';
  if (seasons.length === SEASON_ORDER.length) return 'in bloom all year';
  return 'in bloom: ' + seasons.join(', ');
}

/**
 * Planting-tab grouping: flowers grouped by their bloom season(s) in the
 * year's order. MULTI-SEASON TREATMENT (the proposal): a flower that blooms
 * in more than one season appears in its PRIMARY (first) season's group and
 * carries a season badge listing all its seasons — one chip per flower, no
 * duplicates, every group headed by its season.
 */
export interface SeasonGroup {
  season: Season;
  /** flowers whose primary bloom season is this one */
  plants: PlantDef[];
}

export function plantingsBySeason(): SeasonGroup[] {
  const groups: SeasonGroup[] = SEASON_ORDER.map((season) => ({ season, plants: [] }));
  for (const p of PLANTS) {
    const primary = SEASON_ORDER.find((s) => p.bloom.includes(s));
    if (!primary) continue;
    groups.find((g) => g.season === primary)!.plants.push(p);
  }
  return groups.filter((g) => g.plants.length > 0);
}

/** badge text for a multi-season flower: its full bloom list */
export function seasonBadge(plant: PlantDef): string | null {
  if (plant.bloom.length <= 1) return null;
  return SEASON_ORDER.filter((s) => plant.bloom.includes(s))
    .map((s) => s.slice(0, 2))
    .join('/');
}
