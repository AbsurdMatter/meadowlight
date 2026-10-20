import type { Season } from './seasons';

/**
 * #10 (session 6, unit 3): honey — the hive fills, patience is rewarded.
 *
 * DESIGN (approved): observation-and-reward, no economy.
 *  - The comb fills from REAL observed foraging effort: hive bees
 *    foraging in daylight, in a foraging season, scaled by local appeal
 *    (the same computeAppeal the bee count uses). No timer, no quota —
 *    an empty meadow still fills, very slowly (real colonies visit
 *    flowers at their own rhythm; forcing production kills — DESIGN.md).
 *  - Visible as the hive's honey parts warming/brightening with fill.
 *    An empty comb must read as "settling in," never "hungry" — the
 *    floor tint keeps even a fresh hive warm and lively.
 *  - Click a full hive -> a jar, recorded in the notebook and on the
 *    postcard ("jars of honey brought in" — warm numbers, not scores).
 *    Harvesting resets the comb to a partial fill (never zero — the
 *    bees are residents, not machines) with a small ceremony: the hive
 *    dips and settles, the jar arrives with a toast carrying a real
 *    EDUCATION.md fact.
 *
 * All facts shown come from EDUCATION.md (source notes inline below).
 */

export const HONEY_TUNING = {
  /** fill gained per second per actively-foraging bee at appeal 1.0 */
  fillPerForagingSecond: 0.0022,
  /** an empty meadow still trickles in — bees fly at their own rhythm */
  idleFillPerSecond: 0.00025,
  /** fill level at which the comb reads "full" and can be harvested */
  fullAt: 1,
  /**
   * fullness epsilon (the isDaylight boundary lesson): a comb within
   * this of fullAt IS full — 0.9999 reads brimming and harvestable.
   * ONE shared tolerance, consumed by combReady (popup + harvest path
   * + gate all read the same predicate).
   */
  fullEpsilon: 1e-4,
  /** harvest leaves the comb at this fill (residents, not machines) */
  afterHarvest: 0.35,
  /**
   * COMB-AS-FILLING-JAR (user retune verdict: the first glow was barely
   * visible — a few voxels slightly lighter is not a whole-hive signal).
   * The mechanism: the hive's two honey bands GROW with fill — at 0 they
   * are warm-but-quiet thin cores (empty-end must still read "settling
   * in", never sad), and they swell to the full band size as the comb
   * fills, while the color saturates from floor amber to deep honey
   * gold. Fill reads at a glance: MORE honey-colored voxel + STRONGER
   * color, across the whole hive silhouette.
   */
  combColorFloor: '#d9a95f',
  combColorFull: '#f2a41c',
  /** honey-band scale at fill 0 (the thin settling-in core) and at 1 (full band) */
  combScaleFloor: 0.45,
  combScaleFull: 1.18,
  /** which hive part indices are the comb bands (structures.ts order) */
  combPartIndices: [2, 4] as number[],
  /** harvest ceremony: dip depth (world units) and duration (seconds) */
  harvestDip: 0.35,
  harvestDipSeconds: 0.9,
} as const;

/** seasons the hive actively forages (mirrors BEE_TUNING.foragingSeasons) */
export const HONEY_FORAGING_SEASONS: Season[] = ['spring', 'summer', 'autumn'];

/** EDUCATION.md: "Honeybee workers visit 50-100 flowers per foraging trip,
 *  and a colony can visit millions of flowers in a year." */
/**
 * #36 (eyeball round 5): the ONE shared fill-state read — the popup's
 * state line, the harvest button's enabled state, the harvest action,
 * AND the info panel's hive hint all call these (the isDaylight lesson:
 * no second definition of "full" anywhere). combReady lives in
 * engine/honey.ts and consumes the same tuning; the state LINE lives
 * here beside the copy it renders.
 */
export function combStateLine(fill: number): string {
  if (fill >= 1 - 1e-4) return 'The comb is full and heavy — golden to the brim. \u{1F36B}';
  if (fill > 0.5) return 'The comb is filling — you can see it warming through the straw.';
  return 'The colony is settling in; the first drops of the season are already in the comb.';
}

export const HONEY_FACTS = {
  harvest: 'Honeybee workers visit 50\u2013100 flowers on every foraging trip \u2014 this jar holds a whole season of those visits, millions of flowers\u2019 worth.',
  filling: 'Bees turn nectar into honey by fanning it with their wings until it thickens \u2014 every drop in the comb is a summer\u2019s work, kept for the winter cluster.',
} as const;
