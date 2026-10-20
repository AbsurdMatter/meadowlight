import { LAKE, HILLS } from './environment';
import { isPlantableCell } from '../engine/ground';
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
  /** pond-edge plants: forget-me-not is already in the roster (fact reuse) */
  pondEdge: {
    /** the band ring where edge plants sit (on terrain, outside water) */
    ringInner: LAKE.radius + 0.6,
    ringOuter: LAKE.radius + LAKE.shoreWidth * 0.9,
    count: 14,
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

/** deterministic 0..1 hash for scenery layout (the grass pattern's math) */
export function sceneryHash(x: number, z: number, salt: number): number {
  let h = (x * 374761393 + z * 668265263 + salt * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
