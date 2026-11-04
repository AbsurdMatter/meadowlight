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

/**
 * Session 10 #50: EXTRA outer-rim blocks (varied heights) layered past
 * HILLS.outerRadius so no horizontal direction shows sky through the rim.
 * Same lattice discipline as the hills themselves: deterministic LCG (its
 * own seed, appended AFTER the hills' draw sequence so the existing layout
 * is byte-unchanged), step spacing, jitter, size in the same band, pond-band
 * exclusion, and terrain-anchored heights (the renderer gives them the same
 * treatment as hills boxes). hillsLayout stays the ONE shared source: the
 * renderer draws exactly these boxes and isPlantableCell's footprint check
 * reads them too — no second layout.
 */
export interface RimBox extends HillsBox {
  /** reserved — #66: rim boxes use the hills' own height rule (no extraH) */
  extraH: number;
}

/** the extra rim ring's lattice parameters (tuning in data/environment.ts) */
export function rimBoxes(): RimBox[] {
  if (rimCache) return rimCache;
  const rng = makeRng(20261050);
  const step = HILLS.step;
  const inner = HILLS.outerRadius;
  const outer = HILLS.outerRadius + HILLS.rimRingWidth;
  const boxes: RimBox[] = [];
  for (let x = -outer; x <= outer; x += step) {
    for (let z = -outer; z <= outer; z += step) {
      const r = Math.hypot(x, z);
      if (r < inner || r > outer) continue;
      if (isPondBandCell(x, z)) continue;
      const jx = x + (rng() - 0.5) * step * HILLS.jitter;
      const jz = z + (rng() - 0.5) * step * HILLS.jitter;
      const size = step * (HILLS.minSize + rng() * (HILLS.maxSize - HILLS.minSize));
      const extraH = 0; // #66: no extra height — the ring shares the hills' profile
      rng(); // color pick parity with the renderer's draw
      boxes.push({ x: jx, z: jz, half: size / 2, extraH });
    }
  }
  rimCache = boxes;
  return boxes;
}

let rimCache: RimBox[] | null = null;


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

/**
 * #83: the ONE shared source for the Hills instanced buffer capacity — the
 * renderer (Background.tsx) sizes the mesh from this and the unit gate
 * asserts capacity >= instance count, so buffer and draw order can never
 * diverge again (#66's class: an estimate under-counted and three.js
 * silently dropped every instance past the capacity).
 */
export function hillsInstanceCapacity(): number {
  return hillsBoxes().length + rimBoxes().length;
}

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
  // #50: the extra outer rim ring is part of the rendered rim — a cell
  // covered only by a rim box is not plantable either (the rim is terrain,
  // not meadow). Same exact containment test against the same shared source.
  const rimReach =
    HILLS.outerRadius + HILLS.rimRingWidth + halfMax + HILLS.step * HILLS.jitter * 0.5;
  if (r > rimReach) return false;
  for (const b of rimBoxes()) {
    if (Math.abs(x - b.x) <= b.half && Math.abs(z - b.z) <= b.half) return true;
  }
  return false;
}
