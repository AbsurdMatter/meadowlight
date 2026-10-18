import { PLANT_BY_ID, PLANTS } from '../data/plants';
import type { Season } from '../data/seasons';

/**
 * Pollinator appeal engine \u2014 pure, testable scoring of a meadow patch.
 *
 * Real principles (DESIGN.md / EDUCATION.md):
 *  - flower diversity raises appeal (diverse pollen supports more species)
 *  - bloom succession matters: only in-bloom flowers feed anyone
 *  - bees need shallow water within forage range
 *  - wind shelter (hedges) saves energy, so sheltered plots forage better
 */

export interface ForageSpot {
  x: number;
  z: number;
}

export interface PollinatorWorld {
  /** planted flowers with their world positions (from the placement store) */
  flowers: (ForageSpot & { plantId: string })[];
  /** bee baths (water) */
  water: ForageSpot[];
  /** hedges (shelter) */
  shelter: ForageSpot[];
  season: Season;
}

export interface AppealBreakdown {
  score: number;
  diversity: number;
  abundance: number;
  water: number;
  shelter: number;
  inBloomSpecies: string[];
}

export const APPEAL_WEIGHTS = {
  diversity: 0.4,
  abundance: 0.3,
  water: 0.2,
  shelter: 0.1,
} as const;

/** forage radius around a hive, in world units */
export const FORAGE_RADIUS = 14;

/** True when this plant species is blooming in the given season. */
export function inBloom(plantId: string, season: Season): boolean {
  const def = PLANT_BY_ID[plantId];
  if (!def) return false;
  return def.bloom.includes(season);
}

/** Distinct species currently planted (regardless of season). */
export function plantedSpecies(plantIds: string[]): string[] {
  return [...new Set(plantIds.filter((id) => PLANT_BY_ID[id]))].sort();
}

/** True when at least one planted species is in bloom this season. */
export function hasBloom(plantIds: string[], season: Season): boolean {
  return plantIds.some((id) => inBloom(id, season));
}

/** True when every season has at least one blooming species planted. */
export function yearRoundBloom(plantIds: string[], seasons: Season[]): boolean {
  return seasons.every((s) => hasBloom(plantIds, s));
}

function distance2(a: ForageSpot, b: ForageSpot): number {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}

/**
 * Score a meadow patch around `origin` (typically a hive).
 * Returns 0..1 plus a breakdown so the UI can speak in warm specifics.
 */
export function computeAppeal(
  origin: ForageSpot,
  world: PollinatorWorld,
  radius: number = FORAGE_RADIUS,
): AppealBreakdown {
  const r2 = radius * radius;
  const nearby = world.flowers.filter((f) => distance2(f, origin) <= r2);
  const blooming = nearby.filter((f) => inBloom(f.plantId, world.season));
  const inBloomSpecies = plantedSpecies(blooming.map((f) => f.plantId));

  // diversity: 1 species = famine, 6 = a full buffet
  const diversity = PLANTS.length > 0 ? inBloomSpecies.length / PLANTS.length : 0;

  // abundance: gentle logarithmic ramp, full at ~40 blooming flowers
  const abundance = blooming.length === 0 ? 0 : Math.min(1, Math.log2(blooming.length + 1) / Math.log2(41));

  // water: nearest bath, full credit within 40% of range, tapering to 0
  let water = 0;
  for (const w of world.water) {
    const d = Math.sqrt(distance2(w, origin));
    if (d <= radius) {
      water = Math.max(water, 1 - d / radius);
    }
  }

  // shelter: hedges anywhere in forage range count (wind breaks protect plots)
  let shelter = 0;
  for (const h of world.shelter) {
    const d = Math.sqrt(distance2(h, origin));
    if (d <= radius) shelter = Math.max(shelter, 1 - Math.min(1, d / radius) * 0.5);
  }

  const score = Math.min(
    1,
    diversity * APPEAL_WEIGHTS.diversity +
      abundance * APPEAL_WEIGHTS.abundance +
      water * APPEAL_WEIGHTS.water +
      shelter * APPEAL_WEIGHTS.shelter,
  );

  return { score, diversity, abundance, water, shelter, inBloomSpecies };
}

/**
 * Bees supported by one hive: scales with its local appeal. No hive ever
 * "fails" \u2014 a lonely hive just keeps a small, quiet cluster.
 */
export function beesForHive(appeal: number, base: number, max: number): number {
  const desired = base * (0.3 + appeal);
  const lo = base * 0.3;
  const v = desired < lo ? lo : desired > max ? max : desired;
  return Math.round(v);
}
