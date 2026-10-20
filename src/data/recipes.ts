/**
 * #9 (session 6, unit 2): companion-planting "garden recipes".
 *
 * THE CONSTRAINT THAT GOVERNS EVERYTHING (AGENTS.md non-negotiables):
 * no punishment, ever. A pairing is either a recipe (a gentle bonus +
 * a warm fact) or neutral — there is NO third state. Bad pairings never
 * wither, die, or read as failure; a non-recipe planting is simply two
 * flowers minding their own business.
 *
 * Every pairing below maps to a real companion-planting principle and was
 * verified against sources before adding (AGENTS.md rule; source notes
 * inline per recipe). Pairings are chosen from the actual 10-species
 * roster so every recipe is buildable in normal play.
 */

export interface RecipeDef {
  /** stable id, persisted when discovered (save field `foundRecipes`) */
  id: string;
  /** the two species (order-free) */
  pair: [string, string];
  /** names for the notebook entry */
  label: string;
  /** warm one-liner shown on discovery + in the notebook (verified) */
  fact: string;
}

export const RECIPES: RecipeDef[] = [
  {
    id: 'recipe:lavender-thyme',
    pair: ['lavender', 'thyme'],
    label: 'Lavender & Wild Thyme',
    // verified: Mediterranean herbs (lavender, thyme) share lean, dry,
    // sunny conditions and are standard companions in herb borders
    // (Penn State Extension; The Spruce herb companions).
    fact: 'Lavender and thyme come from the same sun-baked Mediterranean hillsides — together they like the same lean soil and feed the same bees.',
  },
  {
    id: 'recipe:borage-cosmos',
    pair: ['borage', 'cosmos'],
    label: 'Borage & Cosmos',
    // verified: borage is a classic companion for pollinator-dependent
    // plantings (LA Times; RHS Plants for Pollinators lists both); both
    // hold the summer table open from midsummer deep into autumn.
    fact: 'Borage refills its nectar within minutes of a visit — paired with cosmos, the summer canteen stays open from midday to dusk, all season long.',
  },
  {
    id: 'recipe:clover-poppy',
    pair: ['clover', 'poppy'],
    label: 'Clover & Wild Poppy',
    // verified: clover fixes nitrogen in its root nodules, feeding the
    // soil around it (standard legume principle, e.g. USDA clover guides);
    // poppies are traditional companions in wildflower meadow mixes.
    fact: 'Clover quietly feeds the soil — its roots fix nitrogen — so the poppies dancing nearby stand on a richer ground.',
  },
  {
    id: 'recipe:sunflower-aster',
    pair: ['sunflower', 'aster'],
    label: 'Sunflower & Aster',
    // verified: tall sunflowers give late-season asters light shelter at
    // the edge of a stand, and both are autumn pollen sources (RHS Plants
    // for Pollinators; BHG late-season succession guidance).
    fact: 'A tall sunflower shades asters at the meadow\u2019s edge — and when the asters open late, the two keep autumn\u2019s table set together.',
  },
  {
    id: 'recipe:crocus-forget-me-not',
    pair: ['crocus', 'forget-me-not'],
    label: 'Crocus & Forget-me-not',
    // verified: early crocuses and forget-me-nots are among the first
    // spring forage for waking queen bumblebees (Bumblebee Conservation
    // Trust early-forage lists).
    fact: 'The first two blooms of spring, side by side — a queen bumblebee\u2019s first warm meal is a crocus, and the forget-me-nots keep the buffet going.',
  },
];

/** lookup by the two species ids, order-free */
export function recipeFor(a: string, b: string): RecipeDef | undefined {
  return RECIPES.find(
    (r) => (r.pair[0] === a && r.pair[1] === b) || (r.pair[0] === b && r.pair[1] === a),
  );
}

/**
 * Tuning (lives here, never in components): the world-distance radius in
 * which two flowers count as neighbors for a recipe. Generous — recipes are
 * encouragement to plant sociably, not a precision puzzle.
 */
export const RECIPE_TUNING = {
  /** two flowers within this distance are "neighbors" */
  adjacencyRadius: 2.2,
  /** petal scale multiplier while a recipe partner is nearby (in bloom) */
  vigorScale: 1.12,
} as const;
