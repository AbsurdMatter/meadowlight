import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MEADOW_SIZE, terrainHeight } from '../engine/terrain';

const GRASS_COLORS = ['#94b364', '#8fae5f', '#87a75a', '#7d9f54'];

export function Meadow() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const n = 44;
    const step = MEADOW_SIZE / n;
    const mat = new THREE.Matrix4();
    const color = new THREE.Color();
    let i = 0;
    for (let ix = 0; ix < n; ix++) {
      for (let iz = 0; iz < n; iz++) {
        const x = -MEADOW_SIZE / 2 + (ix + 0.5) * step;
        const z = -MEADOW_SIZE / 2 + (iz + 0.5) * step;
        const h = terrainHeight(x, z);
        mat.makeScale(step * 1.02, 1.4, step * 1.02);
        mat.setPosition(x, h - 0.75, z);
        mesh.setMatrixAt(i, mat);
        color.set(
          GRASS_COLORS[
            Math.abs(Math.floor(Math.sin(ix * 12.9898 + iz * 78.233) * 43758.5)) %
              GRASS_COLORS.length
          ],
        );
        mesh.setColorAt(i, color);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);

  const count = 44 * 44;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} receiveShadow castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}
