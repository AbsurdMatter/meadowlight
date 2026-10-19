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
  /**
   * #23: the 260 thin vertical blades read as bare stalks at voxel scale.
   * Redesigned as wide, leafy clumps: each clump is a fan of short, wide
   * blades (see GrassTufts.tsx) with a low profile — unmistakably grass,
   * not sticks. Hard cap ~80 clumps (5 blades each = 400 instances, still
   * one draw call).
   */
  enabled: true,
  count: 80,
  /** blades per clump — bases joined at the clump point, fanning upward */
  bladesPerClump: 5,
  bladeSize: [0.17, 0.36, 0.06] as [number, number, number],
  /**
   * outward lean of each blade from vertical (base-pivoted fan). Wide
   * enough that the fan READS at voxel scale (~45-60° from vertical) —
   * the first pass at ~25° was indistinguishable from vertical sticks
   */
  fanSpread: 0.9,
  /**
   * #24: the exact Meadow.tsx floor palette — tufts must read as part of
   * the lawn, not a different plant
   */
  colors: ['#94b364', '#8fae5f', '#87a75a', '#7d9f54'],
  /**
   * #24: clumps cluster into drifts with bare gaps between them (the
   * ?demo=1 flower drifts are the reference) — N drift centers, clumps
   * scattered around them
   */
  driftCount: 6,
  driftRadius: 3.2,
  swaySpeed: 1.3,
  swayAmplitude: 0.16,
  /** only within the meadow radius (44/2 minus margin) */
  radius: 20,
} as const;
