import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STRUCTURES } from '../data/structures';
import { usePlacementStore } from './placementStore';
import { terrainHeight } from '../engine/terrain';
import { noVariation } from '../engine/variation';

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
  const refs = useRef<{ meshes: Partial<Record<string, THREE.InstancedMesh | null>> }>({
    meshes: {},
  });


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
        for (const part of def.parts) {
          tmpMat.makeTranslation(
            s.position[0],
            terrainHeight(s.position[0], s.position[2]) + variation.heightJitter + s.position[1] - terrainHeight(s.position[0], s.position[2]),
            s.position[2],
          );
          rotYMat.makeRotationY(s.rotationY + variation.rotationY);
          tmpMat.multiply(rotYMat);
          tiltXMat.makeRotationX(swayX + variation.tiltX);
          tmpMat.multiply(tiltXMat);
          tiltZMat.makeRotationZ(swayZ + variation.tiltZ);
          tmpMat.multiply(tiltZMat);
          offsetMat.makeTranslation(part.offset[0], part.offset[1], part.offset[2]);
          tmpMat.multiply(offsetMat);
          scaleMat.makeScale(part.size[0], part.size[1], part.size[2]);
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
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial />
        </instancedMesh>
      ))}
    </group>
  );
}
