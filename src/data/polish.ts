/**
 * Session-3 visual polish tuning — every value here, never in components.
 * All effects are additive/subtle: the session-2 look must survive.
 */

export const BLOOM = {
  enabled: true,
  /** subtle: low strength, high threshold = only sun/bloom highlights glow */
  strength: 0.35,
  radius: 0.6,
  threshold: 0.82,
} as const;

export const LIGHT_WARMTH = {
  /**
   * Morning/evening warmth: the directional sun lerps toward rose/amber at
   * low angles. phi is the orbit polar angle (1.32 max = lowest sun).
   */
  enabled: true,
  /** polar angle above which warmth starts (radians; below = high sun) */
  warmStartPolar: 1.0,
  warmSunColor: '#ffbe86',
  warmIntensityBoost: 0.12,
} as const;

export const LONG_SHADOWS = {
  /**
   * Long shadows: the sun position stretches as the camera swings low.
   * Sun base position comes from App Scene; this scales it outward and down.
   */
  enabled: true,
  /** shadow length multiplier at the lowest camera angle */
  stretchMax: 1.8,
} as const;

export const GRASS_TUFTS = {
  /** sparse swaying voxel grass tufts scattered on the meadow */
  enabled: true,
  count: 260,
  /** tuft geometry: 2-3 thin blades per tuft */
  bladeSize: [0.07, 0.45, 0.07] as [number, number, number],
  colors: ['#7d9f54', '#8fae5f', '#94b364'],
  swaySpeed: 1.3,
  swayAmplitude: 0.16,
  /** only within the meadow radius (44/2 minus margin) */
  radius: 20,
} as const;
