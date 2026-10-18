import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MEADOW_SIZE, terrainHeight } from '../engine/terrain';
import { PLANT_BY_ID } from '../data/plants';
import { STRUCTURE_BY_ID } from '../data/structures';
import { usePlacementStore } from './placementStore';
import { variationFor } from '../engine/variation';
import type { StructureId } from '../data/structures';
import { VoxelFlower } from './VoxelFlower';
import { VoxelStructure } from './VoxelStructure';

const HALF = MEADOW_SIZE / 2;
/** max distance (px) between pointerdown and pointerup that still counts as a click */
const CLICK_SLOP_PX = 6;

export function PlacementSystem() {
  const selectedPlantId = usePlacementStore((s) => s.selectedPlantId);
  const selectedStructureId = usePlacementStore((s) => s.selectedStructureId);
  const ghostRotationY = usePlacementStore((s) => s.ghostRotationY);
  const rotateGhost = usePlacementStore((s) => s.rotateGhost);
  const { raycaster, camera, gl } = useThree();
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hit = useRef(new THREE.Vector3());
  const [ghost, setGhost] = useState<[number, number, number] | null>(null);
  /** pointer position in NDC, tracked from raw pointermove events on the whole
   *  window so the ghost keeps following the cursor even when it crosses UI
   *  overlays (which swallow R3F's shared `pointer` updates) */
  const pointerNdc = useRef(new THREE.Vector2(0, 0));
  const pointerInsideCanvas = useRef(false);
  const dragState = useRef({ x: 0, y: 0, button: -1 });

  useEffect(() => {
    const canvas = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerNdc.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      pointerInsideCanvas.current =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [gl]);

  /**
   * The single source of truth for "where would we place right now": the same
   * raycast for both the ghost preview and the actual placement, so the two can
   * never disagree. The ray is walked against the actual terrain heightfield
   * (not a flat y=0 plane), so the ghost sits exactly on the ground under the
   * cursor at every camera angle and zoom — no height parallax. Returns null
   * when the ray never reaches the meadow (cursor over the sky or horizon).
   */
  const resolvePlacement = (): [number, number, number] | null => {
    raycaster.setFromCamera(pointerNdc.current, camera);
    const { ray } = raycaster;
    // coarse march along the ray until it dips below the terrain
    const MAX_T = 120;
    const STEP = 0.75;
    let tPrev = 0;
    const distPrev = ray.origin.y - terrainHeight(ray.origin.x, ray.origin.z);
    if (distPrev <= 0) {
      // camera start below terrain (shouldn't happen, but stay safe)
      return clampToMeadow(ray.origin.x, ray.origin.z);
    }
    for (let t = STEP; t <= MAX_T; t += STEP) {
      const x = ray.origin.x + ray.direction.x * t;
      const y = ray.origin.y + ray.direction.y * t;
      const z = ray.origin.z + ray.direction.z * t;
      const dist = y - terrainHeight(x, z);
      if (dist <= 0) {
        // bisect between tPrev and t for a precise surface hit
        let lo = tPrev;
        let hi = t;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          const mx = ray.origin.x + ray.direction.x * mid;
          const my = ray.origin.y + ray.direction.y * mid;
          const mz = ray.origin.z + ray.direction.z * mid;
          if (my - terrainHeight(mx, mz) > 0) lo = mid;
          else hi = mid;
        }
        const hx = ray.origin.x + ray.direction.x * hi;
        const hz = ray.origin.z + ray.direction.z * hi;
        return clampToMeadow(hx, hz);
      }
      tPrev = t;
    }
    // no terrain hit: fall back to the flat meadow plane (grazing rays)
    const target = ray.intersectPlane(groundPlane.current, hit.current);
    if (!target) return null;
    return clampToMeadow(target.x, target.z);
  };

  const clampToMeadow = (x: number, z: number): [number, number, number] | null => {
    const cx = THREE.MathUtils.clamp(x, -HALF + 1, HALF - 1);
    const cz = THREE.MathUtils.clamp(z, -HALF + 1, HALF - 1);
    return [cx, terrainHeight(cx, cz), cz];
  };

  useFrame(() => {
    if ((!selectedPlantId && !selectedStructureId) || !pointerInsideCanvas.current) {
      setGhost(null);
      return;
    }
    const next = resolvePlacement();
    setGhost((prev) =>
      prev && next && prev[0] === next[0] && prev[1] === next[1] && prev[2] === next[2]
        ? prev
        : next,
    );
  });

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      dragState.current = { x: e.clientX, y: e.clientY, button: e.button };
    };
    const wasClick = (e: MouseEvent) =>
      dragState.current.button === e.button &&
      Math.hypot(e.clientX - dragState.current.x, e.clientY - dragState.current.y) <= CLICK_SLOP_PX;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'r' || e.key === 'R') rotateGhost();
      if (e.key === 'f' || e.key === 'F')
        usePlacementStore.getState().toggleVariation();
    };
    const onContextMenu = (e: MouseEvent) => {
      if (wasClick(e)) return;
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
      // structures first (they're chunkier), then flowers
      let bestStructureId: string | null = null;
      let bestStructureDist = 2.0;
      for (const it of s.structures) {
        const def = STRUCTURE_BY_ID[it.structureId];
        const d = Math.hypot(it.position[0] - x, it.position[2] - z);
        if (d < bestStructureDist && def) {
          bestStructureDist = d;
          bestStructureId = it.id;
        }
      }
      if (bestStructureId) {
        s.removeStructure(bestStructureId);
        return;
      }
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
    /** Placement click: DOM-level, using the exact same resolvePlacement() the
     *  ghost preview uses — validity always matches what the ghost shows, and
     *  notebook click handlers can no longer swallow the planting click. */
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || !wasClick(e)) return;
      const s = usePlacementStore.getState();
      if (!s.selectedPlantId && !s.selectedStructureId) return;
      const spot = resolvePlacement();
      if (!spot) return;
      const variationOn = s.placementVariation;
      if (s.selectedPlantId) {
        s.plant({
          id: crypto.randomUUID(),
          plantId: s.selectedPlantId,
          position: spot,
          rotationY: s.ghostRotationY,
          phase: Math.random() * Math.PI * 2,
          variation: variationFor(variationOn),
        });
      } else if (s.selectedStructureId) {
        s.placeStructure({
          id: crypto.randomUUID(),
          structureId: s.selectedStructureId as StructureId,
          position: spot,
          rotationY: s.ghostRotationY,
          variation: variationFor(variationOn),
        });
      }
    };
    gl.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    gl.domElement.addEventListener('contextmenu', onContextMenu);
    gl.domElement.addEventListener('click', onClick);
    return () => {
      gl.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
      gl.domElement.removeEventListener('contextmenu', onContextMenu);
      gl.domElement.removeEventListener('click', onClick);
    };
  }, [camera, gl, raycaster, rotateGhost]);

  const def = selectedPlantId ? PLANT_BY_ID[selectedPlantId] : null;
  const structureDef = selectedStructureId
    ? STRUCTURE_BY_ID[selectedStructureId as StructureId]
    : null;

  return (
    <group>
      {ghost && def && (
        <VoxelFlower def={def} position={ghost} rotationY={ghostRotationY} ghost />
      )}
      {ghost && structureDef && (
        <VoxelStructure def={structureDef} position={ghost} rotationY={ghostRotationY} ghost />
      )}
    </group>
  );
}
