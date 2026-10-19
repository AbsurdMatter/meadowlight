import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { STRUCTURES } from '../data/structures';
import { usePlacementStore } from './placementStore';
import { noVariation } from '../engine/variation';

/** Deterministic 0..1 hash from two integers (the grass pattern) — stable
 *  across reloads, no RNG state, saves stay byte-stable. */
function hash2(x: number, z: number, salt: number): number {
  let h = (x * 374761393 + z * 668265263 + salt * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}


const tmpMat = new THREE.Matrix4();
const rotYMat = new THREE.Matrix4();
const tiltXMat = new THREE.Matrix4();
const tiltZMat = new THREE.Matrix4();
const offsetMat = new THREE.Matrix4();
const scaleMat = new THREE.Matrix4();
const tmpColor = new THREE.Color();

/** generous fixed capacity per structure type (never recreated on place/remove) */
const CAPACITY_PER_STRUCTURE = 60;

export function PlacedStructures() {
  const structures = usePlacementStore((s) => s.structures);
  const openNotebook = usePlacementStore((s) => s.openNotebook);
  const refs = useRef<{ meshes: Partial<Record<string, THREE.InstancedMesh | null>> }>({
    meshes: {},
  });

  const onClick = (e: ThreeEvent<MouseEvent>, structureId: string) => {
    e.stopPropagation();
    const s = usePlacementStore.getState();
    if (s.selectedPlantId || s.selectedStructureId) return;
    openNotebook({ kind: 'structure', id: structureId });
  };

  useFrame(({ clock }) => {
    const r = refs.current;
    const t = clock.elapsedTime;
    for (const def of STRUCTURES) {
      const mesh = r.meshes[def.id];
      if (!mesh) continue;
      let i = 0;
      for (const s of structures) {
        if (s.structureId !== def.id) continue;
        const variation = s.variation ?? noVariation();
        const swayZ = Math.sin(t * 0.5 + i * 1.7) * 0.012;
        const swayX = Math.cos(t * 0.4 + i * 2.3) * 0.008;
        // PR #35 polish: bushes are objects — deterministic per-instance
        // Y-rotation + slight scale jitter from the quantized saved
        // position (the grass hash2 pattern: stable across reloads, no
        // Math.random, saves stay byte-stable). Bushes only; other
        // structures keep their authored orientation.
        let bushRotY = 0;
        let bushScale = 1;
        if (s.structureId === 'bush') {
          const qx = Math.round(s.position[0] * 20);
          const qz = Math.round(s.position[2] * 20);
          bushRotY = hash2(qx, qz, 901) * Math.PI * 2;
          bushScale = 0.88 + hash2(qx, qz, 902) * 0.28;
        }
        for (const part of def.parts) {
          tmpMat.makeTranslation(
            s.position[0],
            s.position[1] + variation.heightJitter,
            s.position[2],
          );
          rotYMat.makeRotationY(s.rotationY + variation.rotationY + bushRotY);
          tmpMat.multiply(rotYMat);
          tiltXMat.makeRotationX(swayX + variation.tiltX);
          tmpMat.multiply(tiltXMat);
          tiltZMat.makeRotationZ(swayZ + variation.tiltZ);
          tmpMat.multiply(tiltZMat);
          offsetMat.makeTranslation(part.offset[0], part.offset[1], part.offset[2]);
          tmpMat.multiply(offsetMat);
          scaleMat.makeScale(
            part.size[0] * bushScale,
            part.size[1] * bushScale,
            part.size[2] * bushScale,
          );
          tmpMat.multiply(scaleMat);
          mesh.setMatrixAt(i, tmpMat);
          mesh.setColorAt(i, tmpColor.set(part.color));
          i++;
        }
      }
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {STRUCTURES.map((def) => (
        <instancedMesh
          key={def.id}
          ref={(m) => {
            refs.current.meshes[def.id] = m;
          }}
          args={[undefined, undefined, CAPACITY_PER_STRUCTURE * def.parts.length]}
          castShadow
          receiveShadow
          frustumCulled={false}
          onClick={(e) => onClick(e, def.id)}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial />
        </instancedMesh>
      ))}
    </group>
  );
}
