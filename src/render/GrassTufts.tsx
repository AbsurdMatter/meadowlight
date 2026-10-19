import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRASS_TUFTS } from '../data/polish';
import { terrainHeight } from '../engine/terrain';

/**
 * Leafy grass clumps (#23 redesign): each clump is a fan of short, wide
 * blades radiating outward with varied tilt — low-profile and clearly
 * grass at voxel scale, where the old single thin vertical blades read as
 * bare stalks. One InstancedMesh (clumps × bladesPerClump instances, one
 * draw call); sway via per-frame instance matrices with deterministic
 * phases, same technique as the flowers. No shadows cast (tiny; keeps the
 * shadow budget unchanged).
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
    const r = rng(20261018);
    const out: {
      x: number;
      z: number;
      blades: { ang: number; lean: number; hScale: number; colorIdx: number; phase: number }[];
    }[] = [];
    let guard = 0;
    while (out.length < GRASS_TUFTS.count && guard < GRASS_TUFTS.count * 20) {
      guard++;
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * GRASS_TUFTS.radius;
      const blades = [];
      const n = GRASS_TUFTS.bladesPerClump;
      for (let b = 0; b < n; b++) {
        blades.push({
          // fan: angles spread around the clump with jitter
          ang: (b / n) * Math.PI * 2 + r() * 0.5,
          // lean outward — a squat fan, not a vertical stick
          lean: GRASS_TUFTS.fanSpread * (0.7 + r() * 0.6),
          hScale: 0.75 + r() * 0.5,
          colorIdx: Math.floor(r() * GRASS_TUFTS.colors.length),
          phase: r() * Math.PI * 2,
        });
      }
      out.push({ x: Math.cos(a) * rad, z: Math.sin(a) * rad, blades });
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
  const rotZ = useMemo(() => new THREE.Matrix4(), []);
  const rotX = useMemo(() => new THREE.Matrix4(), []);
  const scaleVec = useMemo(() => new THREE.Vector3(...GRASS_TUFTS.bladeSize), []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    let i = 0;
    for (const clump of clumps) {
      const h = terrainHeight(clump.x, clump.z);
      for (const blade of clump.blades) {
        const sway = Math.sin(t * GRASS_TUFTS.swaySpeed + blade.phase) * GRASS_TUFTS.swayAmplitude;
        // blade base sits at the clump center, fanned outward by its angle
        const ox = Math.cos(blade.ang) * 0.06;
        const oz = Math.sin(blade.ang) * 0.06;
        tmpMat.makeTranslation(clump.x + ox, h + (GRASS_TUFTS.bladeSize[1] * blade.hScale) / 2 - 0.05, clump.z + oz);
        rotY.makeRotationY(blade.ang);
        tmpMat.multiply(rotY);
        // outward lean + sway
        rotZ.makeRotationZ(blade.lean + sway * 0.6);
        tmpMat.multiply(rotZ);
        rotX.makeRotationX(sway * 0.3);
        tmpMat.multiply(rotX);
        scaleVec.set(GRASS_TUFTS.bladeSize[0], GRASS_TUFTS.bladeSize[1] * blade.hScale, GRASS_TUFTS.bladeSize[2]);
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
