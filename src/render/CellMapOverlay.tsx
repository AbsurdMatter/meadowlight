import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { groundAt, isPlantableCell } from '../engine/ground';
import { MEADOW_SIZE } from '../engine/terrain';
import { LAKE } from '../data/environment';

/**
 * #30 cell-map debug overlay (dev/test only, mounted by the P panel).
 *
 * Renders one flat color quad per terrain cell, classified by the SAME
 * ground-oracle calls the placement/grass/drift systems make — never a
 * re-derivation that can drift:
 *   - plantable   (groundAt().kind === 'meadow' — exactly what isBuildable()
 *                  accepts; the demo seeder and placement ray use this)
 *   - shoreline   (kind === 'shore' — the sandy band; placement rejects it)
 *   - water       (kind === 'water' outside the pond disc — none today, but
 *                  the classification reads the oracle, not local knowledge)
 *   - pond bottom (inside the pond disc, at pondFloorHeight — the floor the
 *                  translucent water renders over)
 *   - non-plantable terrain (kind === 'meadow' is false and no pond — the
 *                  lifted hills outside the meadow square)
 * The meadow square's edge is drawn as a white outline — placement clamps to
 * it, so the eye can compare the square against the colored area at a glance.
 *
 * Mount model: the P panel (DOM) toggles this layer through a tiny external
 * store; the layer itself renders INSIDE the main Canvas scene, so the quads
 * land at the exact world coordinates the placement ray, grass drifts, and
 * the pond renderer work with — no second projection to drift.
 */

/** external visibility store — the P panel writes, the scene layer reads */
let visible = false;
const listeners = new Set<(v: boolean) => void>();
export function setCellMapVisible(v: boolean) {
  visible = v;
  listeners.forEach((l) => l(v));
}
export function cellMapVisible() {
  return visible;
}
export function subscribeCellMap(fn: (v: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const CELL_STEP = 1.6;
const AREA = 112;

export const CELL_KINDS = [
  { id: 'plantable', label: 'plantable', color: '#7a9d54' },
  { id: 'shore', label: 'shoreline band', color: '#e7cf9a' },
  { id: 'water', label: 'water', color: '#5aa0c8' },
  { id: 'pondBottom', label: 'pond bottom', color: '#3f7a6e' },
  { id: 'terrain', label: 'non-plantable terrain', color: '#8a7350' },
] as const;
type CellKind = (typeof CELL_KINDS)[number]['id'];

interface Cell {
  key: string;
  x: number;
  z: number;
  y: number;
  kind: CellKind;
}

function classifyCells(): Cell[] {
  const out: Cell[] = [];
  const half = AREA / 2;
  for (let x = -half + CELL_STEP / 2; x < half; x += CELL_STEP) {
    for (let z = -half + CELL_STEP / 2; z < half; z += CELL_STEP) {
      // the exact call isBuildable()/isGrassSpawnable() make internally
      const g = groundAt(x, z);
      const inPond = g.isWater && g.lakeDistance <= LAKE.radius;
      // placement can only ever land inside the meadow square: the click path
      // clamps to it (clampToMeadow) BEFORE asking isBuildable — so a cell is
      // PLANTABLE only when both hold. Everything else that is dry land is
      // non-plantable terrain (the lifted hills).
      const inPlacementBox = isPlantableCell(x, z);
      const kind: CellKind = inPond
        ? 'pondBottom'
        : g.kind === 'water'
          ? 'water'
          : g.kind === 'shore'
            ? 'shore'
            : g.kind === 'meadow' && inPlacementBox
              ? 'plantable'
              : 'terrain';
      out.push({
        key: `${x.toFixed(1)},${z.toFixed(1)}`,
        x,
        z,
        // flat colors: pond floor quads sit at the carved floor height so the
        // mask shows the pond depression itself, everything else floats just
        // above the oracle surface so the quad is topmost
        y: inPond ? g.height - LAKE.carveDepth + 0.05 : g.height + 0.05,
        kind,
      });
    }
  }
  return out;
}

const KIND_COLOR: Record<CellKind, string> = {
  plantable: '#7a9d54',
  shore: '#e7cf9a',
  water: '#5aa0c8',
  pondBottom: '#3f7a6e',
  terrain: '#8a7350',
};

/**
 * Scene-side layer: rendered inside the main Canvas (App scene tree), so the
 * colored quads land at the exact world coordinates the placement ray,
 * grass drifts, and the pond renderer work with — same groundAt() calls, no
 * second projection. Toggle state comes from the external store the P panel
 * drives; the layer mounts lazily (default off) and cleans up on unmount.
 */
export function CellMapLayer() {
  const [on, setOn] = useState(cellMapVisible());
  useEffect(() => subscribeCellMap(setOn), []);
  const cells = useMemo(classifyCells, []);
  if (!on) return null;
  return (
    <group name="cellMapOverlay" renderOrder={10}>
      {cells.map((c) => (
        <mesh key={c.key} position={[c.x, c.y, c.z]} renderOrder={999}>
          <planeGeometry args={[CELL_STEP * 0.92, CELL_STEP * 0.92]} />
          <meshBasicMaterial
            color={KIND_COLOR[c.kind]}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      ))}
      <lineSegments renderOrder={1000}>
        <edgesGeometry args={[new THREE.BoxGeometry(MEADOW_SIZE - 2, 0.1, MEADOW_SIZE - 2)]} />
        <lineBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
