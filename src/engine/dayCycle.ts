/**
 * Time-of-day model (session 5, #6/#13 groundwork). Pure module: the day
 * cycle is a single 0..1 phase the whole scene can read. U4's sky/fog/light
 * grade with it now (fixed at GOLDEN_HOUR until U6 drives it live).
 *
 * Phase convention (one full day = 1.0):
 *   0.00 = midnight        0.25 = dawn
 *   0.50 = noon            0.75 = dusk (golden hour is 0.78-0.85)
 *   back to 1.00 = midnight
 */

/** default phase until the day/night cycle unit drives it: golden hour */
export const GOLDEN_HOUR = 0.82;

/** full cycle length in seconds (U6: 12-minute day, per approved plan) */
export const DAY_CYCLE_SECONDS = 720;

/**
 * U6: the live cycle clock. Kept here (engine, pure-ish) so renderers read
 * one source; the render loop advances it, the P harness can jump it.
 * Starts at golden hour — the default look — and drifts slowly from there.
 */
const clock = { phase: GOLDEN_HOUR, paused: false };
export function dayPhase(): number {
  return clock.phase;
}
export function advanceDay(deltaSeconds: number): void {
  if (clock.paused) return;
  clock.phase = (clock.phase + deltaSeconds / DAY_CYCLE_SECONDS) % 1;
}
/**
 * P panel / tests: jump to any phase directly. This is the OVERRIDE: it
 * pauses the natural clock so the forced phase holds (the panel's "resume"
 * control unpauses). The saved dayPhase always reflects the live phase, so
 * a save written during an override resumes exactly there — never corrupts.
 */
export function setDayPhase(p: number): void {
  clock.phase = ((p % 1) + 1) % 1;
  clock.paused = true;
}
/** P panel / tests: release the override, natural drift resumes */
export function resumeDayCycle(): void {
  clock.paused = false;
}
/** true while an override holds the clock still */
export function dayCycleOverridden(): boolean {
  return clock.paused;
}
/** dusk window: fireflies appear here (just before the light fully fades) */
export const DUSK_START = 0.79;
export const DUSK_END = 0.92;
export function isDusk(phase: number): boolean {
  return phase >= DUSK_START && phase <= DUSK_END;
}

export interface SkyPalette {
  /** zenith color */
  top: string;
  /** mid sky */
  mid: string;
  /** horizon glow */
  horizon: string;
  /** fog color (scene fog + horizon melt) */
  fog: string;
  /** directional light color */
  light: string;
  /** ambient intensity multiplier 0..1 */
  ambient: number;
}

/**
 * Palette keyframes through the day. Positions are phases; between
 * keyframes the palette lerps (hex lerp in linear space, good enough for
 * the soft voxel mood). The golden-hour default matches the pre-session-5
 * look (honey amber horizon, warm light) — no visual regression at rest.
 */
const KEYS: { at: number; p: SkyPalette }[] = [
  {
    at: 0.0,
    p: { top: '#0e1a33', mid: '#1b2a4a', horizon: '#2c3a5e', fog: '#26334f', light: '#5f7ab8', ambient: 0.35 },
  },
  {
    at: 0.22,
    p: { top: '#4a6d9e', mid: '#8fa8c8', horizon: '#e8b07a', fog: '#d9b08a', light: '#e8b07a', ambient: 0.6 },
  },
  {
    at: 0.35,
    p: { top: '#6fa8dc', mid: '#a8cdf0', horizon: '#ffe9c0', fog: '#f0c48a', light: '#fff0c8', ambient: 0.85 },
  },
  {
    at: 0.65,
    p: { top: '#6fa8dc', mid: '#a8cdf0', horizon: '#ffe9c0', fog: '#f0c48a', light: '#fff0c8', ambient: 0.85 },
  },
  {
    at: 0.8,
    p: { top: '#5d84b8', mid: '#a8b8d8', horizon: '#ffd9a0', fog: '#f0c48a', light: '#ffca88', ambient: 0.7 },
  },
  {
    at: 0.88,
    p: { top: '#3a4a78', mid: '#7a6f9e', horizon: '#e8935e', fog: '#c98a6e', light: '#e8a06e', ambient: 0.5 },
  },
  {
    at: 1.0,
    p: { top: '#0e1a33', mid: '#1b2a4a', horizon: '#2c3a5e', fog: '#26334f', light: '#5f7ab8', ambient: 0.35 },
  },
];

function hexLerp(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}

function paletteLerp(a: SkyPalette, b: SkyPalette, t: number): SkyPalette {
  return {
    top: hexLerp(a.top, b.top, t),
    mid: hexLerp(a.mid, b.mid, t),
    horizon: hexLerp(a.horizon, b.horizon, t),
    fog: hexLerp(a.fog, b.fog, t),
    light: hexLerp(a.light, b.light, t),
    ambient: a.ambient + (b.ambient - a.ambient) * t,
  };
}

/** the sky palette at any phase (0..1, wraps). Pure. */
export function skyPaletteAt(phase: number): SkyPalette {
  const p = ((phase % 1) + 1) % 1;
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i];
    const b = KEYS[i + 1];
    if (p >= a.at && p <= b.at) {
      const t = (p - a.at) / (b.at - a.at);
      return paletteLerp(a.p, b.p, t);
    }
  }
  return KEYS[0].p;
}

/**
 * Sun/moon azimuth-elevation model: a soft circle path over the meadow.
 * Elevation peaks at noon (0.5), dips below the horizon at night.
 *
 * PR #35 BLOCKER FIX: isDaylight previously used elevation > 0.05, which
 * reads golden hour (0.82, the DEFAULT phase) and the whole lit evening as
 * "night" — so the night-homing fix parked every bee at the hive from
 * boot, and the saved phase (~0.82+) made it survive reload while the P
 * panel printed "day/evening". Daylight must mean WHAT THE SKY SHOWS: the
 * palette's own ambient keyframes are the visual source of truth — the
 * day is lit from the dawn ramp (0.22) through the dusk ramp (0.88);
 * between 0.88 and 1.0/0.22 the sky reads night.
 */
export function sunElevation(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  return Math.sin((p - 0.25) * Math.PI * 2) * 0.9;
}

/** the lit window — matches the palette keyframes (dawn 0.22 .. dusk 0.88) */
export const DAYLIGHT_START = 0.22;
export const DAYLIGHT_END = 0.88;

/** true when the sky reads as lit (day, incl. golden hour) — one source
 *  for the bees' night-homing, the P panel, and any day-gated behavior.
 *  Epsilon-tolerant boundaries: the phase wrap ((p % 1) + 1) % 1 is not
 *  exact in float math (0.22 wraps to 0.21999...97), and a boundary that
 *  flips on rounding would split the panel from the bees again. */
export function isDaylight(phase: number): boolean {
  const p = ((phase % 1) + 1) % 1;
  const eps = 1e-9;
  return p >= DAYLIGHT_START - eps && p <= DAYLIGHT_END + eps;
}
