import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANTS } from '../data/plants';
import { usePlacementStore } from './placementStore';
import { noVariation } from '../engine/variation';
import { inBloom } from '../engine/pollinator';

const tmpColor = new THREE.Color();
const dullColor = new THREE.Color();
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

/** out-of-season petals shrink + dull (visible bloom succession) */
const OFF_BLOOM_SCALE = 0.25;
const OFF_BLOOM_LIGHTEN = 0.35;

function FlowerInstances() {
  const items = usePlacementStore((s) => s.items);
  const season = usePlacementStore((s) => s.season);
  const openNotebook = usePlacementStore((s) => s.openNotebook);
  const refs = useRef<{ meshes: Record<string, THREE.InstancedMesh | null> }>({
    meshes: {},
  });
  /** instanceId -> item id per species, rebuilt each frame alongside matrices */
  const idMaps = useRef<Record<string, string[]>>({});

  const onClick = (e: ThreeEvent<MouseEvent>, plantId: string) => {
    e.stopPropagation();
    const idx = e.instanceId;
    const itemId = idx === undefined ? undefined : idMaps.current[plantId]?.[idx];
    if (itemId) openNotebook({ kind: 'plant', id: itemId });
  };
  useFrame(({ clock }) => {
    const r = refs.current;
    const t = clock.elapsedTime;
    for (const def of PLANTS) {
      const mesh = r.meshes[def.id];
      if (!mesh) continue;
      const blooming = inBloom(def.id, season);
      const ids: string[] = [];
      let i = 0;
      for (const item of items) {
        if (item.plantId !== def.id) continue;
        const variation = item.variation ?? noVariation();
        const swayZ = Math.sin(t * 0.9 + item.phase) * def.sway;
        const swayX = Math.cos(t * 0.7 + item.phase * 1.3) * def.sway * 0.5;
        ids.push(item.id);
        for (let pi = 0; pi < def.parts.length; pi++) {
          const part = def.parts[pi];
          const petal = part.petal === true;
          const partSway = part.offset[1] / Math.max(def.height, 0.001);
          const bloomScale = !petal || blooming ? 1 : OFF_BLOOM_SCALE;
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
          scaleMat.makeScale(
            part.size[0] * bloomScale,
            part.size[1] * bloomScale,
            part.size[2] * bloomScale,
          );
          tmpMat.multiply(scaleMat);
          mesh.setMatrixAt(i, tmpMat);
          tmpColor.set(part.color);
          if (petal && !blooming) {
            dullColor.copy(tmpColor).lerp(new THREE.Color('#b9b39a'), OFF_BLOOM_LIGHTEN);
            mesh.setColorAt(i, dullColor);
          } else {
            mesh.setColorAt(i, tmpColor);
          }
          i++;
        }
      }
      mesh.count = i;
      idMaps.current[def.id] = ids;
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
          onClick={(e) => onClick(e, def.id)}
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
