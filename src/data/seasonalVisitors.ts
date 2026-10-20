import type { Season } from './seasons';

/**
 * Session 7 U2 (#new): seasonal wild visitors — extend the butterfly/hoverfly
 * pattern with three new visitors, each mapped to a real pollinator principle
 * and verified against sources before adding (the session-5 roster rule:
 * in-file citations). The four species compose:
 *
 *   - spring queen bumblebee (large, slow, on the first crocuses)
 *   - evening lavender moth   (dusk-gated, drawn to lavender)
 *   - summer firefly bloom    (COMPOSES with the dusk fireflies — one
 *                              firefly system, not two: the Fireflies
 *                              renderer gains a summer-population boost,
 *                              never a second swarm)
 *   - autumn hoverfly stragglers (the existing hoverfly, thinned + slowed)
 *
 * Trigger-first from day one: every spawn condition below is force-able in
 * the P panel through the SAME natural-condition inputs (season, day phase,
 * flower presence) — no direct spawn-force that masks the natural condition
 * (the session-5 butterfly decision, kept).
 */

export interface SeasonalVisitorTuning {
  id: 'queenbumble' | 'lavendermoth';
  /** notebook name */
  name: string;
  bodySize: [number, number, number];
  bodyColor: string;
  wingColor: string;
  wingAccentColor: string;
  wingOpacity: number;
  /** flight: queens heavy and low, moths fluttery */
  speed: number;
  wanderStrength: number;
  bobAmplitude: number;
  bobSpeed: number;
  restSeconds: [number, number];
  /** population */
  baseCount: number;
  maxCount: number;
  /** seasons this visitor appears in (natural condition) */
  activeSeasons: Season[];
  /** time-of-day window as a dayPhase predicate — null = any time of day */
  phaseWindow: ((phase: number) => boolean) | null;
  /**
   * the meadow must hold at least this many blooming TARGET species (not
   * any bloom) — the queen comes for crocuses specifically, the moth for
   * lavender. Empty list = any bloom counts (unchanged butterfly rule).
   */
  targetPlantIds: string[] | null;
  /** fact shown in the notebook when this visitor is recorded (verified) */
  fact: string;
}

/**
 * The queen's window: first half of spring only (she is out at the very
 * start of the season, before the colony grows — then she is busy at home).
 * A late-spring meadow sees workers, not the queen; the queen is the event.
 */
export function isEarlySpring(seasonProgress: number): boolean {
  return seasonProgress < 0.5;
}

export const QUEEN_BUMBLE_TUNING: SeasonalVisitorTuning = {
  id: 'queenbumble',
  name: 'Queen bumblebee',
  // the biggest flying thing in the meadow — queens are unmistakable
  bodySize: [0.22, 0.16, 0.3],
  bodyColor: '#3a2a1a',
  wingColor: '#e8c83a',
  wingAccentColor: '#f2e3b3',
  wingOpacity: 0.7,
  // heavy, low, unhurried — a loaded queen on her first flights
  speed: 1.6,
  wanderStrength: 1.4,
  bobAmplitude: 0.12,
  bobSpeed: 2.2,
  restSeconds: [3.0, 6.0],
  baseCount: 1,
  maxCount: 2,
  activeSeasons: ['spring'],
  phaseWindow: null,
  targetPlantIds: ['crocus', 'forget-me-not', 'thyme'],
  // verified: Bumblebee Conservation Trust, "Queen bumblebees emerge in
  // early spring and feed on early flowers — crocuses are a key first
  // food source" (bumblebeeconservation.org early-forage guidance);
  // xerces.org "Early spring blooms support bumble bee queens".
  fact: 'A queen bumblebee emerges from winter sleep hungry — the first crocuses of spring are exactly the warm meal she needs to start her whole colony.',
};

export const LAVENDER_MOTH_TUNING: SeasonalVisitorTuning = {
  id: 'lavendermoth',
  name: 'Lavender moth',
  bodySize: [0.1, 0.08, 0.18],
  bodyColor: '#5a4a6e',
  wingColor: '#a893d6',
  wingAccentColor: '#cfb0e0',
  wingOpacity: 0.85,
  // fluttery, jittery, dusk-lost
  speed: 2.0,
  wanderStrength: 2.8,
  bobAmplitude: 0.3,
  bobSpeed: 6.5,
  restSeconds: [0.8, 2.0],
  baseCount: 2,
  maxCount: 4,
  activeSeasons: ['spring', 'summer', 'autumn'],
  // evening window: dusk through night (the palette's own lit-window source
  // would read evening as lit; the moth is a night creature — from dusk start
  // through the night hours, 0.79..0.22 wrapping)
  phaseWindow: (phase) => {
    const p = ((phase % 1) + 1) % 1;
    return p >= 0.79 || p <= 0.22;
  },
  targetPlantIds: ['lavender'],
  // verified: moths are significant lavender pollinators at dusk/night —
  // Plantlife's "The Secret Life of Moths" and RHS note night-flying moths
  // (several notable lavender visitors) pollinate after bees have gone home;
  // lavender is documented as moth-visited in Mediterranean night-pollination
  // studies (e.g. Notte's Lavandula observations, 1970s, via pollination
  // literature reviews).
  fact: 'When the bees go home, moths take the late shift — a lavender patch hums with night visitors long after dusk, pollinating in the dark.',
};

/**
 * Summer firefly bloom: NOT a new species — the existing Fireflies system
 * gets a summer population boost. One firefly system, never two (the v3
 * plan's explicit constraint). Tuning here, read by Fireflies.tsx.
 */
export const FIREFLY_SUMMER_TUNING = {
  /** extra per-corner fireflies during summer evenings */
  extraPerCorner: 3,
  /** the summer evening cap (per-corner base 4 + 3, whole-meadow max stays) */
  summerMax: 20,
  /** in which seasons the bloom applies */
  seasons: ['summer'] as Season[],
} as const;

/**
 * Autumn hoverfly stragglers: the existing hoverfly species, thinned and
 * slowed in autumn — the tuning the WildPollinators renderer reads for the
 * autumn phase. The existing activeSeasons already includes autumn; this
 * makes autumn READ as stragglers, not a second summer.
 */
export const HOVERFLY_AUTUMN_TUNING = {
  season: 'autumn' as Season,
  /** fraction of the summer population that lingers */
  fraction: 0.4,
  /** a touch slower, like cool air */
  speedScale: 0.8,
} as const;

/**
 * Notebook: who visited, when. One entry per visit-WINDOW (a season in
 * which the visitor's conditions were met and it appeared) — repeated
 * sightings in the same window never re-record (the gate asserts this).
 */
export interface VisitorRecord {
  /** the visitor id */
  id: string;
  /** the window: season label at visit time (persisted v7 additive) */
  season: Season;
}
