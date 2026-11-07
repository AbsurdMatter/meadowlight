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
 * Shape (a real colony's year, gently idealized) — the bee-year curve (#87):
 *   spring wakeFloor -> peak : the colony wakes and rebuilds to FULL summer
 *                        strength by season's end (the queen ramps up to
 *                        ~1,500–2,000 eggs a day in the spring build-up —
 *                        EDUCATION.md); springShape 1 = steady ramp,
 *                        2 = rushing (ease-out: the year's most active
 *                        growth early in the season)
 *   summer flat peak   : the colony holds its full strength (plateau)
 *   autumn peak -> autumnFloor : foraging thins as days shorten (stragglers,
 *                        not decline — the hoverfly straggler's cousin)
 *   winter winterFloor (+ a small late-winter stir) : the LIVING cluster —
 *                        a visible share stays out around the hive all
 *                        winter, never a die-off (the cozy-winter
 *                        non-negotiable); late winter stirs as the earliest
 *                        days lengthen (cleansing flights, then the first
 *                        foragers with the crocuses)
 *   back to spring: reawakening.
 */
export const LIFECYCLE_TUNING = {
  /** spring: intensity rises from wakeFloor to peak across the season */
  wakeFloor: 0.35,
  peak: 0.9,
  /** spring ramp shape: 1 = steady (linear), 2 = rushing (ease-out) */
  springShape: 2,
  /** autumn: thins toward the cluster, never below the straggler floor */
  autumnFloor: 0.55,
  /** winter: the cluster itself — a LIVING visible share, never die-off */
  winterFloor: 0.45,
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
  const { wakeFloor, peak, autumnFloor, winterFloor, springShape } = LIFECYCLE_TUNING;
  switch (season) {
    case 'spring': {
      // wake -> grow to FULL strength by season's end; springShape shapes
      // the ramp (1 = steady, 2 = rushing ease-out) — the year's steepest
      // growth is spring either way
      const e = 1 - Math.pow(1 - p, springShape);
      return wakeFloor + (peak - wakeFloor) * e;
    }
    case 'summer':
      // hold: full strength all season (plateau, no mid-summer decline)
      return peak;
    case 'autumn':
      // peak -> autumnFloor: the gentle thinning
      return peak - (peak - autumnFloor) * p;
    case 'winter':
      // the LIVING cluster: a visible share all winter (never die-off);
      // a small late-winter stir as the earliest days lengthen
      // (cleansing flights, then the first foragers with the crocuses)
      return p < 0.75
        ? winterFloor + 0.05 * (1 - p / 0.75)
        : winterFloor + 0.05 + 0.05 * ((p - 0.75) / 0.25);
  }
}
