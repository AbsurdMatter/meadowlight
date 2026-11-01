import { SEASONS, SEASON_SECONDS, type Season } from '../data/seasons';

/**
 * #11 (session 6, unit 1): the auto-advancing season calendar.
 *
 * State-semantics rule from session 5 (the isDaylight lesson): ONE shared
 * source. This module owns "where in the year the meadow is" exactly the
 * way dayCycle.ts owns "where in the day it is" — the season dial, the
 * P panel, the save, and any season-gated behavior all read it here.
 *
 * Composition with the day clock — one time system, not two clocks: the
 * calendar is advanced from the SAME render-loop site that advances the
 * day cycle (Sky.tsx), with the same delta. The day clock is the time of
 * day; this is the date. Neither runs on wall-clock time: time advances
 * only while the page is open, so returning after hours lands the meadow
 * exactly where it was left — mid-season, never degraded, never
 * "you missed it" (AGENTS.md non-negotiable: no punishment for absence).
 *
 * Model: a position in the current season, 0..1, plus the current season
 * label. The label lives in the placement store (it always has) — this
 * module exposes seasonFor(progress, baseSeason) for the rollover check
 * so the ONE definition of "which season is next" lives here.
 *
 * Jump semantics (round-1 finding 3): selecting a season STARTS it — the
 * clock is set to that season's start and auto-advance continues from
 * there (the session-7 snap-vs-ease precedent: a jump moves the calendar,
 * never freezes it). Pausing is the TimeControls' pause button's job
 * alone: this module has no pause state, so nothing a player does can
 * silently stop the year. (The day clock keeps its setDayPhase hold —
 * that override is the P panel's, a dev-only surface; the player-facing
 * dial never touches it.)
 */

const clock = { progress: 0 };

/** progress through the current season, 0..1 (0 = season just began) */
export function seasonProgress(): number {
  return clock.progress;
}

/** the season that follows the given one (wraps winter -> spring) */
export function nextSeason(s: Season): Season {
  const i = SEASONS.indexOf(s);
  return SEASONS[(i + 1) % SEASONS.length];
}

/**
 * Advance the calendar by deltaSeconds. Pure bookkeeping; the rollover
 * (progress passing 1.0) is reported so the caller can update the store's
 * season label and fire the gentle season toast — the clock itself never
 * touches UI or the store (engine/render separation).
 *
 * Returns the seasons crossed (0, 1, or — for a huge delta — more; tests
 * use this to drive fast-forward deterministically).
 */
export function advanceSeasons(deltaSeconds: number, currentSeason: Season): Season[] {
  if (deltaSeconds <= 0) return [];
  clock.progress += deltaSeconds / SEASON_SECONDS;
  const crossed: Season[] = [];
  let s = currentSeason;
  while (clock.progress >= 1) {
    clock.progress -= 1;
    s = nextSeason(s);
    crossed.push(s);
  }
  return crossed;
}

/**
 * Manual dial / P panel: START the given season — the calendar jumps to
 * that season's beginning (progress 0) and keeps drifting from there
 * (round-1 finding 3: a season jump never stops progression; the only
 * pause is the TimeControls button). The saved seasonProgress always
 * reflects the live position, so a save written after a jump resumes
 * exactly there — never corrupts.
 */
export function startSeasonAt(_season: Season): void {
  clock.progress = 0;
}

/** tests: set the raw progress directly (boundary cases; never ships to UI) */
export function setSeasonProgressForTest(p: number): void {
  clock.progress = Math.max(0, Math.min(1, p));
}
