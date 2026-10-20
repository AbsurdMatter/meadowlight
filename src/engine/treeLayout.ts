import { TREES, LAKE, HILLS } from '../data/environment';

/**
 * Session 7 U4 revision (#6297851661): the tree layout rule, PURE — one
 * source shared by the renderer and the unit tests. The renderer consumes
 * exactly this sequence (same RNG, same order), so the unit test asserts
 * the same trees the player sees.
 *
 * The water-exclusion is the exact-footprint rule: a tree is dropped when
 * its FULL rendered footprint (canopy bounds incl. scale — never the trunk
 * cell) reaches the pond footprint (radius + edge cells) + clearance.
 */

/** deterministic LCG — identical to the renderer's makeRng */
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export interface TreePlacement {
  x: number;
  z: number;
  /** the tree's full rendered footprint radius (canopy bounds) */
  footprint: number;
}

/** the pond's exclusion radius: water + edge cells + the data clearance */
export function pondExclusionRadius(): number {
  return LAKE.radius + HILLS.step * 0.5 + TREES.pondClearance;
}

/** the deterministic tree positions (the renderer's exact sequence) */
export function treePlacements(): TreePlacement[] {
  const rng = makeRng(991103);
  const out: TreePlacement[] = [];
  const exclusion = pondExclusionRadius();
  for (const cluster of TREES.clusters) {
    for (let t = 0; t < cluster.count; t++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * cluster.spread;
      const x = cluster.x + Math.cos(a) * r;
      const z = cluster.z + Math.sin(a) * r;
      const variant = TREES.variants[Math.floor(rng() * TREES.variants.length)];
      const scale = 0.8 + rng() * 0.5;
      rng(); // rotY — consumed in the same order as the renderer
      // canopy bounds: the farthest foliage reach, scale included
      let canopyMax = 0;
      for (const f of variant.foliage) {
        canopyMax = Math.max(
          canopyMax,
          Math.hypot(f.offset[0], f.offset[2]) + Math.max(f.size[0], f.size[2]) * 0.5,
        );
      }
      const footprint = (canopyMax + 0.3) * (1 + scale); // exact: the actual scale, no bounds
      if (Math.hypot(x - LAKE.center[0], z - LAKE.center[1]) < exclusion + footprint) {
        continue; // water-excluded (deterministic: rolls consumed first)
      }
      out.push({ x, z, footprint });
    }
  }
  return out;
}
