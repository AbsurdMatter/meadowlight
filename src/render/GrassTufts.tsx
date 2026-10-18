import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRASS_TUFTS } from '../data/polish';
import { terrainHeight } from '../engine/terrain';

/**
 * Sparse swaying voxel grass tufts scattered across the meadow — the
 * "wind moves grass voxels" feel from DESIGN.md. One InstancedMesh, blades
 * swaying via per-frame instance matrices with a deterministic phase, same
 * technique as the flowers. No shadows cast (they're tiny; the meadow
 * already receives them) to keep the shadow map budget unchanged.
 */
export function GrassTufts() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = GRASS_TUFTS.count;

  const spots = useMemo(() => {
    const rng = (n: number) => {
      let s = n;
      return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    };
    const r = rng(20261018);
    const out: { x: number; z: number; phase: number; colorIdx: number; rot: number }[] = [];
    let guard = 0;
    while (out.length < GRASS_TUFTS.count && guard < GRASS_TUFTS.count * 20) {
      guard++;
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * GRASS_TUFTS.radius;
      out.push({
        x: Math.cos(a) * rad,
        z: Math.sin(a) * rad,
        phase: r() * Math.PI * 2,
        colorIdx: Math.floor(r() * GRASS_TUFTS.colors.length),
        rot: r() * Math.PI,
      });
    }
    return out;
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    spots.forEach((sp, i) => {
      color.set(GRASS_TUFTS.colors[sp.colorIdx]);
      mesh.setColorAt(i, color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [spots]);

  const tmpMat = useMemo(() => new THREE.Matrix4(), []);
  const rotY = useMemo(() => new THREE.Matrix4(), []);
  const tilt = useMemo(() => new THREE.Matrix4(), []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < spots.length; i++) {
      const sp = spots[i];
      const h = terrainHeight(sp.x, sp.z);
      const sway = Math.sin(t * GRASS_TUFTS.swaySpeed + sp.phase) * GRASS_TUFTS.swayAmplitude;
      tmpMat.makeTranslation(sp.x, h + GRASS_TUFTS.bladeSize[1] / 2, sp.z);
      rotY.makeRotationY(sp.rot);
      tmpMat.multiply(rotY);
      tilt.makeRotationZ(sway);
      tmpMat.multiply(tilt);
      tmpMat.scale(new THREE.Vector3(...GRASS_TUFTS.bladeSize));
      mesh.setMatrixAt(i, tmpMat);
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
