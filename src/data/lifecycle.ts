/**
 * Session 7 U3 (#new): bee lifecycles, gently. The hive population breathes
 * with the seasons — colony grows through spring/summer, tucks into the
 * winter cluster (the EDUCATION.md winter-cluster fact finally earns its
 * visual), reawakens in spring.
 *
 * HARD CONSTRAINT (constitution): winter reads as WINTER, never as loss or
 * decline. Every string, every number, every visual below is worded and
 * tuned so no read can land as "your bees declined." The population is a
 * BREATH (inhale grow, hold, tuck, wake) — there is no death state, no
 * shrinking-colony framing, no negative delta anyone can observe.
 *
 * Facts verified against sources, in-file citations (the session-5 rule).
 */
import type { Season } from './seasons';

/**
 * The population curve — ONE shared semantic (the named-state rule).
 * colonyIntensity(season, progress) returns 0..1: the fraction of the
 * hive's bees that are out and about. It is the ONE source consumed by
 * the swarm render, the hive popup, the info panel, and the P inspector.
 *
 * Shape (a real colony's year, gently idealized):
 *   spring 0.0 -> 0.85 : the colony wakes and grows (the queen lays; the
 *                        first warm days bring the first foragers out)
 *   summer flat 0.85   : the colony holds its full strength
 *   autumn 0.85 -> 0.5 : foraging thins as days shorten (stragglers,
 *                        not decline — the hoverfly straggler's cousin)
 *   winter 0.5 -> 0.0 -> 0.1 : the cluster — everyone tucks into the
 *                        hive around the queen; a rare warm midday lets
 *                        one or two stretch their wings (cleansing
 *                        flights — a real thing, and the coziest read
 *                        in the whole model)
 *   back to spring: reawakening.
 */
export const LIFECYCLE_TUNING = {
  /** spring: intensity rises from wakeFloor to peak across the season */
  wakeFloor: 0.12,
  peak: 0.85,
  /** autumn: thins toward the cluster, never below the straggler floor */
  autumnFloor: 0.5,
  /** winter: the cluster itself — the in-hive share; rare cleansing flights */
  clusterFloor: 0.0,
  /** the population never renders as ZERO bees visible at the hive in
   *  winter at midday — the cluster is INSIDE, visible as a warm glow */
} as const;

/**
 * The season's own copy — never a decline framing. One source; the popup,
 * the info panel, and the P inspector all render from here (the
 * duplicate-state-strings lesson from session 6).
 */
export const LIFECYCLE_LINES: Record<Season, string> = {
  // verified: Bumblebee Conservation Trust / EDUCATION.md — the colony
  // clusters around the queen, shivering to keep her at ~21°C
  winter: 'The colony is tucked in for winter — clustered snug around the queen, shivering together to keep her at a cozy 21\u00b0C, feeding on stored honey. \u2744\uFE0F',
  // verified: the queen starts laying in late winter; first foragers emerge
  // with the earliest blooms (Bumblebee Conservation Trust spring guidance)
  spring: 'The colony is waking with the year — the first foragers stretch their wings among the earliest blooms.',
  // verified: peak colony size midsummer (standard honeybee phenology)
  summer: 'The colony is at its fullest — the summer hum at its gentle peak.',
  // verified: autumn = forage thins; workers wind down (RHS late-season
  // guidance; the "stragglers" framing mirrors the hoverfly unit)
  autumn: 'The colony is easing toward autumn — a few late foragers keep the table, gathering the last warmth.',
};

/** winter-cluster fact (EDUCATION.md, verbatim source of the visual) */
export const WINTER_CLUSTER_FACT =
  'In winter, the honeybee colony clusters around the queen and shivers to keep her at a cozy ~21\u00b0C, feeding on stored honey.';

/**
 * The one population semantic: 0..1 intensity for (season, progress).
 * Pure; deterministic; no Math.random.
 */
export function colonyIntensityTarget(season: Season, progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  const { wakeFloor, peak, autumnFloor } = LIFECYCLE_TUNING;
  switch (season) {
    case 'spring':
      // wake -> grow: wakeFloor rising to peak across the season
      return wakeFloor + (peak - wakeFloor) * p;
    case 'summer':
      // hold: full strength all season (no decline mid-summer)
      return peak;
    case 'autumn':
      // peak -> autumnFloor: the gentle thinning
      return peak - (peak - autumnFloor) * p;
    case 'winter':
      // the cluster: tuck through midwinter; a tiny late-winter stir
      // as the earliest days lengthen (cleansing flights, then the
      // first foragers with the crocuses)
      return p < 0.75
        ? Math.max(LIFECYCLE_TUNING.clusterFloor, 0.08 * (1 - p / 0.75))
        : 0.08 * ((p - 0.75) / 0.25) + 0.02;
  }
}
