import { HONEY_TUNING, HONEY_FORAGING_SEASONS } from '../data/honey';
import type { Season } from '../data/seasons';

/**
 * #10 (session 6, unit 3): honey comb fill — pure math, testable.
 *
 * ONE SHARED SOURCE: the hive's comb is a single fill value 0..1 per hive
 * (persisted in save v6 as hiveCombs[hiveId]). The glow renderer, the
 * harvest interaction, the P panel, and the save all read this module —
 * never a second derivation.
 *
 * NO PRESSURE, EVER: fill only ever INCREASES during play (except the
 * harvest's intentional partial reset). There is no decay, no spoilage,
 * no quota, no season penalty. An empty meadow still fills slowly — the
 * bees are residents keeping their own pantry, not machines.
 */

/** advance one hive's comb fill by deltaSeconds, given its bees' state.
 * Pure: the caller owns the stored value.
 *
 * Real principle (DESIGN.md / EDUCATION.md): a colony visits flowers at
 * its own rhythm — foraging effort in daylight during foraging seasons,
 * scaled by local appeal (the same computeAppeal number the bee count
 * uses; passed in here to keep this module pure and engine-side).
 */
export function advanceComb(
  fill: number,
  deltaSeconds: number,
  foragingBees: number,
  appeal: number,
  season: Season,
  daylight: boolean,
): number {
  const capped = Math.min(1, Math.max(0, fill));
  if (capped >= 1) return 1;
  const active =
    daylight && HONEY_FORAGING_SEASONS.includes(season) && foragingBees > 0;
  if (!active) {
    // an empty/quiet hive still trickles — residents, their own rhythm
    return Math.min(1, capped + HONEY_TUNING.idleFillPerSecond * deltaSeconds);
  }
  const scaled = foragingBees * (0.4 + 0.6 * Math.min(1, Math.max(0, appeal)));
  return Math.min(
    1,
    capped + HONEY_TUNING.fillPerForagingSecond * scaled * deltaSeconds,
  );
}

/** true when the comb is full and a harvest would give a jar — the ONE
 * shared fullness predicate (popup state line, harvest path, P panel,
 * gate all call this); epsilon from tuning, perceptual not float-sized */
export function combReady(fill: number): boolean {
  return fill >= HONEY_TUNING.fullAt - HONEY_TUNING.fullEpsilon;
}

/** the fill after a harvest — partial, never zero (residents, not machines) */
export function fillAfterHarvest(): number {
  return HONEY_TUNING.afterHarvest;
}
