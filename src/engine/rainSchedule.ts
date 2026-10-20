/**
 * Session 8 N1: natural, seasonally-weighted rain — the ONE schedule source.
 *
 * Before this module the only rain trigger was the P harness (session-5
 * trigger suite; the panel button itself said "no natural rain trigger
 * exists yet"). N1 closes that: rain arrives ON ITS OWN in deterministic
 * season-weighted windows — winter most, summer least, never purely random.
 *
 * One-source rules honored:
 * - Determinism: every roll derives from the ONE shared seeded-hash source
 *   (engine/seededHash) keyed on the world's named seed state — the same
 *   world weathers the same across reloads and machines, no Math.random.
 * - Time: the calendar advances ONLY from Sky's single time site; this
 *   schedule advances from that same site (Sky calls tickRainSchedule with
 *   the same scaled delta), so pause fully freezes rain planning too and
 *   the 1x-8x multiplier scales rain windows with everything else. Rain
 *   MOTION stays on the animation clock (Rain.tsx reads scaledDelta), so
 *   pause holds the whole storm, not just its schedule.
 * - Weather state: isRaining() (engine/weather) stays the ONE boolean every
 *   consumer reads (bees home, glisten, audio hush, the Rain renderer).
 *   The P-panel rain ON/OFF stays a manual OVERRIDE on top of the natural
 *   schedule — trigger-first: forcing the conditions never masks them.
 *
 * Model: the year is a fixed, per-world ladder of weather SPELLS derived
 * entirely from (worldSeed, season-index-within-year) — a spell is a
 * season-anchored chance-of-rain curve, not scattered rolls, so "seasonally
 * weighted" is structural (the season's weight IS the spell's expected wet
 * share), never a per-frame coin flip.
 */
import { hash2 } from './seededHash';
import type { Season } from '../data/seasons';
import { RAIN_SCHEDULE_TUNING } from '../data/rain';
import { seasonProgress } from './seasonClock';

/** the natural-schedule state (engine-side; render reads isRaining()) */
const schedule = { raining: false };

/** the P-panel trigger-suite override: null = natural schedule drives */
let manualOverride: { value: boolean } | null = null;

/** P harness / tests: force rain on/off, masking the natural schedule */
export function setManualRain(v: boolean): void {
  manualOverride = { value: v };
}

/** P harness / tests: release the override — the natural schedule drives again */
export function clearManualRain(): void {
  manualOverride = null;
}

/** tests/gates: read the override back (asserts the natural path resumes) */
export function rainManualOverride(): { value: boolean } | null {
  return manualOverride;
}

/** tests/gates: the natural schedule's own verdict, ignoring any override */
export function naturalRainNow(): boolean {
  return schedule.raining;
}

/** the season-weighted chance-of-rain at a point in a season, 0..1 */
function wetChance(season: Season, p: number): number {
  const w = RAIN_SCHEDULE_TUNING.wetShare[season];
  // ease in over the first tenth, hold, ease out over the last tenth:
  // rain never steps at a season boundary (the no-step-at-boundaries rule)
  const ramp = RAIN_SCHEDULE_TUNING.edgeEase;
  const eased = Math.min(1, Math.min(p, 1 - p) / ramp);
  return w * eased;
}

/**
 * Advance the schedule by deltaSeconds (the SAME scaled delta Sky advances
 * the day/season clocks with — call it from that one site only).
 * Pure: throws no errors, makes no store calls.
 */
export function tickRainSchedule(
  deltaSeconds: number,
  season: Season,
  worldSeed: number,
): void {
  if (deltaSeconds <= 0) return;
  const p = seasonProgress();
  const chance = wetChance(season, p);
  // one deterministic sample of the season's spell: the (worldSeed, season,
  // progress-quantum) hash decides wet/dry for this quantum — coarse enough
  // to hold a window for seconds of real time, fine enough to vary the spell.
  const quantum = RAIN_SCHEDULE_TUNING.quantum;
  const q = Math.floor(p * quantum);
  const roll = hash2(worldSeed * 2654435761, q, SEASON_SALT[season]);
  schedule.raining = roll < chance;
}

/**
 * The ONE resolver consumers read: natural schedule OR manual override —
 * but never both (the override masks the natural state while it holds,
 * trigger-first; releasing it drops back to the schedule with no step:
 * isRaining() re-evaluates from the schedule next tick).
 */
export function resolveNaturalRain(): boolean {
  if (manualOverride) return manualOverride.value;
  return schedule.raining;
}

/** gates: drive the schedule directly (the same tick Sky calls, no render loop) */
export function tickRainScheduleForTest(
  deltaSeconds: number,
  season: Season,
  worldSeed: number,
): void {
  tickRainSchedule(deltaSeconds, season, worldSeed);
}

/** per-season hash salt — stable across reloads (part of the world's weather) */
const SEASON_SALT: Record<Season, number> = {
  spring: 4101,
  summer: 4102,
  autumn: 4103,
  winter: 4104,
};
