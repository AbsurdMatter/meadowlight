import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlantDef } from '../data/plants';

export interface VoxelFlowerProps {
  def: PlantDef;
  position: [number, number, number];
  rotationY: number;
  ghost?: boolean;
}

export function VoxelFlower({ def, position, rotationY, ghost }: VoxelFlowerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2).current;

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.rotation.z = Math.sin(t * 0.9 + phase) * def.sway;
    g.rotation.x = Math.cos(t * 0.7 + phase * 1.3) * def.sway * 0.5;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, rotationY, 0]}
    >
      {def.parts.map((part, i) => (
        <mesh
          key={i}
          position={part.offset}
          castShadow={!ghost}
          receiveShadow={!ghost}
        >
          <boxGeometry args={part.size} />
          <meshLambertMaterial
            color={part.color}
            transparent={ghost}
            opacity={ghost ? 0.55 : 1}
          />
        </mesh>
      ))}
    </group>
  );
}
