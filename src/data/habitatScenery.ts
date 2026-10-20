import { LAKE, HILLS } from './environment';
import { isPlantableCell, groundAt } from '../engine/ground';
import { hillsCover } from '../engine/hillsLayout';
import { MEADOW_SIZE } from '../engine/terrain';

/**
 * Session 7 U4 (#new): pond, tree & habitat-corner scenery.
 *
 * HABITAT CORNERS (the session-6 user decision): the hills intrude into the
 * placement square's corner wedges where NOTHING can be planted (the
 * raw-query fold cells) — those folds must read as intentional wild
 * corners, never empty seams. Scenery ONLY, no placement mechanics.
 *
 * ONE SOURCE (the classification-is-layout-key rule): a corner-scenery
 * piece may sit exactly where a rendered hills box covers a cell inside
 * the placement box — derived from the exact hillsCover footprints the
 * placement classifier uses (engine/hillsLayout), never a re-derivation.
 *
 * PALETTE (the band-palette lesson): scenery blends toward what it
 * touches — bushes/ferns in the hills' own colors near hills, shore
 * grasses near the pond band. Never a new pasted surface.
 *
 * DRAGONFLIES: over the pond (darter flight, brief rests on the wing),
 * composing with the wild-visitor steering family. Facts verified with
 * in-file citations.
 */

export const HABITAT_TUNING = {
  /** corner scenery: bush clusters, rocks, a log, fern-like detail */
  /**
   * The organic extension band (the fringe): scenery beyond the box edge.
   * Named rule in fringeCells() — unit-tested like the fold rule.
   */
  extension: {
    /** probe density for the outside strips */
    probeSpacing: 0.8,
    /** how far beyond the box edge the fringe reaches (world units) */
    depth: 4.5,
    /** base fill fraction at the box edge, dissolving outward */
    fillFraction: 0.3,
  },
  corners: {
    /** probe density: cells probed per corner fold region */
    probeSpacing: 0.8,
    /**
     * density: the fraction of probed fold cells that carry a piece. The
     * fold strips are large (measured ~613 probed cells at 0.8 spacing);
     * a fixed per-corner count left them mostly empty (the seam the
     * unit exists to kill). A fraction fills the fold in proportion to
     * its true extent, still cozy: not every cell, clusters and gaps.
     */
    fillFraction: 0.34,
    /** hard ceiling per corner, whatever the fraction yields */
    maxPerCorner: 60,
  },
  bushes: {
    /** cluster sizes */
    perCluster: [2, 4] as [number, number],
    size: [0.7, 1.1] as [number, number],
    /** the hills' own families (band-palette rule) */
    colors: HILLS.hillColors,
  },
  rocks: {
    perCorner: [1, 3] as [number, number],
    size: [0.4, 0.9] as [number, number],
    colors: ['#8d8d84', '#7c7c74', '#9a9a90'],
  },
  log: {
    /** ONE log per world, in the largest fold (the anchor piece) */
    size: [2.4, 0.45, 0.55] as [number, number, number],
    color: '#6b4a2a',
    endColor: '#8a6a45',
  },
  ferns: {
    /** fern-like detail: thin stacked plates, the meadow-green family */
    perCorner: [3, 6] as [number, number],
    colors: ['#4f7a3c', '#5d8a48', '#446e35'],
  },
  /**
   * Pond edge (U4 revision, user verdict #6297184564): the shore ring read
   * too symmetrical — a regular band. The fix is CONTROLLED VARIANCE, not
   * jitter (the session-3 lesson: jitter clashed with the voxel language):
   * the shoreline is split into SEGMENTS; each segment carries its own
   * seeded density, cluster size, and band width/depth derived from a
   * seeded noise curve along the shore angle — organic, deterministic,
   * and assertible (per-segment variance must be non-zero and bounded).
   */
  pondEdge: {
    /** the band ring where edge plants sit (on terrain, outside water) */
    ringInner: LAKE.radius + 0.6,
    ringOuter: LAKE.radius + LAKE.shoreWidth * 0.9,
    /** the ring is split into this many angular segments */
    segments: 12,
    /**
     * CLUSTER-FIRST placement (verdict #6297695941: the 12-segment variance
     * read as scattered singles): each segment now carries seeded CLUSTER
     * CENTERS (1-2 per segment) with 3-5 TIGHT members each — visible
     * groups with calm gaps between them, variance between segments AND
     * clustered-within-segment, never per-item dithering.
     */
    density: { min: 1, max: 5 } as { min: number; max: number },
    /** clusters per segment (seeded) */
    clustersPerSegment: { min: 1, max: 2 } as { min: number; max: number },
    /** members per cluster — tight groups of 3-5 */
    membersPerCluster: { min: 3, max: 5 } as { min: number; max: number },
    /** how tight a cluster reads (radius around its center, world units) */
    clusterRadius: { min: 0.35, max: 0.8 } as { min: number; max: number },
    /** cluster sizes: some segments carry tight clusters, some loose */
    clusterSpread: { min: 0.35, max: 1.4 } as { min: number; max: number },
    /** the band's width/depth drift along the shore via a seeded noise
     *  curve: fraction of the ring that is "wet fringe" vs "dry grass" */
    bandDrift: { min: 0.15, max: 0.85 } as { min: number; max: number },
    /** the shore band's own family + a hint of the flower for reads */
    colors: ['#7a9d54', '#6f9fd8', '#89b4e6'],
  },
  dragonflies: {
    /** darter flight over the pond: fast, jagged, brief hovering */
    speed: 4.2,
    hoverSeconds: [0.4, 1.4] as [number, number],
    bodySize: [0.12, 0.07, 0.26] as [number, number, number],
    bodyColor: '#2a7ac9',
    wingColor: '#bfe3f2',
    wingOpacity: 0.55,
    count: 3,
    /** flight ceiling above water */
    heightMin: 0.9,
    heightMax: 2.2,
    /**
     * verified: dragonflies are aerial predators hunting small insects on
     * the wing over water; their larvae (nymphs) develop in the pond
     * (British Dragonfly Society, "Dragonflies and damselflies of Britain");
     * odonates are among the most ancient flying insects (Natural History
     * Museum, odonata facts).
     */
    fact: 'A dragonfly is a tiny fighter pilot of the pond \u2014 it catches its food in mid-air, and its young grow up underwater as nymphs, sometimes for years.',
  },
  /** cozy ground detail around the background tree clusters (scenery) */
  treeDetail: {
    perCluster: [10, 14] as [number, number],
    radius: 1.8,
    colors: HILLS.hillColors,
  },
} as const;

/**
 * The ORGANIC EXTENSION (U4 revision, user verdict #6297184564): scenery
 * bleeds beyond the placement box so the habitat reads as one continuous
 * fringe, not decorated corners. THE RULE, named (the layout key):
 *
 *   A cell carries fringe scenery when EITHER:
 *   (a) FOLD — inside the box: covered by a rendered hills box AND
 *       unplantable by the one shared classification (the original rule,
 *       unchanged); or
 *   (b) FRINGE — outside the box (but within the extension band):
 *       within `extensionDepth` of the box edge, on dry land (the ground
 *       oracle says meadow — never water/shore), and carried by a soft
 *       seeded falloff so the fringe dissolves outward (never a hard ring).
 *
 *   The one-source rule holds: inside the box, ONLY cells the classifier
 *   proves unplantable; the fringe never steals plantable ground, and
 *   nothing floats (heights always from the ground oracle).
 */
export function fringeCells(): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const t = HABITAT_TUNING.extension;
  const halfBox = MEADOW_SIZE / 2;
  const step = t.probeSpacing;
  // probe the four outside strips (one per box side), depth = extensionDepth
  for (let x = -halfBox - t.depth; x <= halfBox + t.depth; x += step) {
    for (let z = -halfBox - t.depth; z <= halfBox + t.depth; z += step) {
      const insideBox = Math.abs(x) <= halfBox - 1 && Math.abs(z) <= halfBox - 1;
      if (insideBox) continue; // the fold rule owns the inside
      const outsideBand = Math.abs(x) > halfBox || Math.abs(z) > halfBox;
      if (!outsideBand) continue;
      const edgeDist = Math.max(Math.abs(x) - halfBox, Math.abs(z) - halfBox);
      if (edgeDist > t.depth) continue;
      // the ground oracle decides kind: dry land only (never water/shore)
      const g = groundAt(x, z);
      if (g.kind !== 'meadow') continue;
      // soft seeded falloff: density dissolves outward (no hard ring edge)
      const falloff = 1 - edgeDist / t.depth;
      if (sceneryHash(x, z, 970) < falloff * t.fillFraction) {
        out.push({ x, z });
      }
    }
  }
  return out;
}

/**
 * The corner-fold regions: the four corner wedges of the placement square
 * where the radial hills intrude. Derived, deterministic, and READ FROM the
 * same footprints the classifier uses. Each region is probed on a grid;
 * a cell is a FOLD cell when it lies inside the placement box's margin
 * AND is covered by a rendered hills box (the raw query).
 */
export function cornerFoldCells(): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const half = MEADOW_SIZE / 2 - 1;
  const step = HABITAT_TUNING.corners.probeSpacing;
  // The fold is the FULL covered-unplantable region INSIDE the placement
  // box: the hills' radial lattice reaches in along the box's whole edge
  // near each corner (measured: cells at |x|=21 span ~18u of z) — not a
  // tight corner wedge. The census IS the raw query: covered by a
  // rendered hills box AND unplantable by the one shared classification.
  // Scenery may sit ONLY on these cells (it never steals plantable ground
  // and never floats outside the box).
  for (let x = -half; x <= half; x += step) {
    for (let z = -half; z <= half; z += step) {
      if (hillsCover(x, z) && !isPlantableCell(x, z)) {
        out.push({ x, z });
      }
    }
  }
  return out;
}

/** the four corner regions keyed by quadrant sign, for per-corner caps */
export function cornerKey(x: number, z: number): string {
  return `${x < 0 ? '-' : '+'}${z < 0 ? '-' : '+'}`;
}

/**
 * The pond-edge layout (ONE source, the layout key): per-segment parameters
 * derived from seeded noise along the shore angle. Exported for unit tests
 * and the gate's asymmetry assertion — the renderer consumes exactly this.
 *
 * The noise is a smooth seeded curve (not per-plant jitter): segment s's
 * parameters derive from hashes of ITS OWN index, so neighboring segments
 * can differ, but each segment is internally coherent — clusters read as
 * clusters, gaps as gaps. That is the controlled-variance model: variance
 * BETWEEN segments, calm WITHIN each.
 */
export interface PondSegment {
  /** segment index, 0..segments-1 */
  index: number;
  /** plants this segment carries (density.min..density.max) */
  plants: number;
  /** cluster spread factor (tight..loose) */
  spread: number;
  /** how far into the ring band this segment's plants sit (0..1) */
  bandDepth: number;
  /** band width fraction for this segment (0..1 of ringInner..ringOuter) */
  bandWidth: number;
}

export interface PondCluster {
  /** the cluster's seeded center angle within the segment (radians) */
  angle: number;
  /** the cluster's seeded radial position (world units from pond center) */
  distance: number;
  /** members (3-5), each a seeded tight offset from the center */
  members: { x: number; z: number }[];
}

export function pondSegments(): PondSegment[] {
  const t = HABITAT_TUNING.pondEdge;
  const out: PondSegment[] = [];
  for (let s = 0; s < t.segments; s++) {
    const densityRoll = sceneryHash(s, 101, 950);
    const spreadRoll = sceneryHash(s, 103, 951);
    const depthRoll = sceneryHash(s, 107, 952);
    const widthRoll = sceneryHash(s, 109, 953);
    out.push({
      index: s,
      plants: t.density.min + Math.floor(densityRoll * (t.density.max - t.density.min + 1)),
      spread: t.clusterSpread.min + spreadRoll * (t.clusterSpread.max - t.clusterSpread.min),
      bandDepth: t.bandDrift.min + depthRoll * (t.bandDrift.max - t.bandDrift.min),
      bandWidth: 0.3 + widthRoll * 0.6,
    });
  }
  return out;
}

/**
 * The cluster-first shore layout (the verdict's model): seeded cluster
 * centers per segment, each with a tight 3-5 member group. Deterministic;
 * the renderer consumes exactly this. Cluster centers spread within the
 * segment; members spread within clusterRadius of their center — groups
 * read as groups, gaps stay calm.
 */
export function pondClusters(): PondCluster[] {
  const t = HABITAT_TUNING.pondEdge;
  const segs = pondSegments();
  const out: PondCluster[] = [];
  for (const seg of segs) {
    const a0 = (seg.index / t.segments) * Math.PI * 2;
    const a1 = ((seg.index + 1) / t.segments) * Math.PI * 2;
    const bandLo = t.ringInner + (t.ringOuter - t.ringInner) * seg.bandDepth * (1 - seg.bandWidth);
    const bandHi =
      t.ringInner + (t.ringOuter - t.ringInner) * Math.min(1, seg.bandDepth + seg.bandWidth * 0.5);
    const nClusters =
      t.clustersPerSegment.min +
      Math.floor(sceneryHash(seg.index, 113, 959) * (t.clustersPerSegment.max - t.clustersPerSegment.min + 1));
    for (let c = 0; c < nClusters; c++) {
      const angle = a0 + ((c + 0.5) / nClusters) * (a1 - a0) +
        (sceneryHash(seg.index, c + 3, 960) - 0.5) * (a1 - a0) * 0.3;
      const distance = bandLo + sceneryHash(seg.index, c + 7, 961) * Math.max(0.001, bandHi - bandLo);
      const members: { x: number; z: number }[] = [];
      const nMembers =
        t.membersPerCluster.min +
        Math.floor(sceneryHash(seg.index, c + 11, 962) * (t.membersPerCluster.max - t.membersPerCluster.min + 1));
      const radius =
        t.clusterRadius.min + sceneryHash(seg.index, c + 13, 963) * (t.clusterRadius.max - t.clusterRadius.min);
      for (let m = 0; m < nMembers; m++) {
        const ma = sceneryHash(seg.index, c * 31 + m, 964) * Math.PI * 2;
        const mr = Math.sqrt(sceneryHash(seg.index, c * 17 + m, 965)) * radius;
        members.push({
          x: LAKE.center[0] + Math.cos(angle) * distance + Math.cos(ma) * mr,
          z: LAKE.center[1] + Math.sin(angle) * distance + Math.sin(ma) * mr,
        });
      }
      out.push({ angle, distance, members });
    }
  }
  return out;
}

/** deterministic 0..1 hash for scenery layout (the grass pattern's math) */
export function sceneryHash(x: number, z: number, salt: number): number {
  let h = (x * 374761393 + z * 668265263 + salt * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
