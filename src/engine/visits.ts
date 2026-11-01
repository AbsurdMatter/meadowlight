/**
 * Session 8 N2: pollinator-visit seeding precondition — the ONE visit ledger.
 *
 * Ecology: unvisited flowers don't set seed. A volunteer seedling requires
 * at least one pollinator visit (hive bee / solitary bee / bumble / moth /
 * butterfly / hoverfly) to its PARENT flower during the season that just
 * ended — one visit suffices.
 *
 * Where the signal lives (the user's one-source correction): the forage
 * simulation already DETECTS arrival at a target flower (BeeSwarm,
 * SolitaryBees, WildPollinators each have the arrive-radius branch) — but
 * it discarded the signal. This module is that signal's persistence, placed
 * in the engine NEXT TO the forage logic that causes it (not in the save
 * layer): the renderers call recordFlowerVisit(itemId) from their existing
 * arrival branches — no new detection, no parallel tracking, no second
 * input path.
 *
 * Data shape: per-item `visitedSeasons` (additive v8 save field on each
 * flower) — the seasons in which that flower received a visit. Pre-v8 saves
 * have no field: those flowers are "unvisited, eligible on next visit"
 * (never a hard reset of seeding — a meadow that always seeded continues
 * to seed as its flowers get visited, which the foragers do constantly).
 *
 * The seeding gate: rollVolunteers keeps its exact roll sequence (the RNG
 * parity lesson) and simply SKIPS parents with no visit in the ended
 * season — the precondition is a filter before the rolls, never a new roll.
 * (rollVolunteers inlines this same bloom+visit filter at its parents step;
 * visitedParents is the named, unit-tested form of exactly that predicate.)
 */
import type { Season } from '../data/seasons';
import type { PlacedItem } from './persistence';
import { inBloom } from './pollinator';

/** true if this flower received a pollinator visit during the given season */
export function wasVisitedThisSeason(item: PlacedItem, season: Season): boolean {
  return item.visitedSeasons?.includes(season) ?? false;
}

/**
 * Record a visit (engine-side ledger write; the foragers' arrival branches
 * call this). Returns the updated field — the CALLER owns the item, so the
 * write goes through the placement store's own set-state (one mutation
 * path), never a direct item mutation.
 */
export function withVisit(item: PlacedItem, season: Season): string[] {
  const existing = item.visitedSeasons ?? [];
  if (existing.includes(season)) return existing;
  return [...existing, season];
}

/**
 * The seeding precondition filter (one place, unit-tested): parents are the
 * blooming flowers of the ended season THAT WERE VISITED in it. Unvisited
 * flowers simply don't parent volunteers this rollover — no penalty, no
 * removal, they stay eligible on next visit.
 */
export function visitedParents(items: PlacedItem[], endedSeason: Season): PlacedItem[] {
  return items.filter((it) => inBloom(it.plantId, endedSeason) && wasVisitedThisSeason(it, endedSeason));
}

/**
 * Session 10 P1 (issue #53): the "unobserved season" distinction. True when
 * NO flower in the meadow recorded a visit during the given season — the
 * meadow had no pollinator activity that season (a flowers-only world at
 * accelerated speed, no hive/hotel placed, wild visitors not yet covering
 * the ground). Ecologically: an unobserved meadow is not an UNVISITED one —
 * absence of the ledger is absence of evidence, not evidence of absence.
 * rollVolunteers uses this to keep the reachability rule: a meadow that can
 * never self-seed is broken, so a season with zero recorded visits anywhere
 * falls back to the pre-N2 parent set (all blooming flowers) instead of
 * emptying it. The moment ONE visit exists in the season, strict N2 returns
 * per-flower.
 */
export function meadowUnobservedThisSeason(items: PlacedItem[], season: Season): boolean {
  return !items.some((it) => wasVisitedThisSeason(it, season));
}
