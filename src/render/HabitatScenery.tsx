import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { scaledDelta, scaledElapsed } from '../engine/scaledTime';
import {
  HABITAT_TUNING,
  cornerFoldCells,
  cornerKey,
  sceneryHash,
} from '../data/habitatScenery';
import { groundAt } from '../engine/ground';
import { LAKE } from '../data/environment';
import { TREES } from '../data/environment';

/**
 * Session 7 U4 (#new): habitat-corner scenery + pond life.
 *
 * The corner folds (hills intruding into the placement square) read as
 * intentional wild corners: bush clusters, rocks, ONE log (the anchor),
 * fern-like plates — laid on the exact fold cells derived from the
 * classifier's own hillsCover footprints (one source). Palette from the
 * hills' own families (the band-palette rule: scenery blends toward what
 * it touches).
 *
 * Pond: forget-me-not-toned edge plants on the shore band + dragonflies
 * over the water (darter flight through the scaled clock — full freeze
 * holds here too).
 *
 * All static scenery EXCEPT the dragonflies: one mesh per family, parked
 * on mount (the ghost-voxel lesson), deterministic layout (no
 * Math.random), heights from the ground oracle.
 */

const park = new THREE.Matrix4().makeScale(0, 0, 0);

interface Piece {
  x: number;
  z: number;
  y: number;
  size: [number, number, number];
  color: string;
  rotY: number;
}

/** build the static corner scenery deterministically from the fold cells */
function buildCornerPieces(): Piece[] {
  const cells = cornerFoldCells();
  const t = HABITAT_TUNING;
  const byCorner = new Map<string, { x: number; z: number }[]>();
  for (const c of cells) {
    const k = cornerKey(c.x, c.z);
    if (!byCorner.has(k)) byCorner.set(k, []);
    byCorner.get(k)!.push(c);
  }
  const out: Piece[] = [];
  for (const [k, list] of byCorner) {
    if (list.length === 0) continue;
    // deterministic per-corner ordering (stable across reloads)
    list.sort((a, b) => (a.x - b.x) * 1000 + (a.z - b.z));
    // density by fraction: a hash gate keeps clusters + gaps (not a solid
    // wall) while filling the fold in proportion to its true extent
    const kept = list.filter(
      (c) => sceneryHash(c.x, c.z, 849) < HABITAT_TUNING.corners.fillFraction,
    );
    const cap = Math.min(t.corners.maxPerCorner, kept.length);
    for (let i = 0; i < cap; i++) {
      const cell = kept[i];
      const g = groundAt(cell.x, cell.z);
      const roll = sceneryHash(cell.x, cell.z, 850 + i);
      // one log in the FIRST (largest) corner only — the anchor piece
      if (k === '--' && i === 0 && out.length === 0) {
        out.push({
          x: cell.x,
          z: cell.z,
          y: g.height + t.log.size[1] / 2 - 0.08,
          size: [...t.log.size] as [number, number, number],
          color: t.log.color,
          rotY: sceneryHash(cell.x, cell.z, 851) * Math.PI,
        });
        continue;
      }
      // families by roll: bushes (most), rocks, ferns
      if (roll < 0.5) {
        const n = t.bushes.perCluster[0] + Math.floor(sceneryHash(cell.x, cell.z, 852) * (t.bushes.perCluster[1] - t.bushes.perCluster[0] + 1));
        for (let b = 0; b < n; b++) {
          const ox = (sceneryHash(cell.x, cell.z, 853 + b) - 0.5) * 1.2;
          const oz = (sceneryHash(cell.x, cell.z, 863 + b) - 0.5) * 1.2;
          const s = t.bushes.size[0] + sceneryHash(cell.x, cell.z, 873 + b) * (t.bushes.size[1] - t.bushes.size[0]);
          const gx = cell.x + ox;
          const gz = cell.z + oz;
          out.push({
            x: gx,
            z: gz,
            y: groundAt(gx, gz).height + s * 0.35,
            size: [s, s * 0.75, s],
            color: t.bushes.colors[Math.floor(sceneryHash(gx, gz, 883) * t.bushes.colors.length)],
            rotY: 0,
          });
        }
      } else if (roll < 0.75) {
        const s = t.rocks.size[0] + sceneryHash(cell.x, cell.z, 884) * (t.rocks.size[1] - t.rocks.size[0]);
        out.push({
          x: cell.x,
          z: cell.z,
          y: g.height + s * 0.3,
          size: [s, s * 0.7, s * 0.9],
          color: t.rocks.colors[Math.floor(sceneryHash(cell.x, cell.z, 885) * t.rocks.colors.length)],
          rotY: sceneryHash(cell.x, cell.z, 886) * Math.PI,
        });
      } else {
        // fern: 2-3 thin stacked plates
        const nPlates = 2 + Math.floor(sceneryHash(cell.x, cell.z, 887) * 2);
        for (let p = 0; p < nPlates; p++) {
          const s = 0.55 - p * 0.12;
          out.push({
            x: cell.x,
            z: cell.z,
            y: g.height + 0.25 + p * 0.28,
            size: [s, 0.08, s],
            color: t.ferns.colors[Math.floor(sceneryHash(cell.x, cell.z, 888 + p) * t.ferns.colors.length)],
            rotY: sceneryHash(cell.x, cell.z, 898 + p) * Math.PI,
          });
        }
      }
    }
  }
  return out;
}

/** pond-edge plants on the shore band ring (deterministic) */
function buildPondEdgePieces(): Piece[] {
  const t = HABITAT_TUNING.pondEdge;
  const out: Piece[] = [];
  for (let i = 0; i < t.count; i++) {
    const a = (i / t.count) * Math.PI * 2 + sceneryHash(i, 7, 900) * 0.35;
    const d = t.ringInner + sceneryHash(i, 11, 901) * (t.ringOuter - t.ringInner);
    const x = LAKE.center[0] + Math.cos(a) * d;
    const z = LAKE.center[1] + Math.sin(a) * d;
    const g = groundAt(x, z);
    if (g.isWater) continue;
    const s = 0.35 + sceneryHash(i, 13, 902) * 0.3;
    out.push({
      x,
      z,
      y: g.height + s * 0.4,
      size: [s, s * 0.9, s],
      color: t.colors[Math.floor(sceneryHash(i, 17, 903) * t.colors.length)],
      rotY: 0,
    });
  }
  return out;
}

/** cozy ground detail around the tree clusters */
function buildTreeDetailPieces(): Piece[] {
  const t = HABITAT_TUNING.treeDetail;
  const out: Piece[] = [];
  TREES.clusters.forEach((cluster, ci) => {
    const n = t.perCluster[0] + Math.floor(sceneryHash(ci, 23, 910) * (t.perCluster[1] - t.perCluster[0] + 1));
    for (let i = 0; i < n; i++) {
      const a = sceneryHash(ci, i, 911) * Math.PI * 2;
      const r = 1.5 + sceneryHash(i, ci, 912) * t.radius;
      const x = cluster.x + Math.cos(a) * r;
      const z = cluster.z + Math.sin(a) * r;
      const s = 0.4 + sceneryHash(i, 29, 913) * 0.45;
      out.push({
        x,
        z,
        y: groundAt(x, z).height + s * 0.3,
        size: [s, s * 0.6, s],
        color: t.colors[Math.floor(sceneryHash(i, 31, 914) * t.colors.length)],
        rotY: 0,
      });
    }
  });
  return out;
}

function StaticSceneryMesh({ pieces, castShadow = true }: { pieces: Piece[]; castShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = pieces.length;
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const mat = new THREE.Matrix4();
    const rot = new THREE.Matrix4();
    const col = new THREE.Color();
    pieces.forEach((p, i) => {
      mat.makeTranslation(p.x, p.y, p.z);
      if (p.rotY !== 0) {
        rot.makeRotationY(p.rotY);
        mat.multiply(rot);
      }
      const s = new THREE.Matrix4().makeScale(p.size[0], p.size[1], p.size[2]);
      mat.multiply(s);
      mesh.setMatrixAt(i, mat);
      mesh.setColorAt(i, col.set(p.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [pieces]);
  // park on mount if empty
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || count > 0) return;
    mesh.setMatrixAt(0, park);
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
  }, [count]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, count)]} castShadow={castShadow} receiveShadow frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}

/** dragonflies over the pond — darter flight on the shared scaled clock */
export const dragonflyDebug = { count: 0 };

function Dragonflies() {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const wingRef = useRef<THREE.InstancedMesh>(null);
  const t = HABITAT_TUNING.dragonflies;
  const count = t.count;
  const state = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        a: (i / count) * Math.PI * 2,
        r: LAKE.radius * (0.35 + 0.3 * ((i * 37) % 10) / 10),
        h: t.heightMin + (((i * 53) % 10) / 10) * (t.heightMax - t.heightMin),
        pos: new THREE.Vector3(
          LAKE.center[0] + 2,
          LAKE.center[1] + t.heightMin,
          0,
        ),
        vel: new THREE.Vector3(),
        hoverUntil: 0,
        phase: (i * 2.399) % (Math.PI * 2),
      })),
    [count, t.heightMin, t.heightMax],
  );
  const mat = useMemo(() => new THREE.Matrix4(), []);
  const rot = useMemo(() => new THREE.Matrix4(), []);
  const scale = useMemo(() => new THREE.Matrix4(), []);
  const waterY = useMemo(
    () => groundAt(LAKE.center[0], LAKE.center[1]).height,
    [],
  );

  useEffect(() => {
    // park on mount (the ghost-voxel lesson)
    for (const ref of [bodyRef, wingRef]) {
      const m = ref.current;
      if (!m) continue;
      for (let i = 0; i < count; i++) m.setMatrixAt(i, park);
      m.count = 0;
      m.instanceMatrix.needsUpdate = true;
    }
  }, [count]);

  useDragonflyFrame(state, bodyRef, wingRef, mat, rot, scale, waterY);
  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={t.bodySize} />
        <meshLambertMaterial color={t.bodyColor} />
      </instancedMesh>
      <instancedMesh ref={wingRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[t.bodySize[0] * 5, t.bodySize[1] * 0.15, t.bodySize[2] * 0.7]} />
        <meshLambertMaterial color={t.wingColor} transparent opacity={t.wingOpacity} />
      </instancedMesh>
    </group>
  );
}

function useDragonflyFrame(
  state: DragoState[],
  bodyRef: React.RefObject<THREE.InstancedMesh | null>,
  wingRef: React.RefObject<THREE.InstancedMesh | null>,
  mat: THREE.Matrix4,
  rot: THREE.Matrix4,
  scale: THREE.Matrix4,
  waterY: number,
) {
  useFrame(() => {
    const body = bodyRef.current;
    const wings = wingRef.current;
    if (!body || !wings) return;
    const delta = scaledDelta();
    const t = scaledElapsed();
    const cfg = HABITAT_TUNING.dragonflies;
    const up = new THREE.Vector3(0, 1, 0);
    const look = new THREE.Vector3();
    for (let i = 0; i < state.length; i++) {
      const d = state[i];
      if (delta > 0) {
        if (t < d.hoverUntil) {
          // hover: hold position with a tiny jitter
          d.pos.x += Math.sin(t * 9 + d.phase) * 0.004;
          d.pos.z += Math.cos(t * 8 + d.phase) * 0.004;
        } else {
          // dart: pick a new heading over the pond and go
          const na = d.a + Math.sin(t * 0.7 + d.phase * 2) * 1.4 + (Math.sin(i * 12.3) * 0.8);
          const nr = LAKE.radius * (0.2 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.31 + d.phase)));
          const nh = waterY + cfg.heightMin + (cfg.heightMax - cfg.heightMin) * (0.5 + 0.5 * Math.sin(t * 0.83 + d.phase * 3));
          look.set(LAKE.center[0] + Math.cos(na) * nr, nh, LAKE.center[1] + Math.sin(na) * nr);
          const to = look.clone().sub(d.pos);
          const dist = to.length();
          if (dist < 0.8) {
            d.hoverUntil = t + cfg.hoverSeconds[0] + Math.abs(Math.sin(i * 7.7)) * (cfg.hoverSeconds[1] - cfg.hoverSeconds[0]);
          } else {
            to.normalize().multiplyScalar(cfg.speed);
            d.vel.lerp(to, Math.min(1, delta * 4));
            d.pos.addScaledVector(d.vel, delta);
          }
        }
      }
      const bob = Math.sin(t * 5 + d.phase) * 0.05;
      rot.lookAt(d.pos, look.set(d.pos.x + d.vel.x, d.pos.y + bob, d.pos.z + d.vel.z), up);
      rot.setPosition(0, 0, 0);
      mat.makeTranslation(d.pos.x, d.pos.y + bob, d.pos.z);
      mat.multiply(rot);
      body.setMatrixAt(i, mat);
      const flap = Math.abs(Math.sin(t * 26 + d.phase)) * 0.85 + 0.15;
      scale.makeScale(flap, 1, 1);
      mat.multiply(scale);
      wings.setMatrixAt(i, mat);
    }
    dragonflyDebug.count = state.length;
    body.count = state.length;
    wings.count = state.length;
    body.instanceMatrix.needsUpdate = true;
    wings.instanceMatrix.needsUpdate = true;
  });
}

interface DragoState {
  a: number;
  r: number;
  h: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  hoverUntil: number;
  phase: number;
}

export function HabitatScenery() {
  const cornerPieces = useMemo(buildCornerPieces, []);
  const pondPieces = useMemo(buildPondEdgePieces, []);
  const treePieces = useMemo(buildTreeDetailPieces, []);
  return (
    <group>
      <StaticSceneryMesh pieces={cornerPieces} />
      <StaticSceneryMesh pieces={pondPieces} />
      <StaticSceneryMesh pieces={treePieces} />
      <Dragonflies />
    </group>
  );
}
