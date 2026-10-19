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
  /** water surface sits this far below the shoreline terrain top (#28) */
  surfaceDrop: 0.8,
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
