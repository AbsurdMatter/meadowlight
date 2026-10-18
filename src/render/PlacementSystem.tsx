import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { MEADOW_SIZE, terrainHeight } from '../engine/terrain';
import { PLANT_BY_ID } from '../data/plants';
import { usePlacementStore } from './placementStore';
import { VoxelFlower } from './VoxelFlower';

const HALF = MEADOW_SIZE / 2;

export function PlacementSystem() {
  const selectedPlantId = usePlacementStore((s) => s.selectedPlantId);
  const ghostRotationY = usePlacementStore((s) => s.ghostRotationY);
  const plant = usePlacementStore((s) => s.plant);
  const rotateGhost = usePlacementStore((s) => s.rotateGhost);
  const { raycaster, camera, gl, pointer } = useThree();
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hit = useRef(new THREE.Vector3());
  const [ghost, setGhost] = useState<[number, number, number] | null>(null);

  useFrame(() => {
    if (!selectedPlantId) {
      setGhost(null);
      return;
    }
    raycaster.setFromCamera(pointer as unknown as THREE.Vector2, camera);
    const target = raycaster.ray.intersectPlane(groundPlane.current, hit.current);
    if (!target) {
      setGhost(null);
      return;
    }
    const x = THREE.MathUtils.clamp(target.x, -HALF + 1, HALF - 1);
    const z = THREE.MathUtils.clamp(target.z, -HALF + 1, HALF - 1);
    const y = terrainHeight(x, z);
    setGhost((prev) =>
      prev && prev[0] === x && prev[1] === y && prev[2] === z ? prev : [x, y, z],
    );
  });

  const dragState = useRef({ x: 0, y: 0, button: -1 });

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      dragState.current = { x: e.clientX, y: e.clientY, button: e.button };
    };
    const wasDrag = (e: MouseEvent) =>
      dragState.current.button === e.button &&
      Math.hypot(e.clientX - dragState.current.x, e.clientY - dragState.current.y) > 6;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') rotateGhost();
    };
    const onContextMenu = (e: MouseEvent) => {
      if (wasDrag(e)) return;
      e.preventDefault();
      const s = usePlacementStore.getState();
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const target = raycaster.ray.intersectPlane(groundPlane.current, hit.current);
      if (!target) return;
      const x = THREE.MathUtils.clamp(target.x, -HALF + 1, HALF - 1);
      const z = THREE.MathUtils.clamp(target.z, -HALF + 1, HALF - 1);
      let bestId: string | null = null;
      let bestDist = 1.3;
      for (const item of s.items) {
        const d = Math.hypot(item.position[0] - x, item.position[2] - z);
        if (d < bestDist) {
          bestDist = d;
          bestId = item.id;
        }
      }
      if (bestId) s.removeAt(bestId);
    };
    gl.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    gl.domElement.addEventListener('contextmenu', onContextMenu);
    return () => {
      gl.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
      gl.domElement.removeEventListener('contextmenu', onContextMenu);
    };
  }, [camera, gl, raycaster, rotateGhost]);

  const def = selectedPlantId ? PLANT_BY_ID[selectedPlantId] : null;

  const plantHere = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const ne = e.nativeEvent as MouseEvent;
    if (dragState.current.button === ne.button &&
        Math.hypot(ne.clientX - dragState.current.x, ne.clientY - dragState.current.y) > 6) {
      return;
    }
    if (!selectedPlantId || !ghost) return;
    plant({
      id: crypto.randomUUID(),
      plantId: selectedPlantId,
      position: ghost,
      rotationY: ghostRotationY,
    });
  };

  return (
    <group>
      {ghost && def && (
        <>
          <VoxelFlower def={def} position={ghost} rotationY={ghostRotationY} ghost />
          <mesh position={[ghost[0], ghost[1] + 0.02, ghost[2]]} rotation={[-Math.PI / 2, 0, 0]} onClick={plantHere}>
            <circleGeometry args={[0.7, 24]} />
            <meshBasicMaterial color="#fff0c0" transparent opacity={0.25} />
          </mesh>
        </>
      )}
    </group>
  );
}
