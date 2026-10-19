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

export const LAKE = {
  center: [26, -24] as [number, number],
  radius: 8,
  level: -0.3,
  /** light reflective pond blue (DESIGN.md sky-blue family) */
  colorA: '#9ed2ec',
  bedColor: '#d8c49a',
  shoreColor: '#cbb98a',
  shoreWidth: 2.6,
  bobAmplitude: 0.03,
  tintCycleSeconds: 9,
  /**
   * Voxel water rework (session 3): the surface is instanced cubes on this
   * step grid (same cell size as the shore ring), snapped to cell centers —
   * no rounded edges. Boundary cells become partial-width boxes so the
   * waterline steps cleanly into the terrain instead of slicing it.
   */
  voxelStep: 1.4,
  /** water cube top sits this far above LAKE.level (visible voxel lip) */
  surfaceHeight: 0.22,
  /**
   * #22 fix: the pond read nearly black. Causes: deep cube sides under a
   * mostly-opaque material, plus 55% bed-brown tint at the rim. Now the
   * cubes are shallow (just the lip), the palette is a light reflective
   * pond blue matching DESIGN.md's sky-blue, and the shallow tint is a
   * gentle 0.25 toward the sandy bed so edges read warm, not muddy.
   */
  rimTint: 0.25,
  /** thin water: only the visible lip matters; deep sides read black */
  cubeDepth: 0.34,
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
  clusters: [
    { height: 17, speed: 0.5, z: -16, scale: 1.2 },
    { height: 21, speed: 0.32, z: 6, scale: 1.45 },
    { height: 15, speed: 0.62, z: 20, scale: 0.9 },
    { height: 24, speed: 0.26, z: -4, scale: 1.6 },
    { height: 19, speed: 0.42, z: 28, scale: 1.0 },
  ],
  puffsPerCloud: 6,
};

/** Decorative background ground height: meadow terrain + gentle rise with distance. */
export function backgroundHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const lift = Math.max(0, r - HILLS.liftStartRadius) * HILLS.liftPerRadius;
  return terrainHeight(x, z) + lift;
}
