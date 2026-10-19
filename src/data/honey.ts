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
  /** harvest leaves the comb at this fill (residents, not machines) */
  afterHarvest: 0.35,
  /**
   * glow palette: comb color lerps from floor (settling in — warm but
   * calm) to full (deep honey gold, gently luminous). Both ends warm;
   * NOTHING may read dim/sad. The hive's own part colors sit between.
   */
  combColorFloor: '#d9a95f',
  combColorFull: '#f2b431',
  /** harvest ceremony: dip depth (world units) and duration (seconds) */
  harvestDip: 0.35,
  harvestDipSeconds: 0.9,
} as const;

/** seasons the hive actively forages (mirrors BEE_TUNING.foragingSeasons) */
export const HONEY_FORAGING_SEASONS: Season[] = ['spring', 'summer', 'autumn'];

/** EDUCATION.md: "Honeybee workers visit 50-100 flowers per foraging trip,
 *  and a colony can visit millions of flowers in a year." */
export const HONEY_FACTS = {
  harvest: 'Honeybee workers visit 50\u2013100 flowers on every foraging trip \u2014 this jar holds a whole season of those visits, millions of flowers\u2019 worth.',
  filling: 'Bees turn nectar into honey by fanning it with their wings until it thickens \u2014 every drop in the comb is a summer\u2019s work, kept for the winter cluster.',
} as const;
