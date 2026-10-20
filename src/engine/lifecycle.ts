/**
 * Session 7 U3: the live colony-breath state — ONE shared population
 * semantic (engine side of data/lifecycle.ts).
 *
 * The target intensity comes from colonyIntensityTarget (pure, per
 * season/progress); this module holds the LIVE smoothed value so the
 * population breathes gradually (never a visible jump at a season
 * boundary — a step-change in bee count is exactly the read the
 * constitution forbids: it would land as sudden loss or sudden gain).
 *
 * One source: the swarm render, the hive popup, the info panel, and the
 * P inspector all read colonyIntensity() from here. Nothing else may
 * hold a population number.
 */
import { colonyIntensityTarget, LIFECYCLE_LINES } from '../data/lifecycle';
import type { Season } from '../data/seasons';

const live = { intensity: 0.5 };

/** the live (smoothed) colony intensity, 0..1 */
export function colonyIntensity(): number {
  return live.intensity;
}

/**
 * Advance the breath toward the season's target. Called from the same
 * frame loop site the honey fill uses (BeeSwarm's update), with the SAME
 * scaled dt — the colony breathes with world time (frozen under pause).
 */
export function advanceColony(season: Season, progress: number, deltaSeconds: number): void {
  const target = colonyIntensityTarget(season, progress);
  if (deltaSeconds <= 0) return;
  // ease toward the target: gentle, ~half the gap per ~2.5s of world time
  const k = Math.min(1, deltaSeconds / 2.5);
  live.intensity += (target - live.intensity) * k;
}

/**
 * The one readback for UI surfaces: the season's line + the live
 * intensity + the target — the popup, panel, and P inspector render
 * from this single object (the duplicate-state-strings lesson).
 */
export function colonyReadback(season: Season, progress: number): {
  line: string;
  intensity: number;
  target: number;
} {
  return {
    line: LIFECYCLE_LINES[season],
    intensity: colonyIntensity(),
    target: colonyIntensityTarget(season, progress),
  };
}

/** tests: set the live value directly */
export function setColonyIntensityForTest(v: number): void {
  live.intensity = Math.max(0, Math.min(1, v));
}
