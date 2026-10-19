import { terrainHeight } from '../engine/terrain';

export const FOG = {
  color: '#f0c48a',
  near: 26,
  far: 74,
};

export const CAMERA_BOUNDS = {
  minPolarAngle: 0.3,
  maxPolarAngle: 1.32,
  minDistance: 9,
  maxDistance: 34,
  panTargetLimit: 16,
};

export const HILLS = {
  /** background ring starts just inside the meadow edge for seamless blend */
  innerRadius: 21.5,
  outerRadius: 50,
  step: 1.6,
  boxHeight: 1.4,
  /** guaranteed overlap: worst-case neighbor center separation is
   *  step * (1 + jitter) = 1.1 * step, so minSize 1.12 * step always covers it */
  minSize: 1.12,
  maxSize: 1.35,
  /** horizontal jitter fraction of step (must satisfy (1+jitter) < minSize) */
  jitter: 0.1,
  /** ground rises gently with distance from the meadow */
  liftStartRadius: 22,
  liftPerRadius: 0.045,
  meadowGrassColors: ['#94b364', '#8fae5f', '#87a75a', '#7d9f54', '#6f8f52', '#9cb96a'],
  hillColors: ['#6c8a4f', '#5f7a45', '#79995b', '#556e40'],
  /** lerp distant ground colors toward fog so the horizon melts */
  fogBlendStart: 24,
  fogBlendEnd: 50,
  fogBlendStrength: 0.55,
};

/**
 * #29 pass 4: the meadow is the LOW BOWL of the terrain — not a layer
 * laid on top. The green surface sits this far below the natural
 * heightfield; the hills rise around it (their tops stay at the natural
 * height + distance lift), so the meadow edge reads as terrain rising
 * from a depression, with no seam and no floating layer.
 */
export const MEADOW_BOWL = {
  /**
   * Deep enough to read as THE low bowl: the natural heightfield undulates
   * ~±1.2 around the meadow's rim, so a shallow dip gets swamped — at some
   * spots the meadow edge would still sit above adjacent hills. 1.5 puts
   * the entire meadow surface below the terrain everywhere on the rim.
   */
  depth: 1.5,
} as const;

/**
 * #31 terrain shaping (session 5): the world gets a radius profile.
 *  - POND_FLAT: a plateau around the pond so single-level water sits safely
 *    below its banks EVERYWHERE (the #29 banks varied with the wave field;
 *    the flat-water survey demanded a constant bank margin).
 *  - CALM_MIDDLE: the ring holding trees/pond/future shrubs is damped and
 *    the inner rim lift is halved — much gentler than pre-#31, which rose at
 *    0.045/unit right from the meadow edge and waved at full amplitude.
 *  - SECOND_RIM: real hills out beyond the calm ring (the user's structural
 *    idea: hills out there, calm middle) — they rise steeply enough to read
 *    as a second rim against the fog.
 * All deterministic decoration derived from (x, z) — no save impact.
 */
export const TERRAIN_SHAPE = {
  /** pond plateau: exact flat within flatRadius, feathered to full by featherEnd */
  pondFlatRadius: 11,
  pondFlatFeatherEnd: 15,
  /** where the calm middle ring sits (meadow rim is ~22) */
  calmInnerRadius: 22,
  calmOuterRadius: 36,
  /** wave amplitude multiplier inside the calm ring (feathered to 1.0 by calmOuterRadius + feather) */
  calmAmplitude: 0.45,
  calmFeather: 4,
  /** inner rim lift rate inside the calm ring (was HILLS.liftPerRadius = 0.045) */
  calmLiftPerRadius: 0.02,
  /** the second outer rim: hills beyond this radius rise fast */
  outerRimStartRadius: 34,
  outerRimLiftPerRadius: 0.12,
} as const;

export const LAKE = {
  /**
   * #29 pass 4: relocated. The old center (26,-24) sat only 4.47u from the
   * meadow SQUARE's corner (22,-22) — inside the pond disc, meadow layer
   * boxes floated over the pond and the corner was unplantable. The new
   * center clears the square by 16.1u (nearest point (22,-14)): >5u of
   * hills between the band edge and any meadow cell, no adjacency, no
   * feathering needed. Band outer edge at 49.2 stays inside the hills
   * zone (outer 50). The pond is now a background terrain feature.
   */
  center: [36, -14] as [number, number],
  radius: 8,
  /**
   * Pond-as-terrain (final geometry): the pond is carved INTO the terrain
   * grid (the Hills 1.6 step at this radius) — a depression like any
   * terrain feature. Saves are untouched: the pond is world decoration,
   * generated deterministically every load, so v1-v4 worlds, fresh worlds,
   * and ?demo=1 all get the identical carved pond with zero migration.
   */
  /** grid step = the terrain's own step here (HILLS.step) — one grid */
  voxelStep: 1.6,
  /** carve depth: pond floor sits this far below the surrounding terrain */
  carveDepth: 1.5,
  /**
   * #29: reduced to a third of the old 0.8 drop — a subtle step down to
   * the water, not a cube-well. The blue-green floor still reads through
   * the translucency at this level (verified by pixel readback).
   */
  surfaceDrop: 0.27,
  /**
   * #29: the sandy band granulates into finer sub-pieces (a 2x2
   * subdivision of the terrain cell) so the ring reads as gravelly detail
   * rather than chunky slabs. Sub-pieces snap to the parent lattice —
   * the subdivision is exact, so no offsets or new gaps are possible.
   */
  bandSubdivision: 2,
  /** width of the sandy shoreline band around the carved area */
  shoreWidth: 2.6,
  /** floor tint: solid, blue-green, visible through the translucent water */
  bottomColor: '#6b8f7a',
  /** sandy band tint */
  shoreColor: '#cbb98a',
  /** water body color (the working #22 fix: light reflective pond blue) */
  colorA: '#9ed2ec',
  opacity: 0.9,
};


export const TREES = {
  trunkColors: ['#8a5a2b', '#7a4c24', '#96683a'],
  foliageColors: ['#5f8a4a', '#6c9a52', '#548040', '#77a35c', '#4c7a3c'],
  clusters: [
    { x: 30, z: 12, count: 16, spread: 9 },
    { x: -27, z: -21, count: 14, spread: 8 },
  ],
  variants: [
    {
      name: 'round',
      trunk: { size: [0.5, 1.6, 0.5] as [number, number, number], offset: [0, 0.8, 0] as [number, number, number] },
      foliage: [
        { size: [2.6, 2.0, 2.6] as [number, number, number], offset: [0, 2.4, 0] as [number, number, number] },
        { size: [1.6, 1.2, 1.6] as [number, number, number], offset: [0, 3.7, 0] as [number, number, number] },
      ],
    },
    {
      name: 'pine',
      trunk: { size: [0.4, 1.4, 0.4] as [number, number, number], offset: [0, 0.7, 0] as [number, number, number] },
      foliage: [
        { size: [2.2, 1.1, 2.2] as [number, number, number], offset: [0, 1.9, 0] as [number, number, number] },
        { size: [1.5, 1.0, 1.5] as [number, number, number], offset: [0, 2.8, 0] as [number, number, number] },
        { size: [0.9, 0.9, 0.9] as [number, number, number], offset: [0, 3.6, 0] as [number, number, number] },
      ],
    },
    {
      name: 'broad',
      trunk: { size: [0.55, 1.8, 0.55] as [number, number, number], offset: [0, 0.9, 0] as [number, number, number] },
      foliage: [
        { size: [3.2, 1.3, 3.0] as [number, number, number], offset: [0, 2.5, 0] as [number, number, number] },
        { size: [2.0, 1.0, 2.0] as [number, number, number], offset: [0, 3.5, 0] as [number, number, number] },
      ],
    },
  ],
};

export const CLOUDS = {
  color: '#fff4e0',
  opacity: 0.92,
  wrapHalfWidth: 62,
  /**
   * #6 (session 5): purposeful clouds — each cluster is a COMPOSITION, not
   * a random blob: a flat wind-swept base puff, a smaller puff above-left,
   * a bright cap. Shapes are wide-and-low (cumulus humilis at golden hour),
   * spaced so the sky reads composed from the default camera.
   */
  clusters: [
    { height: 17, speed: 0.5, z: -16, scale: 1.2 },
    { height: 21, speed: 0.32, z: 6, scale: 1.45 },
    { height: 15, speed: 0.62, z: 20, scale: 0.9 },
    { height: 24, speed: 0.26, z: -4, scale: 1.6 },
    { height: 19, speed: 0.42, z: 28, scale: 1.0 },
  ],
  puffsPerCloud: 6,
  /** composed puff template (offsets/sizes in cluster-local units, x-z spread
   *  much wider than y — the wind-swept reading) */
  puffTemplate: [
    { offset: [0, 0, 0], size: [7.5, 1.3, 3.4] },
    { offset: [-4.2, 0.5, 0.8], size: [4.5, 1.1, 2.6] },
    { offset: [4.0, 0.4, -0.7], size: [4.0, 1.0, 2.4] },
    { offset: [-1.6, 1.1, 0.3], size: [3.4, 1.0, 2.0] },
    { offset: [2.2, 0.9, -0.4], size: [2.8, 0.9, 1.8] },
    { offset: [0.4, 1.7, 0], size: [2.2, 0.8, 1.5] },
  ],
};

/** Decorative background ground height: meadow terrain + gentle rise with distance. */
export function backgroundHeight(x: number, z: number): number {
  return shapedHeight(x, z);
}

/**
 * #31: the shared height profile used by backgroundHeight() and the ground
 * oracle's outside-meadow branch. Bands (all radii from origin):
 *   r <= pond flat zone -> plateau at the pond-center natural height
 *   meadow rim band     -> damped waves, gentle lift (calmLiftPerRadius)
 *   beyond calmOuter    -> second rim lift (outerRimLiftPerRadius)
 */
export function shapedHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const t = TERRAIN_SHAPE;

  // wave amplitude: damped inside the calm ring, feathered back to full
  // between calmOuterRadius and calmOuterRadius + calmFeather
  const overCalm = Math.max(0, r - t.calmOuterRadius);
  const ampT = Math.min(1, overCalm / t.calmFeather);
  const amp = t.calmAmplitude + (1 - t.calmAmplitude) * ampT;
  const wave = (terrainHeight(x, z) / 0.55) * amp; // undamped wave sum (pre-0.55)

  // lift: gentle rate through the calm ring, then the steep second-rim rate
  // for the whole span beyond outerRimStart (shoulder, not a kink)
  const calmLift = Math.max(0, r - t.calmInnerRadius) * t.calmLiftPerRadius;
  const outerLift =
    Math.max(0, r - t.outerRimStartRadius) * t.outerRimLiftPerRadius;
  const liftFinal =
    r <= t.outerRimStartRadius
      ? calmLift
      : (t.outerRimStartRadius - t.calmInnerRadius) * t.calmLiftPerRadius +
        outerLift;

  // pond plateau: blend to the pond-center natural height near the pond
  const pd = Math.hypot(x - LAKE.center[0], z - LAKE.center[1]);
  if (pd <= t.pondFlatRadius) {
    return POND_FLAT_HEIGHT;
  }
  if (pd < t.pondFlatFeatherEnd) {
    const f = (pd - t.pondFlatRadius) / (t.pondFlatFeatherEnd - t.pondFlatRadius);
    const natural = wave * 0.55 + liftFinal;
    return POND_FLAT_HEIGHT * (1 - f) + natural * f;
  }
  return wave * 0.55 + liftFinal;
}

/**
 * The pond plateau height: the natural (undamped, unlifted) terrain height at
 * the pond center — a constant, so water at surfaceDrop below it sits below
 * its banks everywhere on the plateau.
 */
export const POND_FLAT_HEIGHT = terrainHeight(LAKE.center[0], LAKE.center[1]);
