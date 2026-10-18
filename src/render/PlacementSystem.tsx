import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MEADOW_SIZE, terrainHeight } from '../engine/terrain';
import { PLANT_BY_ID } from '../data/plants';
import { STRUCTURE_BY_ID } from '../data/structures';
import { usePlacementStore } from './placementStore';
import { variationFor, type PlacementVariation } from '../engine/variation';
import { flowerBlocked, structureBlocked } from '../engine/collision';
import type { StructureId } from '../data/structures';
import { VoxelFlower } from './VoxelFlower';
import { VoxelStructure } from './VoxelStructure';

const HALF = MEADOW_SIZE / 2;
/** max distance (px) between pointerdown and pointerup that still counts as a click */
const CLICK_SLOP_PX = 6;

/** live ghost ground position + validity, exposed for the test hook so
 *  automated checks can compare the ghost against actual placements */
export const ghostDebug = {
  pos: null as [number, number, number] | null,
  valid: true,
  /** the exact variation the next placement will receive (ghost preview and
   *  click placement share it — the preview never lies) */
  variation: null as { rotationY: number; heightJitter: number; tiltX: number; tiltZ: number } | null,
};

export function PlacementSystem() {
  const selectedPlantId = usePlacementStore((s) => s.selectedPlantId);
  const selectedStructureId = usePlacementStore((s) => s.selectedStructureId);
  const ghostRotationY = usePlacementStore((s) => s.ghostRotationY);
  const rotateGhost = usePlacementStore((s) => s.rotateGhost);
  const { raycaster, camera, gl } = useThree();
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hit = useRef(new THREE.Vector3());
  const [ghost, setGhost] = useState<[number, number, number] | null>(null);
  const [ghostValid, setGhostValid] = useState(true);
  /** bumped on every pending-variation re-roll so the ghost re-renders and
   *  shows the exact new roll immediately (refs don't trigger renders) */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [variationEpoch, setVariationEpoch] = useState(0);
  const modalOpen = usePlacementStore((s) => s.modalOpen);
  /** pointer position in NDC, tracked from raw pointermove events on the whole
   *  window so the ghost keeps following the cursor even when it crosses UI
   *  overlays (which swallow R3F's shared `pointer` updates) */
  const pointerNdc = useRef(new THREE.Vector2(0, 0));
  const pointerInsideCanvas = useRef(false);
  /**
   * The variation the NEXT placement will receive. Rolled once per attempt
   * (tool select, R, and after each placement re-roll it) and shared by the
   * ghost preview and the click — so with variation ON the ghost shows the
   * exact rotation/tilt/height the placed object will get. Hedge lines can
   * finally be planned.
   */
  const pendingVariation = useRef<PlacementVariation>(variationFor(
    usePlacementStore.getState().placementVariation,
  ));
  const dragState = useRef({
    x: 0,
    y: 0,
    button: -1,
    travel: 0,
    /** travel of the last COMPLETED press-release cycle; contextmenu (which
     *  some browsers fire at press time, others at release) reads this */
    lastTravel: 0,
    lastButton: -1,
  });

  useEffect(() => {
    // re-roll the pending variation whenever the tool selection or the
    // variation toggle changes, so each attempt previews its own exact roll
    const unsub = usePlacementStore.subscribe((state, prev) => {
      if (
        state.selectedPlantId !== prev.selectedPlantId ||
        state.selectedStructureId !== prev.selectedStructureId ||
        state.placementVariation !== prev.placementVariation
      ) {
        pendingVariation.current = variationFor(state.placementVariation);
        setVariationEpoch((n) => n + 1);
      }
    });
    return unsub;
  }, []);

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
    return raycastTerrain(pointerNdc.current);
  };

  /** Terrain-accurate ground hit for any NDC point (placement cursor or a
   *  right-click) — same heightfield march, so remove and place agree. */
  const raycastTerrain = (ndc: THREE.Vector2): [number, number, number] | null => {
    raycaster.setFromCamera(ndc, camera);
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

  /** Ground position for stored NDC coordinates (terrain-accurate). */
  const resolveFromNdc = (ndcX: number, ndcY: number): [number, number, number] | null => {
    return raycastTerrain(new THREE.Vector2(ndcX, ndcY));
  };


  const clampToMeadow = (x: number, z: number): [number, number, number] | null => {
    const cx = THREE.MathUtils.clamp(x, -HALF + 1, HALF - 1);
    const cz = THREE.MathUtils.clamp(z, -HALF + 1, HALF - 1);
    return [cx, terrainHeight(cx, cz), cz];
  };

  /** Same occupancy check for ghost preview and actual placement. */
  const placementBlocked = (x: number, z: number): boolean => {
    const s = usePlacementStore.getState();
    if (s.selectedPlantId) return flowerBlocked(x, z, s.structures);
    if (s.selectedStructureId)
      return structureBlocked(
        x,
        z,
        s.selectedStructureId as StructureId,
        s.structures,
        s.items,
      );
    return false;
  };

  useFrame(() => {
    if ((!selectedPlantId && !selectedStructureId) || !pointerInsideCanvas.current || modalOpen) {
      setGhost(null);
      return;
    }
    const next = resolvePlacement();
    setGhost((prev) =>
      prev && next && prev[0] === next[0] && prev[1] === next[1] && prev[2] === next[2]
        ? prev
        : next,
    );
    if (next) {
      const blocked = placementBlocked(next[0], next[2]);
      ghostDebug.pos = next;
      ghostDebug.valid = !blocked;
      setGhostValid((prev) => (prev === !blocked ? prev : !blocked));
    } else {
      ghostDebug.pos = null;
    }
  });

  useEffect(() => {
    let pressTravel = 0;
    let pressButton = -1;
    let pressX = 0;
    let pressY = 0;
    const onPointerMove = (e: PointerEvent) => {
      if (pressButton === -1) return;
      pressTravel += Math.hypot(e.clientX - pressX, e.clientY - pressY);
      pressX = e.clientX;
      pressY = e.clientY;
    };
    const onPointerDown = (e: PointerEvent) => {
      pressButton = e.button;
      pressTravel = 0;
      pressX = e.clientX;
      pressY = e.clientY;
      dragState.current.button = e.button;
      dragState.current.travel = 0;
    };
    const onPointerUp = () => {
      // close the press-release cycle: remember how far this press traveled
      const wasDrag = pressTravel > CLICK_SLOP_PX;
      const button = pressButton;
      dragState.current.lastTravel = pressTravel;
      dragState.current.lastButton = pressButton;
      pressButton = -1;
      // some browsers fire contextmenu at press time, before the drag even
      // happens — those were parked as pending and are resolved here, now that
      // the full press-release travel is known
      if (pendingContext && button !== -1) {
        pendingContext = false;
        if (!wasDrag) handleContextMenuAction(button);
      }
    };
    const wasClick = (e: MouseEvent) =>
      dragState.current.lastButton === e.button &&
      dragState.current.lastTravel <= CLICK_SLOP_PX;
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
      const st = usePlacementStore.getState();
      const reroll = () => {
        pendingVariation.current = variationFor(st.placementVariation);
        setVariationEpoch((n) => n + 1);
      };
      if (e.key === 'r' || e.key === 'R') {
        rotateGhost();
        reroll();
      }
      if (e.key === 'f' || e.key === 'F') {
        usePlacementStore.getState().toggleVariation();
        pendingVariation.current = variationFor(!st.placementVariation);
        setVariationEpoch((n) => n + 1);
      }
    };
    /** the actual right-click action: deselect-first, then remove (shared by
     *  the immediate path and the pending-contextmenu path) */
    const handleContextMenuAction = (button: number) => {
      const s = usePlacementStore.getState();
      if (s.modalOpen) return;
      // with a tool selected, right-click deselects the tool (inspect mode);
      // only with no tool selected does right-click remove
      if (s.selectedPlantId || s.selectedStructureId) {
        s.select(null);
        s.selectStructure(null);
        return;
      }
      if (button !== 2) return;
      const spot = resolveFromNdc(pressNdcX, pressNdcY);
      if (!spot) return;
      const x = spot[0];
      const z = spot[2];
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

    /** NDC of the most recent pointer position, for remove targeting */
    let pressNdcX = 0;
    let pressNdcY = 0;
    let pendingContext = false;

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      // never show the browser menu on the canvas
      const rect = gl.domElement.getBoundingClientRect();
      pressNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pressNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      if (pressButton !== -1) {
        // contextmenu fired at press time (before the drag): park it and
        // resolve on pointerup once the full travel is known
        pendingContext = true;
        return;
      }
      // contextmenu after release: use the completed cycle
      const wasRotateDrag =
        dragState.current.lastButton === e.button &&
        dragState.current.lastTravel > CLICK_SLOP_PX;
      if (wasRotateDrag) return;
      handleContextMenuAction(e.button);
    };
    /** Placement click: DOM-level, using the exact same resolvePlacement() the
     *  ghost preview uses — validity always matches what the ghost shows, and
     *  notebook click handlers can no longer swallow the planting click. */
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || !wasClick(e)) return;
      if (usePlacementStore.getState().modalOpen) return;
      const s = usePlacementStore.getState();
      if (!s.selectedPlantId && !s.selectedStructureId) return;
      const spot = resolvePlacement();
      if (!spot) return;
      if (placementBlocked(spot[0], spot[2])) return;
      const variation = pendingVariation.current;
      if (s.selectedPlantId) {
        s.plant({
          id: crypto.randomUUID(),
          plantId: s.selectedPlantId,
          position: spot,
          rotationY: s.ghostRotationY,
          phase: Math.random() * Math.PI * 2,
          variation,
        });
      } else if (s.selectedStructureId) {
        s.placeStructure({
          id: crypto.randomUUID(),
          structureId: s.selectedStructureId as StructureId,
          position: spot,
          rotationY: s.ghostRotationY,
          variation,
        });
      }
      // fresh roll for the next placement (and its ghost preview)
      pendingVariation.current = variationFor(s.placementVariation);
      setVariationEpoch((n) => n + 1);
    };
    gl.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    gl.domElement.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKey);
    gl.domElement.addEventListener('contextmenu', onContextMenu);
    gl.domElement.addEventListener('click', onClick);
    return () => {
      gl.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      gl.domElement.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKey);
      gl.domElement.removeEventListener('contextmenu', onContextMenu);
      gl.domElement.removeEventListener('click', onClick);
    };
  }, [camera, gl, raycaster, rotateGhost]);

  const def = selectedPlantId ? PLANT_BY_ID[selectedPlantId] : null;
  const structureDef = selectedStructureId
    ? STRUCTURE_BY_ID[selectedStructureId as StructureId]
    : null;

  void variationEpoch;
  const pv = pendingVariation.current;
  ghostDebug.variation = pv;
  return (
    <group>
      {ghost && def && (
        <VoxelFlower
          def={def}
          position={[ghost[0], ghost[1] + pv.heightJitter, ghost[2]]}
          rotationY={ghostRotationY + pv.rotationY}
          tilt={[pv.tiltX, pv.tiltZ]}
          ghost
          invalid={!ghostValid}
        />
      )}
      {ghost && structureDef && (
        <VoxelStructure
          def={structureDef}
          position={[ghost[0], ghost[1] + pv.heightJitter, ghost[2]]}
          rotationY={ghostRotationY + pv.rotationY}
          tilt={[pv.tiltX, pv.tiltZ]}
          ghost
          invalid={!ghostValid}
        />
      )}
    </group>
  );
}
