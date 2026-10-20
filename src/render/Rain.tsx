import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { scaledDelta } from '../engine/scaledTime';
import * as THREE from 'three';
import { isRaining, RAIN_TUNING } from '../engine/weather';

/**
 * #14 (session 5): gentle voxel rain — thin pale-blue columns falling over
 * the meadow, one instanced mesh, zero cost when dry (count 0). Cozy: no
 * storm darkness, no fail state; the meadow just gets a soft wash.
 */
export const rainDebug = { count: 0, raining: false };

interface Drop {
  x: number;
  z: number;
  y: number;
  speed: number;
  len: number;
}

export function Rain() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const drops = useRef<Drop[]>([]);
  const seeded = useRef(false);

  // #14 blocker fix: park every instance at zero scale on mount and force
  // count 0. three.js InstancedMesh constructors set count = capacity and
  // leave matrices as identity, so an unparked mesh renders `capacity`
  // 1x1x1 unit cubes at the origin (the "floating ghost voxel" over the
  // meadow) until rain first toggles. Park on mount; the dry branch below
  // now also parks unconditionally (it used to skip when rainDebug.count
  // was already 0, which is exactly the boot state).
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const park = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < RAIN_TUNING.drops; i++) mesh.setMatrixAt(i, park);
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const raining = isRaining();
    rainDebug.raining = raining;

    if (raining && !seeded.current) {
      seeded.current = true;
      const list: Drop[] = [];
      for (let i = 0; i < RAIN_TUNING.drops; i++) {
        list.push({
          x: (Math.random() * 2 - 1) * RAIN_TUNING.areaHalf,
          z: (Math.random() * 2 - 1) * RAIN_TUNING.areaHalf,
          y: Math.random() * RAIN_TUNING.top,
          speed: RAIN_TUNING.fallSpeed * (0.85 + Math.random() * 0.3),
          len: 0.5 + Math.random() * 0.5,
        });
      }
      drops.current = list;
    }
    if (!raining) {
      seeded.current = false;
      // unconditional (was guarded by rainDebug.count !== 0, which skipped
      // the boot state and left the constructor's 220 identity-matrix
      // instances rendering as ghost cubes over the meadow)
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
      rainDebug.count = 0;
      return;
    }

    const mat = new THREE.Matrix4();
    let i = 0;
    for (const d of drops.current) {
      const delta = scaledDelta();
      d.y -= d.speed * delta;
      d.x += RAIN_TUNING.windX * delta;
      if (d.y < 0) {
        d.y = RAIN_TUNING.top;
        d.x = (Math.random() * 2 - 1) * RAIN_TUNING.areaHalf;
        d.z = (Math.random() * 2 - 1) * RAIN_TUNING.areaHalf;
      }
      mat.makeScale(0.045, d.len, 0.045);
      mat.setPosition(d.x, d.y, d.z);
      mesh.setMatrixAt(i, mat);
      i++;
    }
    rainDebug.count = i;
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, RAIN_TUNING.drops]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#a8c8e0" transparent opacity={0.5} />
    </instancedMesh>
  );
}
