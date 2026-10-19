import { terrainHeight } from './terrain';
import { LAKE, HILLS } from '../data/environment';

/**
 * Ground oracle — the single module that answers "what is at this cell of
 * the world" for every system that needs to know: the pond renderer, grass
 * and flower drifts, interactive placement, and the demo seeder.
 *
 * Drift-class bug family this closes (#21 floating flowers, #22 buried
 * water, #26 grass on the shoreline): each system used to derive its own
 * idea of the ground — flat y=0, terrainHeight alone, backgroundHeight,
 * or nothing at all. Now everyone asks the same oracle.
 */

export type GroundKind = 'meadow' | 'shore' | 'water';

export interface GroundInfo {
  kind: GroundKind;
  /** surface height at this point (what things stand ON or float at) */
  height: number;
  /** horizontal distance to the pond center (Infinity when no lake) */
  lakeDistance: number;
  /** true inside the water disc */
  isWater: boolean;
  /** true inside the sandy shore ring */
  isShore: boolean;
}

/** Full ground read at any world point. */
export function groundAt(x: number, z: number): GroundInfo {
  const lakeDistance = Math.hypot(x - LAKE.center[0], z - LAKE.center[1]);
  const isWater = lakeDistance <= LAKE.radius;
  const isShore = !isWater && lakeDistance <= LAKE.radius + LAKE.shoreWidth;
  // The pond sits in the background-lift band: the visible surface there
  // is the background heightfield (terrain + distance lift), NOT the
  // meadow heightfield. Use the same function the hills boxes render from.
  const height =
    terrainHeight(x, z) +
    Math.max(0, Math.hypot(x, z) - HILLS.liftStartRadius) * HILLS.liftPerRadius;
  return {
    kind: isWater ? 'water' : isShore ? 'shore' : 'meadow',
    height,
    lakeDistance,
    isWater,
    isShore,
  };
}

/**
 * Water surface height at a point: the voxel water now sits BELOW the
 * surrounding terrain (#28) — half a voxel step under the ground oracle's
 * height, so the brown shoreline ring reads above the waterline. The pond
 * basin is carved out of the hills ground (Hills skips water cells), so
 * sunken water stays visible instead of buried.
 */
export function waterSurfaceHeight(x: number, z: number): number {
  return groundAt(x, z).height - LAKE.sinkDepth;
}

/**
 * Buffer zone: no grass tufts (or future ground clutter) may spawn within
 * this many units of the OUTER edge of the brown shoreline band — a tuft
 * hugging the waterline inside the band still looks wrong (#26).
 */
export const SHORELINE_GRASS_BUFFER = 1.6;

/** True when a point is legal ground for grass/drift spawning (#26).
 *  Excludes water cells, the full brown shore band, and a buffer ring
 *  beyond it — computed against the CURRENT water state (post-#28 the
 *  surface sinks below its banks; the band geometry is the same disc).
 *  Used by the grass drift generator and every future scatter system. */
export function isGrassSpawnable(x: number, z: number): boolean {
  const g = groundAt(x, z);
  if (g.kind !== 'meadow') return false;
  return g.lakeDistance > LAKE.radius + LAKE.shoreWidth + SHORELINE_GRASS_BUFFER;
}

/**
 * True when a point is legal ground for BUILDING (flowers, structures) —
 * the interactive placement path and the demo seeder ask the same oracle,
 * closing the drift-class family: one module answers "what's at this
 * cell" for every placement system.
 */
export function isBuildable(x: number, z: number): boolean {
  // no flowers/hives in the water or on the shore band; the meadow proper
  // (and the buildable outskirts) are all fair game
  return groundAt(x, z).kind === 'meadow';
}
