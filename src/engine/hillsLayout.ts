import { HILLS, LAKE, shapedHeight } from '../data/environment';

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
/**
 * #83 redesign (accepted round-3 proposal): a rim block is a SQUARE
 * 6x6-voxel cuboid (rimFootprintVoxels * step on each side — no long axis to
 * look between at glancing angles), carrying its full rendered geometry so
 * the renderer, the sweep and the tests all read ONE source.
 */
export interface RimBox extends HillsBox {
  /** height above local ground (random in [rimMinExtraH, rimMaxExtraH],
   *  biased taller toward the outer edge) */
  extraH: number;
  /** rendered top = shapedHeight + extraH */
  top: number;
  /** rendered bottom = shapedHeight - rimSkirt (sunk: no under-gaps) */
  bottom: number;
}

/** the rim band's outer edge (cell centers r in (hillsOuterRadius, rimOuter]) */
export function rimOuterRadius(): number {
  return HILLS.hillsOuterRadius + HILLS.rimRingWidth;
}

/** iterate the hills-ALIGNED world-unit lattice (origin -outerRadius, phase
 *  shared with hillsBoxes() — #83 round-2 lesson) over the full extent, so
 *  every annulus cell is drawn exactly once on one phase lattice */
function alignedLo(outer: number, step: number): number {
  const origin = -HILLS.outerRadius;
  return origin + Math.floor((-outer - origin) / step) * step; // <= -outer, same phase
}

/**
 * The outer rim ring: square blocks on the world-unit lattice, cell centers
 * r in (hillsOuterRadius, rimOuter]. Overlap canon in BOTH plan axes:
 * footprint (rimFootprintVoxels*step) >= rimStep*(1+rimJitter), so jitter
 * can never open a through-gap between neighbors. Boundary is binding: no
 * rim footprint comes closer to the meadow center than the pond outer edge
 * (measured innermost footprint 51.5u >= 49.23u). Heights: the accepted
 * MODERATE profile, random per block, biased taller outward.
 */
export function rimBoxes(): RimBox[] {
  if (rimCache) return rimCache;
  const rng = makeRng(20261050);
  const step = HILLS.rimStep;
  // Rim owns cell centers r > rimInner. rimInner sits INSIDE hillsOuterRadius
  // by ~2u on purpose: the hills lattice (step 1.6) only guarantees coverage
  // up to hillsOuter - step*sqrt(2) at its boundary fringe (diagonal
  // interstices), so the rim's first row must reach inward past that fringe.
  // Footprint boundary still holds: innermost rim footprint ~50.8u >= pond
  // outer edge 49.23u.
  const inner = HILLS.hillsOuterRadius - 2;
  const outer = rimOuterRadius();
  const foot = HILLS.rimFootprintVoxels * HILLS.step;
  const lo = alignedLo(outer, step);
  const boxes: RimBox[] = [];
  for (let x = lo; x <= outer; x += step) {
    for (let z = lo; z <= outer; z += step) {
      const r = Math.hypot(x, z);
      if (r <= inner || r > outer) continue;
      if (isPondBandCell(x, z)) continue;
      const jx = x + (rng() - 0.5) * step * HILLS.rimJitter;
      const jz = z + (rng() - 0.5) * step * HILLS.rimJitter;
      const rr = Math.hypot(jx, jz);
      const t = Math.max(0, Math.min(1, (rr - inner) / (outer - inner)));
      const extraH = (HILLS.rimMinExtraH + rng() * (HILLS.rimMaxExtraH - HILLS.rimMinExtraH)) * (0.7 + 0.5 * t);
      rng(); // color pick parity with the renderer's draw
      const g = shapedHeight(jx, jz);
      boxes.push({ x: jx, z: jz, half: foot / 2, extraH, top: g + extraH, bottom: g - HILLS.rimSkirt });
    }
  }
  rimCache = boxes;
  return boxes;
}

let rimCache: RimBox[] | null = null;

/**
 * The outer ridge band (was the angular-pitch w×4 DistantRidge — the source
 * of the rectangular footprints and the glancing short-end leaks): the same
 * square world-lattice blocks, cell centers r in (rimOuter, ridgeOuterRadius].
 */
export function ridgeBoxes(): RimBox[] {
  if (ridgeCache) return ridgeCache;
  const rng = makeRng(60222);
  const step = HILLS.rimStep;
  const inner = rimOuterRadius();
  const outer = HILLS.ridgeOuterRadius;
  const foot = HILLS.rimFootprintVoxels * HILLS.step;
  const lo = alignedLo(outer, step);
  const boxes: RimBox[] = [];
  for (let x = lo; x <= outer; x += step) {
    for (let z = lo; z <= outer; z += step) {
      const r = Math.hypot(x, z);
      if (r <= inner || r > outer) continue;
      if (isPondBandCell(x, z)) continue;
      const jx = x + (rng() - 0.5) * step * HILLS.rimJitter;
      const jz = z + (rng() - 0.5) * step * HILLS.rimJitter;
      const extraH = HILLS.ridgeMinExtraH + rng() * (HILLS.ridgeMaxExtraH - HILLS.ridgeMinExtraH);
      rng(); // color pick parity with the renderer's draw
      const g = shapedHeight(jx, jz);
      boxes.push({ x: jx, z: jz, half: foot / 2, extraH, top: g + extraH, bottom: g - HILLS.rimSkirt });
    }
  }
  ridgeCache = boxes;
  return boxes;
}

let ridgeCache: RimBox[] | null = null;

/** the ridge InstancedMesh capacity — one shared source (Sky.tsx) */
export function ridgeInstanceCapacity(): number {
  return ridgeBoxes().length;
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

/** The rendered hills boxes (jittered centers + exact half-extents).
 *  #83 redesign: the hills family extends outward to hillsOuterRadius
 *  (owns cell centers r <= 58, same lattice origin -outerRadius so the phase
 *  is unchanged) — it seals the hills<->rim seam from the inside. */
export function hillsBoxes(): HillsBox[] {
  if (cache) return cache;
  const rng = makeRng(20260101);
  const step = HILLS.step;
  const outer = HILLS.hillsOuterRadius;
  const boxes: HillsBox[] = [];
  const lo = alignedLo(outer, step); // <= -outer, same phase as the historical lattice
  for (let x = lo; x <= outer; x += step) {
    for (let z = lo; z <= outer; z += step) {
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
  // #50/#83: the outer rim ring is part of the rendered rim — a cell covered
  // only by a rim box is not plantable either (the rim is terrain, not
  // meadow). Same exact containment test against the same shared source.
  const rimHalfMax = (HILLS.rimFootprintVoxels * HILLS.step) / 2;
  const rimReach =
    rimOuterRadius() + rimHalfMax + HILLS.rimStep * HILLS.rimJitter * 0.5;
  if (r > rimReach) return false;
  for (const b of rimBoxes()) {
    if (Math.abs(x - b.x) <= b.half && Math.abs(z - b.z) <= b.half) return true;
  }
  return false;
}
