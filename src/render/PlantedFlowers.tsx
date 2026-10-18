import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANTS } from '../data/plants';
import { usePlacementStore } from './placementStore';
import { noVariation } from '../engine/variation';

const tmpColor = new THREE.Color();
const tmpMat = new THREE.Matrix4();
const rotYMat = new THREE.Matrix4();
const swayXMat = new THREE.Matrix4();
const swayZMat = new THREE.Matrix4();
const tiltXMat = new THREE.Matrix4();
const tiltZMat = new THREE.Matrix4();
const offsetMat = new THREE.Matrix4();
const scaleMat = new THREE.Matrix4();

/** generous fixed capacity per species — meshes are never recreated on plant/remove */
const CAPACITY_PER_SPECIES = 400;

function FlowerInstances() {
  const items = usePlacementStore((s) => s.items);
  const refs = useRef<{ meshes: Record<string, THREE.InstancedMesh | null> }>({
    meshes: {},
  });
  useFrame(({ clock }) => {
    const r = refs.current;
    const t = clock.elapsedTime;
    for (const def of PLANTS) {
      const mesh = r.meshes[def.id];
      if (!mesh) continue;
      let i = 0;
      for (const item of items) {
        if (item.plantId !== def.id) continue;
        const variation = item.variation ?? noVariation();
        const swayZ = Math.sin(t * 0.9 + item.phase) * def.sway;
        const swayX = Math.cos(t * 0.7 + item.phase * 1.3) * def.sway * 0.5;
        for (let pi = 0; pi < def.parts.length; pi++) {
          const part = def.parts[pi];
          const partSway = part.offset[1] / Math.max(def.height, 0.001);
          tmpMat.makeTranslation(
            item.position[0],
            item.position[1] + variation.heightJitter,
            item.position[2],
          );
          rotYMat.makeRotationY(item.rotationY + variation.rotationY);
          tmpMat.multiply(rotYMat);
          tiltXMat.makeRotationX(variation.tiltX);
          tmpMat.multiply(tiltXMat);
          tiltZMat.makeRotationZ(variation.tiltZ);
          tmpMat.multiply(tiltZMat);
          swayXMat.makeRotationX(swayX * partSway);
          tmpMat.multiply(swayXMat);
          swayZMat.makeRotationZ(swayZ * partSway);
          tmpMat.multiply(swayZMat);
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
      {PLANTS.map((def) => (
        <instancedMesh
          key={def.id}
          ref={(m) => {
            refs.current.meshes[def.id] = m;
          }}
          args={[undefined, undefined, CAPACITY_PER_SPECIES * def.parts.length]}
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

export function PlantedFlowers() {
  return <FlowerInstances />;
}
