import { terrainHeight } from './terrain';
import { LAKE, MEADOW_BOWL, shapedHeight } from '../data/environment';
import { MEADOW_SIZE } from './terrain';

/**
 * Ground oracle — the single module answering "what is at this cell of the
 * world": the pond renderer, grass and flower drifts, interactive
 * placement, and the demo seeder all ask it.
 *
 * Final pond model (post-rebuild): the pond is CARVED INTO the terrain —
 * a depression like any terrain feature. Heights here are the single
 * source of truth for the carve, the water body, and spawnability.
 */

export type GroundKind = 'meadow' | 'shore' | 'water';

export interface GroundInfo {
  kind: GroundKind;
  /** terrain surface height (the un-carved heightfield at this point) */
  height: number;
  /** horizontal distance to the pond center */
  lakeDistance: number;
  isWater: boolean;
  isShore: boolean;
}

/** Full ground read at any world point. */
export function groundAt(x: number, z: number): GroundInfo {
  const lakeDistance = Math.hypot(x - LAKE.center[0], z - LAKE.center[1]);
  const isWater = lakeDistance <= LAKE.radius;
  const isShore = !isWater && lakeDistance <= LAKE.radius + LAKE.shoreWidth;
  // #29 pass 4 — the meadow BOWL: inside the meadow square the ground is
  // the low depression; everywhere else it is the natural heightfield
  // (+ distance lift). The oracle stays the single source of truth: every
  // renderer, the placement ray, the demo seeder, and the save loader
  // re-derive heights from here, so the bowl can never drift from what
  // renders.
  const inMeadow = Math.abs(x) <= MEADOW_SIZE / 2 && Math.abs(z) <= MEADOW_SIZE / 2;
  // #31: outside the meadow square the ground is the shared shaped profile
  // (damped calm ring, second outer rim, flat pond plateau). The hills
  // renderer's backgroundHeight() uses the same function — one source.
  const height = inMeadow
    ? terrainHeight(x, z) - MEADOW_BOWL.depth
    : shapedHeight(x, z);
  return { kind: isWater ? 'water' : isShore ? 'shore' : 'meadow', height, lakeDistance, isWater, isShore };
}

/**
 * The carved pond floor: solid terrain at carveDepth below the local
 * heightfield. The water body fills from this floor up to the surface.
 */
export function pondFloorHeight(x: number, z: number): number {
  return groundAt(x, z).height - LAKE.carveDepth;
}

/**
 * Water surface height: a visible step below the shoreline terrain top
 * (#28 closed by construction — the banks are simply the un-carved grid).
 */
export function waterSurfaceHeight(x: number, z: number): number {
  return groundAt(x, z).height - LAKE.surfaceDrop;
}

/**
 * Buffer zone: no grass (or future ground clutter) within this distance of
 * the OUTER edge of the sandy shoreline band (#26).
 */
export const SHORELINE_GRASS_BUFFER = 1.6;

/** True when a point is legal ground for grass/drift spawning (#26).
 *  Excludes water cells, the full sandy band, and a buffer ring beyond it —
 *  against the CURRENT carved geometry. */
export function isGrassSpawnable(x: number, z: number): boolean {
  const g = groundAt(x, z);
  if (g.kind !== 'meadow') return false;
  return g.lakeDistance > LAKE.radius + LAKE.shoreWidth + SHORELINE_GRASS_BUFFER;
}

/**
 * True when a point is legal ground for BUILDING (flowers, structures) —
 * interactive placement and the demo seeder ask the same oracle.
 */
export function isBuildable(x: number, z: number): boolean {
  return groundAt(x, z).kind === 'meadow';
}

/**
 * PR #35 corner-overhang fix: THE single plantable-cell query. A cell is
 * plantable only when the ground oracle says meadow AND it lies inside the
 * placement box (|x|,|z| <= MEADOW_SIZE/2 - 1) — the exact conjunction the
 * cell-map overlay classifies with. The scenic terrain folds over the
 * meadow square's corners (approved to keep); those overhang cells sit
 * outside the box and must REFUSE placement exactly like water/shore.
 * The overlay, the ghost's refusal path, and the click path all call
 * this — one source, no divergence.
 */
export function isPlantableCell(x: number, z: number): boolean {
  if (!isBuildable(x, z)) return false;
  return Math.abs(x) <= MEADOW_SIZE / 2 - 1 && Math.abs(z) <= MEADOW_SIZE / 2 - 1;
}
