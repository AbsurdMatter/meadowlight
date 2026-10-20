import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlacementStore } from './placementStore';
import { allWildlife, type WildlifeSighting } from './magnifierProbes';
import { MAGNIFIER_TUNING } from '../data/magnifier';

/**
 * N3 coverage round: wildlife hit resolution for the magnifying glass.
 *
 * Wildlife MOVES, so per-mesh pointer events can't reach it (an
 * instancedMesh's pointer events fire on the geometry under the cursor at
 * event time — but hover on a moving creature needs the position it will
 * have THIS frame). The comment's endorsed approach, applied with the
 * standing rules:
 * - ONE input path: consumes the SAME raw window pointermove the placement
 *   ghost tracks (the session-2 shared-pointer pattern) — no new DOM
 *   handlers, no capture chains, nothing for placement to swallow.
 * - Hit resolution per frame: the pointer ray (unprojected through the
 *   live camera) is compared against every live wildlife position from
 *   the read-only probe registry; nearest within the glass's reach wins.
 *   This is a different HIT RESOLUTION on the same pointer path, exactly
 *   as the flower hover is.
 * - ZERO MUTATION: reads positions, writes ONLY the display entry
 *   (magnifierEntry — UI state, never serialized, never world state).
 */
export function MagnifierInspector() {
  const { camera, gl } = useThree();
  const pointerNdc = useRef(new THREE.Vector2(0, 0));
  const inside = useRef(false);
  const ray = useRef(new THREE.Ray());
  const toCreature = useRef(new THREE.Vector3());

  useEffect(() => {
    const canvas = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerNdc.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      inside.current =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [gl]);

  useFrame(() => {
    const s = usePlacementStore.getState();
    if (!s.magnifierOn) {
      if (s.magnifierEntry?.kind === 'visitor') s.setMagnifierEntry(null);
      return;
    }
    if (!inside.current) return;
    // unproject the pointer through the live camera (the same math the
    // ghost's raycast uses — one resolution model, no second camera)
    const dir = new THREE.Vector3(pointerNdc.current.x, pointerNdc.current.y, 0.5)
      .unproject(camera)
      .sub(camera.position)
      .normalize();
    ray.current.set(camera.position, dir);

    const reach = MAGNIFIER_TUNING.wildlifeReach;
    let best: WildlifeSighting | null = null;
    let bestDist = Infinity;
    for (const w of allWildlife()) {
      toCreature.current.set(w.x, w.y, w.z).sub(ray.current.origin);
      const along = toCreature.current.dot(ray.current.direction);
      if (along <= 0) continue; // behind the camera
      const perp = Math.sqrt(Math.max(0, toCreature.current.lengthSq() - along * along));
      if (perp > reach) continue;
      // prefer the creature closest to the RAY (most likely the hovered one)
      const score = perp + along * 0.05;
      if (score < bestDist) {
        bestDist = score;
        best = w;
      }
    }
    const next = best ? ({ kind: 'visitor', visitorId: best.kind } as const) : null;
    const cur = s.magnifierEntry;
    const curId = cur?.kind === 'visitor' ? cur.visitorId : null;
    if ((next?.visitorId ?? null) !== curId) {
      s.setMagnifierEntry(next);
    }
  });

  return null;
}
