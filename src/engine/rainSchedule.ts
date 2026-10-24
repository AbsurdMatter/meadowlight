/**
 * Session 8 N1: natural, seasonally-weighted precipitation — the ONE
 * schedule source (round 2, PR #38 comment #6299401525 directives).
 *
 * Design (binding, user verdicts):
 * - BINARY on/off — never a weighted intensity. What changes with the
 *   season is the season's rain BEHAVIOR (how often, how long), not a dial.
 * - Windows are SEEDED PSEUDO-RANDOM WITHIN each season, weighted by
 *   season: spring/fall frequent rain, summer rare rain, winter = SNOW
 *   (decided). They are NOT coupled to season transitions — rain may start
 *   or end any time mid-season, and a boundary crossing never resets or
 *   silences the weather ("rain stopped with the season change" was the bug
 *   report against that design).
 * - Determinism the session-7 way: every window derives from the ONE
 *   shared seeded hash (engine/seededHash) keyed on (worldSeed,
 *   seasonOrdinal) — same world, same weather calendar, replays
 *   identically across reloads and machines; reads as weather on screen.
 * - Season ordinal, not season label: the weather calendar must not repeat
 *   every year box-fresh — the store's season label wraps, so the ordinal
 *   rides the store's own rollover count (seedingEpoch advances on every
 *   season boundary from the ONE season-advance site, one source rule).
 * - Observability (the 8x rule): weights are tuned so one accelerated
 *   year visibly rains several times in spring/fall and snows in winter —
 *   weather that can't be observed in a session is a bug, not subtlety.
 * - State changes on window arrival/departure are FAST (a settle constant,
 *   tuned here) — not the colony's slow ease; precipitation switches read
 *   as weather turning, not as a gradient.
 * - The P panel is READBACK ONLY: current state + upcoming window ETA
 *   (forecastWeather()). No input path exists for precipitation — gates
 *   drive the season (force-able) and let the weather derive.
 */
import { hash2 } from './seededHash';
import type { Season } from '../data/seasons';
import { PRECIP_TUNING } from '../data/rain';
import { seasonProgress } from './seasonClock';

/** a precipitation window on the season's 0..1 progress axis */
export interface PrecipWindow {
  /** inclusive start, season progress 0..1 */
  start: number;
  /** exclusive end, season progress 0..1 (may exceed 1: spills into next season) */
  end: number;
  /** what falls during this window ('rain' | 'snow') */
  kind: 'rain' | 'snow';
}

/** the live verdict: what is falling right now, or null = dry */
export interface PrecipNow {
  kind: 'rain' | 'snow';
  /** 0..1 how far into the current window's settle (1 = fully on) */
  intensity: number;
}

/**
 * The season's weather calendar: deterministic from (worldSeed, ordinal).
 * Windows sit on the 0..1 season-progress axis; a window's end may exceed 1
 * (it spills across the boundary — the no-reset-at-boundaries rule made
 * structural: a storm in progress at the rollover keeps falling).
 */
export function seasonWindows(worldSeed: number, ordinal: number, season: Season): PrecipWindow[] {
  const w = PRECIP_TUNING.windows[season];
  const out: PrecipWindow[] = [];
  let p = 0;
  let i = 0;
  while (p < 1) {
    // gap to this window's start, then its length — both hash draws from
    // (worldSeed, ordinal, window index): the calendar is fixed per season
    const gap = hash2(worldSeed * 2654435761 ^ ordinal * 40503, i * 2, 9101 + SEASON_SALT[season]);
    const len = hash2(worldSeed * 2654435761 ^ ordinal * 40503, i * 2 + 1, 9201 + SEASON_SALT[season]);
    const start = p + gap * w.gapScale;
    if (start >= 1) break;
    const end = Math.min(1 + PRECIP_TUNING.spill, start + w.lenScaleMin + len * (w.lenScaleMax - w.lenScaleMin));
    if (end <= start) break;
    out.push({ start, end, kind: w.kind });
    p = end;
    i++;
    if (i > 24) break;
  }
  return out;
}

/** which window (if any) covers progress p, treating spill as live past 1 */
function windowAt(windows: PrecipWindow[], p: number): PrecipWindow | null {
  for (const win of windows) {
    if (p >= win.start && p < win.end) return win;
  }
  return null;
}

/**
 * The upcoming window strictly after p (forecast): null when none remains
 * this season — the caller renders "dry through the season's end".
 */
export function nextWindowAfter(windows: PrecipWindow[], p: number): PrecipWindow | null {
  let best: PrecipWindow | null = null;
  for (const win of windows) {
    if (win.start > p && (!best || win.start < best.start)) best = win;
  }
  return best;
}

/** per-season hash salt — stable across reloads (part of the world's weather) */
const SEASON_SALT: Record<Season, number> = {
  spring: 1,
  summer: 2,
  autumn: 3,
  winter: 4,
};

/** the live schedule state (engine-side; render reads precipitationNow()) */
const schedule = {
  worldSeed: 0,
  ordinal: 0,
  season: 'spring' as Season,
  current: null as PrecipWindow | null,
  next: null as PrecipWindow | null,
  windows: [] as PrecipWindow[],
  intensity: 0,
};

/**
 * Point the schedule at the world's (seed, ordinal, season) and evaluate the
 * verdict for the season clock's CURRENT progress. Called from Sky's single
 * time site each frame — cheap (a table walk), pure, no store writes.
 */
export function tickPrecipSchedule(worldSeed: number, ordinal: number, season: Season): void {
  const p = seasonProgress();
  if (
    schedule.worldSeed !== worldSeed ||
    schedule.ordinal !== ordinal ||
    schedule.season !== season ||
    schedule.windows.length === 0
  ) {
    schedule.worldSeed = worldSeed;
    schedule.ordinal = ordinal;
    schedule.season = season;
    schedule.windows = seasonWindows(worldSeed, ordinal, season);
  }
  schedule.current = windowAt(schedule.windows, p);
  schedule.next = nextWindowAfter(schedule.windows, p);
  // FAST settle on arrival/departure (binding directive 4): the intensity
  // ramps over PRECIP_TUNING.settleSeconds of SCALED time — pause holds it
  // mid-settle (scaled dt = 0), 8x finishes it 8x faster. Never the slow
  // colony ease: weather turns, it doesn't fade.
  const target = schedule.current ? 1 : 0;
  const step = tickAccumulate();
  if (step > 0) {
    const rise = step / PRECIP_TUNING.settleSeconds;
    schedule.intensity = Math.max(0, Math.min(1, schedule.intensity + (target > schedule.intensity ? rise : -rise)));
  }
}

/** the frame's scaled delta — injected so the module stays engine-pure */
let deltaSource: () => number = () => 0;
export function setPrecipDeltaSource(fn: () => number): void {
  deltaSource = fn;
}
function tickAccumulate(): number {
  return deltaSource();
}

/**
 * The live verdict: what is falling NOW (null = dry). The settle never
 * masks the state: kind flips at the window edge; intensity carries only
 * the visual settle.
 */
export function precipitationNow(): PrecipNow | null {
  if (!schedule.current || schedule.intensity <= 0) return null;
  return { kind: schedule.current.kind, intensity: schedule.intensity };
}

/** the kind currently falling, for consumers that only need on/off */
export function isPrecipitating(): boolean {
  if (testForced !== null) return testForced;
  return schedule.current !== null;
}

/** tests/gates: the natural verdict WITHOUT any override (readback parity) */
export function precipReadback(): {
  current: PrecipWindow | null;
  next: PrecipWindow | null;
  intensity: number;
  ordinal: number;
} {
  return {
    current: schedule.current,
    next: schedule.next,
    intensity: schedule.intensity,
    ordinal: schedule.ordinal,
  };
}

/**
 * Unit tests ONLY: the no-fail invariant test needs a precipitating state
 * without a live store/render loop (the appeal module reads isRaining()).
 * NOT a game input path — nothing outside tests calls it (the P panel is
 * readback-only by binding directive).
 */
let testForced: boolean | null = null;
export function setPrecipitatingForTest(v: boolean): void {
  testForced = v;
}

/** tests/gates: drive the schedule directly (same tick, no render loop) */
export function tickPrecipScheduleForTest(worldSeed: number, ordinal: number, season: Season): void {
  tickPrecipSchedule(worldSeed, ordinal, season);
}
