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
const clock = { phase: GOLDEN_HOUR };
export function dayPhase(): number {
  return clock.phase;
}
export function advanceDay(deltaSeconds: number): void {
  clock.phase = (clock.phase + deltaSeconds / DAY_CYCLE_SECONDS) % 1;
}
/** P harness / tests: jump to any phase directly */
export function setDayPhase(p: number): void {
  clock.phase = ((p % 1) + 1) % 1;
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

/** sun/moon azimuth-elevation model: a soft circle path over the meadow.
 *  Elevation peaks at noon (0.5), dips below the horizon at night. */
export function sunElevation(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  return Math.sin((p - 0.25) * Math.PI * 2) * 0.9;
}

/** true when the sun is meaningfully up (drives shadows/warmth later) */
export function isDaylight(phase: number): boolean {
  return sunElevation(phase) > 0.05;
}
