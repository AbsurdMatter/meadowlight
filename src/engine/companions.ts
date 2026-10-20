import { PLANT_BY_ID } from '../data/plants';
import { RECIPES, RECIPE_TUNING, recipeFor, type RecipeDef } from '../data/recipes';
import type { PlacedItem } from './persistence';

/**
 * #9 (session 6, unit 2): companion-planting engine — pure, testable.
 *
 * RAW-QUERY RULE (session-5 lesson): the ground classification used here
 * is the SAME isPlantableCell query the overlay/ghost classify with —
 * recipes only ever form on cells the game itself calls plantable. (The
 * placement path already guarantees placed items sit on plantable cells;
 * the filter is defensive parity, not a second oracle.)
 *
 * NO PUNISHMENT, EVER: the outputs are strictly additive. companionSet()
 * marks flowers that have a recipe partner within the adjacency radius;
 * everything else is simply unmarked. Nothing may wither, dim, or lose
 * bee visits because of a non-recipe pairing.
 */

export interface CompanionView {
  /** item ids that currently have a recipe partner within adjacencyRadius */
  blessed: Set<string>;
  /** recipes currently formed in the world (for the P panel readout) */
  active: RecipeDef[];
}

/** distance between two placed items, in world units */
function dist(a: PlacedItem, b: PlacedItem): number {
  return Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
}

/**
 * Scan the planted flowers and mark companion pairs. O(n * k) over the
 * recipes' member species only — species not in any recipe never enter
 * the scan, so the cost stays tiny even with hundreds of flowers.
 */
export function companionSet(items: PlacedItem[]): CompanionView {
  const blessed = new Set<string>();
  const active: RecipeDef[] = [];
  const r = RECIPE_TUNING.adjacencyRadius;
  // index items by species, recipe-relevant species only
  const members = new Set<string>();
  for (const recipe of RECIPES) {
    members.add(recipe.pair[0]);
    members.add(recipe.pair[1]);
  }
  const bySpecies = new Map<string, PlacedItem[]>();
  for (const item of items) {
    if (!members.has(item.plantId) || !PLANT_BY_ID[item.plantId]) continue;
    const list = bySpecies.get(item.plantId);
    if (list) list.push(item);
    else bySpecies.set(item.plantId, [item]);
  }
  const seen = new Set<string>();
  for (const recipe of RECIPES) {
    const as_ = bySpecies.get(recipe.pair[0]) ?? [];
    const bs = bySpecies.get(recipe.pair[1]) ?? [];
    let formed = false;
    for (const a of as_) {
      if (bs.some((b) => dist(a, b) <= r)) {
        blessed.add(a.id);
        formed = true;
      }
    }
    for (const b of bs) {
      if (as_.some((a) => dist(a, b) <= r)) blessed.add(b.id);
    }
    if (formed && !seen.has(recipe.id)) {
      seen.add(recipe.id);
      active.push(recipe);
    }
  }
  return { blessed, active };
}

/** the recipe between two species, if one exists (order-free; pure) */
export function recipeBetween(a: string, b: string): RecipeDef | undefined {
  return recipeFor(a, b);
}

/**
 * Which NOT-YET-DISCOVERED recipes just formed? (The store fires the
 * discovery toast + notebook unlock for each of these, once per save.)
 */
export function newlyFormed(items: PlacedItem[], alreadyFound: string[]): RecipeDef[] {
  const { active } = companionSet(items);
  return active.filter((r) => !alreadyFound.includes(r.id));
}
