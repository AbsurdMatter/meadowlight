import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANTS, PLANT_BY_ID } from '../data/plants';
import { usePlacementStore } from './placementStore';

const tmpColor = new THREE.Color();
const swayMatX = new THREE.Matrix4();
const swayMatZ = new THREE.Matrix4();

interface Bucket {
  matrices: THREE.Matrix4[];
  colors: THREE.Color[];
}

function FlowerInstances() {
  const items = usePlacementStore((s) => s.items);
  const refs = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useFrame(({ clock }) => {
    if (!mounted.current) return;
    const t = clock.elapsedTime;
    const perSpecies = new Map<string, Bucket>();
    for (const item of items) {
      const def = PLANT_BY_ID[item.plantId];
      if (!def) continue;
      let bucket = perSpecies.get(item.plantId);
      if (!bucket) {
        bucket = { matrices: [], colors: [] };
        perSpecies.set(item.plantId, bucket);
      }
      const phase = item.phase;
      const swayZ = Math.sin(t * 0.9 + phase) * def.sway;
      const swayX = Math.cos(t * 0.7 + phase * 1.3) * def.sway * 0.5;
      for (let pi = 0; pi < def.parts.length; pi++) {
        const part = def.parts[pi];
        const m = new THREE.Matrix4();
        m.makeRotationY(item.rotationY);
        const partSwayScale = part.offset[1] / Math.max(def.height, 0.001);
        swayMatX.makeRotationX(swayX * partSwayScale);
        swayMatZ.makeRotationZ(swayZ * partSwayScale);
        m.multiply(swayMatX);
        m.multiply(swayMatZ);
        m.setPosition(item.position[0], item.position[1] + part.offset[1], item.position[2]);
        bucket.matrices.push(m);
        bucket.colors.push(tmpColor.set(part.color).clone());
      }
    }
    for (const def of PLANTS) {
      const mesh = refs.current[def.id];
      if (!mesh) continue;
      const bucket = perSpecies.get(def.id);
      const n = bucket ? bucket.matrices.length : 0;
      for (let i = 0; i < n; i++) {
        mesh.setMatrixAt(i, bucket!.matrices[i]);
        mesh.setColorAt(i, bucket!.colors[i]);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {PLANTS.map((def) => {
        const per = def.parts.length;
        const thisCapacity = Math.max(per * 20, (items.length + 20) * per * 2);
        return (
          <instancedMesh
            key={def.id}
            ref={(m) => {
              refs.current[def.id] = m;
            }}
            args={[undefined, undefined, thisCapacity]}
            castShadow
            receiveShadow
            frustumCulled={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshLambertMaterial />
          </instancedMesh>
        );
      })}
    </group>
  );
}

export function PlantedFlowers() {
  return <FlowerInstances />;
}
