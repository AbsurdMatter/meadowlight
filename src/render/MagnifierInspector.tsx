import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlacementStore } from './placementStore';
import { allWildlife, type WildlifeSighting } from './magnifierProbes';
import { MAGNIFIER_TUNING } from '../data/magnifier';

/**
 * N3 wildlife hit resolution — IN-Canvas half (PR #38 comment #6349476585).
 *
 * ARCHITECTURE (the crash that forced it): the previous MagnifierInspector
 * used R3F hooks but was mounted OUTSIDE the Canvas — "R3F: Hooks can only
 * be used within the Canvas component!" threw on the user's machine and
 * killed the card, the probes, and every check downstream. The two halves
 * now split along the Canvas boundary, meeting at the STORE (no new state):
 *
 *   INSIDE (this file, mounted inside <Canvas>): headless resolver —
 *     useFrame + the live camera, pointer unprojection, probe walk,
 *     writes the found entry to magnifierEntry. Zero rendered output.
 *   OUTSIDE: MagnifierCard, pure DOM — reads the store, no R3F hooks, ever.
 *
 * One input path unchanged: the same raw window pointermove the placement
 * ghost tracks. Zero mutation: reads positions, writes ONLY the display
 * entry (UI state, never serialized, never world state).
 */
export function MagnifierResolver() {
  const { camera, gl } = useThree();
  const pointerNdc = useRef(new THREE.Vector2(0, 0));
  const inside = useRef(false);
  const ray = useRef(new THREE.Ray());
  const toCreature = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());

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
    // unproject the pointer through the live camera (same math as the
    // ghost's raycast — one resolution model, no second camera)
    dir.current
      .set(pointerNdc.current.x, pointerNdc.current.y, 0.5)
      .unproject(camera)
      .sub(camera.position)
      .normalize();
    ray.current.set(camera.position, dir.current);

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
