import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRASS_TUFTS } from '../data/polish';
import { terrainHeight } from '../engine/terrain';

/**
 * Grass clumps (#24): blades are BASE-JOINED — every blade's base sits at
 * the clump point and leans outward/upward (pivot at the ground), never
 * top-converged. Distribution clusters into drifts with bare gaps between
 * them (the ?demo=1 flower drifts are the reference), and the greens are
 * the exact Meadow.tsx floor palette so tufts read as part of the lawn.
 * One InstancedMesh (clumps × bladesPerClump, one draw call); sway via
 * per-frame matrices, deterministic phases. No shadows (budget unchanged).
 */
export function GrassTufts() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = GRASS_TUFTS.count * GRASS_TUFTS.bladesPerClump;

  const clumps = useMemo(() => {
    const rng = (n: number) => {
      let s = n;
      return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    };
    const r = rng(20261024);
    // drift centers scattered in the meadow (demo-flower drift reference)
    const drifts: { x: number; z: number }[] = [];
    for (let d = 0; d < GRASS_TUFTS.driftCount; d++) {
      const a = (d / GRASS_TUFTS.driftCount) * Math.PI * 2 + r() * 0.8;
      const rad = 3 + r() * (GRASS_TUFTS.radius - 5);
      drifts.push({ x: Math.cos(a) * rad, z: Math.sin(a) * rad });
    }
    // clumps cluster around drift centers — gaps between drifts stay bare
    const out: {
      x: number;
      z: number;
      blades: { ang: number; lean: number; hScale: number; colorIdx: number; phase: number }[];
    }[] = [];
    let guard = 0;
    while (out.length < GRASS_TUFTS.count && guard < GRASS_TUFTS.count * 40) {
      guard++;
      const drift = drifts[Math.floor(r() * drifts.length)];
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * GRASS_TUFTS.driftRadius;
      const x = drift.x + Math.cos(a) * rad;
      const z = drift.z + Math.sin(a) * rad;
      if (Math.hypot(x, z) > GRASS_TUFTS.radius) continue;
      const blades = [];
      const n = GRASS_TUFTS.bladesPerClump;
      for (let b = 0; b < n; b++) {
        blades.push({
          ang: (b / n) * Math.PI * 2 + r() * 0.5,
          lean: GRASS_TUFTS.fanSpread * (0.7 + r() * 0.6),
          hScale: 0.75 + r() * 0.5,
          colorIdx: Math.floor(r() * GRASS_TUFTS.colors.length),
          phase: r() * Math.PI * 2,
        });
      }
      out.push({ x, z, blades });
    }
    return out;
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    let i = 0;
    for (const clump of clumps) {
      for (const blade of clump.blades) {
        color.set(GRASS_TUFTS.colors[blade.colorIdx]);
        mesh.setColorAt(i, color);
        i++;
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [clumps]);

  const tmpMat = useMemo(() => new THREE.Matrix4(), []);
  const rotY = useMemo(() => new THREE.Matrix4(), []);
  const rotLean = useMemo(() => new THREE.Matrix4(), []);
  const rotSway = useMemo(() => new THREE.Matrix4(), []);
  const scaleVec = useMemo(() => new THREE.Vector3(...GRASS_TUFTS.bladeSize), []);
  const halfHeightMat = useMemo(() => new THREE.Matrix4(), []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    let i = 0;
    for (const clump of clumps) {
      const h = terrainHeight(clump.x, clump.z);
      for (const blade of clump.blades) {
        const sway = Math.sin(t * GRASS_TUFTS.swaySpeed + blade.phase) * GRASS_TUFTS.swayAmplitude;
        const bladeH = GRASS_TUFTS.bladeSize[1] * blade.hScale;
        // BASE-JOINED fan: pivot at the clump point on the ground. The
        // blade box is translated up its own half-height FIRST (in its
        // local frame), then leaned outward — so the base stays planted
        // at the clump center and the tip swings up/outward. Never
        // top-converged: each blade owns its own lean direction.
        tmpMat.makeTranslation(clump.x, h - 0.05, clump.z);
        rotY.makeRotationY(blade.ang);
        tmpMat.multiply(rotY);
        rotLean.makeRotationZ(blade.lean);
        tmpMat.multiply(rotLean);
        rotSway.makeRotationX(sway * 0.4);
        tmpMat.multiply(rotSway);
        // translate along the leaned-up axis by half the blade height
        halfHeightMat.makeTranslation(0, bladeH / 2, 0);
        tmpMat.multiply(halfHeightMat);
        scaleVec.set(GRASS_TUFTS.bladeSize[0], bladeH, GRASS_TUFTS.bladeSize[2]);
        tmpMat.scale(scaleVec);
        mesh.setMatrixAt(i, tmpMat);
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
