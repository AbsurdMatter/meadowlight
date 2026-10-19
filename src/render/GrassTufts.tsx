import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRASS_TUFTS } from '../data/polish';
import { terrainHeight } from '../engine/terrain';

/**
 * Leafy grass tufts with per-tuft variety (#25):
 *  - blade count 3-7 per tuft, weighted toward 5 (adjacent tufts differ)
 *  - per-blade length and lean variance
 *  - uneven angular spacing (jittered fan angles)
 *  - POSITION-SEEDED: all randomness derives deterministically from each
 *    tuft's quantized x/z, so the meadow's grass is identical across loads
 *    and sessions (no Math.random anywhere here).
 * Blades are base-joined at the tuft point and fan upward-outward (#24).
 * One InstancedMesh sized for the max blade count; unused slots parked at
 * zero scale. One draw call; sway via per-frame matrices. No shadows.
 */

/**
 * Deterministic 0..1 hash from two integers — stable across loads,
 * no RNG state to persist.
 */
function hash2(x: number, z: number, salt: number): number {
  let h = (x * 374761393 + z * 668265263 + salt * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/** Weighted blade-count pick from the tuning table, seeded per tuft. */
function bladeCountFor(r: number): number {
  const w = GRASS_TUFTS.bladeWeights;
  const total = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    acc += w[i];
    if (r < acc / total) return GRASS_TUFTS.bladesMin + i;
  }
  return GRASS_TUFTS.bladesMin + w.length - 1;
}

export function GrassTufts() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const maxPer = GRASS_TUFTS.bladesMax;
  const count = GRASS_TUFTS.count * maxPer;

  /** per-tuft layout, fully derived from quantized positions (stable) */
  const tufts = useMemo(() => {
    // drift centers — seeded by a fixed constant (stable across loads)
    const drifts: { x: number; z: number }[] = [];
    for (let d = 0; d < GRASS_TUFTS.driftCount; d++) {
      const a = (d / GRASS_TUFTS.driftCount) * Math.PI * 2 + hash2(d, 7, 1) * 0.8;
      const rad = 3 + hash2(d, 13, 2) * (GRASS_TUFTS.radius - 5);
      drifts.push({ x: Math.cos(a) * rad, z: Math.sin(a) * rad });
    }
    const out: {
      x: number;
      z: number;
      blades: { ang: number; lean: number; hScale: number; colorIdx: number; phase: number }[];
    }[] = [];
    let placed = 0;
    let ring = 0;
    while (placed < GRASS_TUFTS.count && ring < GRASS_TUFTS.count * 40) {
      ring++;
      // candidate position from a deterministic spiral index
      const a = ring * 2.399963;
      const rad = Math.sqrt(ring / (GRASS_TUFTS.count * 2)) * GRASS_TUFTS.driftRadius;
      const drift = drifts[ring % drifts.length];
      const jitterA = (hash2(ring, 3, 11) - 0.5) * 1.2;
      const jitterR = (hash2(ring, 5, 12) - 0.5) * 1.0;
      const x = drift.x + Math.cos(a + jitterA) * (rad + jitterR * 0.5);
      const z = drift.z + Math.sin(a + jitterA) * (rad + jitterR * 0.5);
      if (Math.hypot(x, z) > GRASS_TUFTS.radius) continue;
      // quantized seed = stable identity for this tuft
      const qx = Math.round(x * 20);
      const qz = Math.round(z * 20);
      const nBlades = bladeCountFor(hash2(qx, qz, 100));
      const blades = [];
      for (let b = 0; b < nBlades; b++) {
        const sr = (salt: number) => hash2(qx * 31 + b, qz * 17 + b, salt);
        blades.push({
          // uneven angular spacing: jittered fractions of the circle
          ang: (b / nBlades) * Math.PI * 2 + (sr(1) - 0.5) * 1.4,
          // per-blade lean variance
          lean: GRASS_TUFTS.fanSpread * (0.55 + sr(2) * 0.85),
          // per-blade length variance
          hScale: 0.7 + sr(3) * 0.65,
          colorIdx: Math.floor(sr(4) * GRASS_TUFTS.colors.length),
          phase: sr(5) * Math.PI * 2,
        });
      }
      out.push({ x, z, blades });
      placed++;
    }
    return out;
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    let i = 0;
    for (const tuft of tufts) {
      for (const blade of tuft.blades) {
        color.set(GRASS_TUFTS.colors[blade.colorIdx]);
        mesh.setColorAt(i, color);
        i++;
      }
      // park unused capacity slots (up to bladesMax) with a neutral color
      for (let p = tuft.blades.length; p < maxPer; p++) {
        mesh.setColorAt(i, color);
        i++;
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [tufts, maxPer]);

  const tmpMat = useMemo(() => new THREE.Matrix4(), []);
  const parkMat = useMemo(() => new THREE.Matrix4(), []);
  const rotY = useMemo(() => new THREE.Matrix4(), []);
  const rotLean = useMemo(() => new THREE.Matrix4(), []);
  const rotSway = useMemo(() => new THREE.Matrix4(), []);
  const halfHeightMat = useMemo(() => new THREE.Matrix4(), []);
  const scaleVec = useMemo(() => new THREE.Vector3(...GRASS_TUFTS.bladeSize), []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    let i = 0;
    for (const tuft of tufts) {
      const h = terrainHeight(tuft.x, tuft.z);
      for (const blade of tuft.blades) {
        const sway = Math.sin(t * GRASS_TUFTS.swaySpeed + blade.phase) * GRASS_TUFTS.swayAmplitude;
        const bladeH = GRASS_TUFTS.bladeSize[1] * blade.hScale;
        // base-joined fan: pivot at the tuft point on the ground
        tmpMat.makeTranslation(tuft.x, h - 0.05, tuft.z);
        rotY.makeRotationY(blade.ang);
        tmpMat.multiply(rotY);
        rotLean.makeRotationZ(blade.lean);
        tmpMat.multiply(rotLean);
        rotSway.makeRotationX(sway * 0.4);
        tmpMat.multiply(rotSway);
        halfHeightMat.makeTranslation(0, bladeH / 2, 0);
        tmpMat.multiply(halfHeightMat);
        scaleVec.set(GRASS_TUFTS.bladeSize[0], bladeH, GRASS_TUFTS.bladeSize[2]);
        tmpMat.scale(scaleVec);
        mesh.setMatrixAt(i, tmpMat);
        i++;
      }
      // park the unused capacity slots at zero scale (invisible)
      const unused = maxPer - tuft.blades.length;
      for (let p = 0; p < unused; p++) {
        parkMat.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, parkMat);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}
