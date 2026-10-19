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
  /**
   * #25: per-tuft blade count varies 3-7, weighted toward 5 — adjacent
   * tufts visibly differ. Capacity must cover the max (7); unused
   * instance slots are parked at zero scale.
   */
  bladesMin: 3,
  bladesMax: 7,
  /** weights for [3,4,5,6,7] — 5 is the mode */
  bladeWeights: [1, 2, 4, 2, 1],
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
   * #27: drift CENTERS ring the meadow outskirts — placement probability
   * rises with distance from the meadow center (the wild band between the
   * buildable center and the brown terrain), with a few inward stragglers
   * so it never reads as a perfect ring.
   */
  driftCount: 6,
  driftRadius: 3.2,
  /** #27: clumps are placed at radii in [innerR, GRASS_TUFTS.radius] —
   *  the band between the buildable heart and the terrain edge */
  outskirtsInnerRadius: 10,
  /** fraction of drifts allowed to stray inward (naturalness) */
  stragglerChance: 0.15,
  swaySpeed: 1.3,
  swayAmplitude: 0.16,
  /** only within the meadow radius (44/2 minus margin) */
  radius: 20,
} as const;

/**
 * #7 (session 5): ambient bushlets — dwarf shrub clusters interleaved into
 * the SAME outskirts ring the grass drifts own (a seeded fraction of clump
 * positions sprout bushlets instead of extra grass; never a second ring pass
 * stacked on top). One small instanced mesh (<= count * 4 boxes).
 */
export const BUSHLETS = {
  /** fraction of accepted clump positions that grow a bushlet */
  fraction: 0.12,
  /** boxes per bushlet (low, wide, darker than grass — reads as scrub) */
  parts: [
    { size: [0.55, 0.28, 0.55], offset: [0, 0.14, 0], color: '#5f7a45' },
    { size: [0.4, 0.24, 0.4], offset: [0.05, 0.36, 0.03], color: '#6c8a4f' },
    { size: [0.24, 0.18, 0.24], offset: [-0.04, 0.52, 0.05], color: '#77995b' },
    { size: [0.12, 0.1, 0.12], offset: [0.16, 0.44, -0.14], color: '#a5493f' },
  ],
} as const;
