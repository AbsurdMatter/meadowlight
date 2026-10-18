import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlantPart } from '../data/plants';

export interface VoxelFlowerProps {
  def: { parts: PlantPart[]; sway?: number };
  position: [number, number, number];
  rotationY: number;
  ghost?: boolean;
  /** override the def's sway (structures sway less) */
  swayStrength?: number;
  tilt?: [number, number];
  /** invalid placement (occupied ground): red tint instead of the usual ghost look */
  invalid?: boolean;
}

export function VoxelFlower({ def, position, rotationY, ghost, swayStrength, tilt, invalid }: VoxelFlowerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2).current;
  const sway = swayStrength ?? def.sway ?? 0.05;
  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.rotation.z = Math.sin(t * 0.9 + phase) * sway + (tilt ? tilt[1] : 0);
    g.rotation.x = Math.cos(t * 0.7 + phase * 1.3) * sway * 0.5 + (tilt ? tilt[0] : 0);
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
            color={invalid ? '#d24a43' : part.color}
            transparent={ghost}
            opacity={ghost ? (invalid ? 0.5 : 0.55) : 1}
          />
        </mesh>
      ))}
    </group>
  );
}
