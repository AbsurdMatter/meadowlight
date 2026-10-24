import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlacementStore } from './placementStore';
import { allWildlife } from './magnifierProbes';
import { MAGNIFIER_TUNING } from '../data/magnifier';
import { resolveWildlifeHit, nextWildlifeEntry } from '../engine/magnifierHit';
import type { MagnifierEntry } from '../data/magnifierKinds';

/**
 * N3 wildlife hit resolution — IN-Canvas half, a THIN SHELL over the pure
 * hit function (src/engine/magnifierHit.ts): the resolver only collects
 * live camera + pointer + probe positions each frame and applies the pure
 * decision. The chain break this fixes (PR #38 comment #6383586724):
 * the old resolver wrote null on every frame where no creature was in
 * reach, wiping the visitor entry the hover (or the gate) had just set —
 * flowers survived (their path never wrote), wildlife died one frame
 * later. Now a MISS KEEPS the current visitor entry; the entry clears
 * when the pointer leaves or the glass turns off.
 */
export function MagnifierResolver() {
  const { camera, gl } = useThree();
  const pointerNdc = useRef(new THREE.Vector2(0, 0));
  const inside = useRef(false);
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
      if (s.magnifierEntry) s.setMagnifierEntry(null);
      return;
    }
    if (!inside.current) return; // pointer off-canvas: nothing to resolve
    // unproject the pointer through the live camera, then hand the PURE
    // hit function flat camera state + CURRENT probe positions
    dir.current
      .set(pointerNdc.current.x, pointerNdc.current.y, 0.5)
      .unproject(camera)
      .sub(camera.position)
      .normalize();
    const hit = resolveWildlifeHit(
      {
        camX: camera.position.x,
        camY: camera.position.y,
        camZ: camera.position.z,
        dirX: dir.current.x,
        dirY: dir.current.y,
        dirZ: dir.current.z,
      },
      allWildlife(),
      MAGNIFIER_TUNING.wildlifeReach,
    );
    const cur = s.magnifierEntry;
    const currentVisitorId = cur?.kind === 'visitor' ? cur.visitorId : null;
    const next = nextWildlifeEntry(hit, currentVisitorId) as MagnifierEntry;
    if (JSON.stringify(next) !== JSON.stringify(cur)) {
      s.setMagnifierEntry(next);
    }
  });

  return null;
}
