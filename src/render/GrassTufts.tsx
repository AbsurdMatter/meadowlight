import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRASS_TUFTS, BUSHLETS } from '../data/polish';
import { groundAt, isGrassSpawnable } from '../engine/ground';

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
  const layout = useMemo(() => {
    // drift centers — seeded by fixed constants (stable across loads).
    // #27: centers ring the OUTSKIRTS — radius drawn from the outer band
    // with probability rising outward; a seeded minority stray inward so
    // it never reads as a perfect ring.
    const drifts: { x: number; z: number }[] = [];
    for (let d = 0; d < GRASS_TUFTS.driftCount; d++) {
      const a = (d / GRASS_TUFTS.driftCount) * Math.PI * 2 + hash2(d, 7, 1) * 0.8;
      const straggler = hash2(d, 13, 2) < GRASS_TUFTS.stragglerChance;
      // outskirts: outer half of the legal radius band, weighted outward;
      // stragglers: anywhere buildable inside it
      const u = hash2(d, 17, 3);
      const inner = straggler ? 2 : GRASS_TUFTS.outskirtsInnerRadius;
      const rad = straggler
        ? inner + u * (GRASS_TUFTS.outskirtsInnerRadius - inner)
        : GRASS_TUFTS.outskirtsInnerRadius +
          Math.sqrt(u) * (GRASS_TUFTS.radius - 2 - GRASS_TUFTS.outskirtsInnerRadius);
      drifts.push({ x: Math.cos(a) * rad, z: Math.sin(a) * rad });
    }
    const out: {
      x: number;
      z: number;
      blades: { ang: number; lean: number; hScale: number; colorIdx: number; phase: number }[];
    }[] = [];
    const bushlets: { x: number; z: number }[] = [];
    let placed = 0;
    let ring = 0;
    while (placed < GRASS_TUFTS.count && ring < GRASS_TUFTS.count * 60) {
      ring++;
      // candidate position: seeded angle + radius around a drift center,
      // with #27's radial bias applied AT THE CLUMP LEVEL too — clumps
      // prefer the outward side of their drift, stragglers allowed inward
      const drift = drifts[ring % drifts.length];
      const a = hash2(ring, 3, 11) * Math.PI * 2;
      const u = hash2(ring, 5, 12);
      // sqrt = area-uniform within the drift; outward bias pushes most
      // clamps past the center-radius, keeping the ring dominant
      const clumpRad = Math.sqrt(u) * GRASS_TUFTS.driftRadius;
      const outward = 0.35 + hash2(ring, 7, 13) * 0.65;
      const driftDir = Math.atan2(drift.z, drift.x || 0.001);
      const biasedA = a * 0.4 + driftDir * 0.6 + (a - Math.PI) * 0.15;
      const x = drift.x + Math.cos(biasedA) * clumpRad;
      const z = drift.z + Math.sin(biasedA) * clumpRad;
      void outward;
      if (Math.hypot(x, z) > GRASS_TUFTS.radius) continue;
      // #26: the ground oracle decides spawnability — never on or beside
      // the waterline, keeping the shoreline a clean sand band
      if (!isGrassSpawnable(x, z)) continue;
      // #27: radial weight — placement probability rises with distance
      // from the meadow center; a few inward stragglers stay for
      // naturalness, so no perfect ring
      const rFromCenter = Math.hypot(x, z);
      const weight = Math.min(1, rFromCenter / GRASS_TUFTS.radius);
      if (hash2(ring, 19, 21) > weight * 0.85 + 0.15) continue;
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
      // #7: a seeded fraction of ACCEPTED clump positions sprout a bushlet —
      // same ring, same rejection sampling, interleaved not stacked
      if (hash2(qx, qz, 777) < BUSHLETS.fraction) {
        bushlets.push({ x, z });
      }
    }
    return { tufts: out, bushlets };
  }, []);
  const tufts = layout.tufts;
  const bushlets = layout.bushlets;

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
      const h = groundAt(tuft.x, tuft.z).height;
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

  // #7: bushlets — static geometry, written once (they don't sway; scrub
  // reads as sturdy next to the moving grass). One extra draw call.
  const bushletRef = useRef<THREE.InstancedMesh>(null);
  const bushletCapacity = GRASS_TUFTS.count * BUSHLETS.parts.length;
  useEffect(() => {
    const mesh = bushletRef.current;
    if (!mesh) return;
    const mat = new THREE.Matrix4();
    const color = new THREE.Color();
    let i = 0;
    for (const b of bushlets) {
      const h = groundAt(b.x, b.z).height;
      for (const part of BUSHLETS.parts) {
        mat.makeScale(part.size[0], part.size[1], part.size[2]);
        mat.setPosition(b.x + part.offset[0], h + part.offset[1], b.z + part.offset[2]);
        mesh.setMatrixAt(i, mat);
        color.set(part.color);
        mesh.setColorAt(i, color);
        i++;
      }
    }
    // park remaining capacity
    mat.makeScale(0, 0, 0);
    for (; i < bushletCapacity; i++) mesh.setMatrixAt(i, mat);
    mesh.count = bushlets.length * BUSHLETS.parts.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [bushlets, bushletCapacity]);

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh
        ref={bushletRef}
        args={[undefined, undefined, bushletCapacity]}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
    </group>
  );
}
