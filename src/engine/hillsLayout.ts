import { HILLS, LAKE } from '../data/environment';

/**
 * #36 item 4 (corner overlap fix): the EXACT layout of the rendered hills
 * boxes — one shared source. The hills renderer (Background.tsx) and the
 * placement classifier (isPlantableCell) both read this module, so the
 * classification can never diverge from what actually renders
 * (raw-data-over-projection: the footprints here ARE the renderer's own
 * placement data, same lattice, same RNG sequence, same jitter/size rules).
 *
 * The layout is deterministic (seeded LCG, exactly the renderer's draw
 * order) and lazy-cached: built once on first use, ~2300 boxes.
 */

/** deterministic LCG — identical to the renderer's makeRng */
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export interface HillsBox {
  /** jittered world center */
  x: number;
  z: number;
  /** half-extent of the rendered box */
  half: number;
}

/** #29 pass 2's exact band boundary — the hills loop skips these cells */
function isPondBandCell(x: number, z: number): boolean {
  const half = (HILLS.step * HILLS.maxSize) / 2 + HILLS.step * HILLS.jitter * 0.5;
  const dx = x - LAKE.center[0];
  const dz = z - LAKE.center[1];
  const maxD = LAKE.radius + LAKE.shoreWidth;
  return (
    Math.hypot(dx - half, dz - half) <= maxD ||
    Math.hypot(dx + half, dz - half) <= maxD ||
    Math.hypot(dx - half, dz + half) <= maxD ||
    Math.hypot(dx + half, dz + half) <= maxD
  );
}

let cache: HillsBox[] | null = null;

/** The rendered hills boxes (jittered centers + exact half-extents). */
export function hillsBoxes(): HillsBox[] {
  if (cache) return cache;
  const rng = makeRng(20260101);
  const step = HILLS.step;
  const outer = HILLS.outerRadius;
  const boxes: HillsBox[] = [];
  for (let x = -outer; x <= outer; x += step) {
    for (let z = -outer; z <= outer; z += step) {
      const r = Math.hypot(x, z);
      if (r < HILLS.innerRadius || r > outer) continue;
      if (isPondBandCell(x, z)) continue;
      // no jitter near the band so hills boxes meet the band flush
      const lakeDB = Math.hypot(x - LAKE.center[0], z - LAKE.center[1]);
      const nearBand = lakeDB < LAKE.radius + LAKE.shoreWidth + step * 1.5;
      const jitterScale = nearBand ? 0 : HILLS.jitter;
      const jx = x + (rng() - 0.5) * step * jitterScale;
      const jz = z + (rng() - 0.5) * step * jitterScale;
      const size = step * (HILLS.minSize + rng() * (HILLS.maxSize - HILLS.minSize));
      rng(); // the renderer's color pick consumes one draw — keep parity
      boxes.push({ x: jx, z: jz, half: size / 2 });
    }
  }
  cache = boxes;
  return boxes;
}

/**
 * True when a rendered hills box covers this world point — geometrically
 * exact against the actual footprints (axis-aligned squares, so the test
 * is exact containment, no approximation).
 */
export function hillsCover(x: number, z: number): boolean {
  // fast reject: a box CENTERED at r >= innerRadius can still reach inward
  // by its full DIAGONAL (half * sqrt(2)) plus the jitter — the first cut
  // subtracted only half and the deterministic classification gate caught
  // the one leaking cell ((-15.5, 13), covered by a box at r = 21.68).
  const r = Math.hypot(x, z);
  const halfMax = (HILLS.step * HILLS.maxSize) / 2;
  const reach =
    HILLS.innerRadius - halfMax * Math.SQRT2 - HILLS.step * HILLS.jitter * 0.5;
  if (r < reach) return false;
  for (const b of hillsBoxes()) {
    if (Math.abs(x - b.x) <= b.half && Math.abs(z - b.z) <= b.half) return true;
  }
  return false;
}
