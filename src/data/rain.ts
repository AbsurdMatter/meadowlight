/**
 * Session 8 N1 (round 2, PR #38 comment #6299401525): natural precipitation
 * tuning — ONE source in data. Binary windows, seeded per (worldSeed, season
 * ordinal): spring/fall frequent rain, summer rare rain, winter SNOW
 * (decided). Windows arrive and end mid-season (stochastic reads, seeded
 * determinism — same world, same weather calendar); boundaries never reset
 * or silence the weather.
 *
 * Observability weights (the 8x rule): a season is 720s at 1x, 90s at 8x.
 * gap/len are fractions of a season; expected window count ~= 1 / (gap/2 +
 * mean len). Spring/autumn ~4 windows (several rains per accelerated year),
 * winter ~5 snow windows, summer 0-2. Weather that can't be observed in a
 * session is a bug, not subtlety.
 */
export const PRECIP_TUNING = {
  windows: {
    spring: { kind: 'rain', gapScale: 0.3, lenScaleMin: 0.06, lenScaleMax: 0.16 },
    summer: { kind: 'rain', gapScale: 0.7, lenScaleMin: 0.04, lenScaleMax: 0.1 },
    autumn: { kind: 'rain', gapScale: 0.3, lenScaleMin: 0.06, lenScaleMax: 0.16 },
    winter: { kind: 'snow', gapScale: 0.22, lenScaleMin: 0.05, lenScaleMax: 0.14 },
  },
  /** how far a late window may spill past the season's end (progress units) */
  spill: 0.06,
  /**
   * FAST settle on arrival/departure — scaled seconds for the visual ramp.
   * Weather turns, it doesn't fade: NOT the colony's slow ease.
   */
  settleSeconds: 2,
  /** SNOW visual tuning (winter = snow, decided): slow, soft, drifting */
  snow: {
    fallSpeed: 2.2,
    /** flake size (cube scale) — reads as snow, not thin rain columns */
    size: 0.09,
    /** gentler wind than rain */
    windX: 0.6,
    color: '#ffffff',
    opacity: 0.85,
  },
} as const;

/** the rain visual tuning (unchanged, session-5 look preserved) */
export const RAIN_VISUAL = {
  drops: 220,
  fallSpeed: 14,
  areaHalf: 24,
  top: 14,
  windX: 1.2,
  color: '#a8c8e0',
  opacity: 0.5,
} as const;
