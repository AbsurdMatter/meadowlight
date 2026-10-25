import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlacementStore } from './placementStore';
import { allWildlife } from './magnifierProbes';
import { MAGNIFIER_TUNING } from '../data/magnifier';
import { resolveWildlifeHit } from '../engine/magnifierHit';
import type { MagnifierEntry } from '../data/magnifierKinds';
import { isMeshOwnedEntry } from '../data/magnifierKinds';

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
    // O4 (v4, #42): TAP-TO-INSPECT — hover has no touch equivalent, so a
    // tap IS the inspect affordance. A tap (pointerdown+up within the click
    // slop) while the glass is armed resolves the entry AT THE TAP POINT
    // through the SAME resolver the hover drives: one input path, the tap
    // just supplies the pointer position the resolver reads. A long-press
    // (travel past the slop, or held past the threshold) is NOT a tap —
    // it belongs to removal/camera, never to inspection.
    let tapX = 0;
    let tapY = 0;
    let tapTravel = 0;
    let tapDown = false;
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || e.button !== 0) return;
      tapDown = true;
      tapTravel = 0;
      tapX = e.clientX;
      tapY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!tapDown) return;
      tapTravel = Math.max(tapTravel, Math.hypot(e.clientX - tapX, e.clientY - tapY));
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!tapDown || e.pointerType !== 'touch') return;
      tapDown = false;
      if (tapTravel > 12) return; // a drag, not a tap — never inspection
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
      // the resolver's next frame resolves the entry at the tap point —
      // the same per-frame path the hover uses (one input path)
    };
    window.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [gl]);

  // visitor locks get a short miss-grace: a creature crossing the reach
  // boundary mid-hover keeps its card for ~0.5s of consecutive misses
  // before the lock releases (a wobble is not a pointer-leave) — the
  // flower path is NEVER touched here (flower meshes own their hover
  // lifecycle via pointer-out; the resolver must not fight them)
  const missStreak = useRef(0);

  useFrame(() => {
    const s = usePlacementStore.getState();
    if (!s.magnifierOn) {
      if (s.magnifierEntry) s.setMagnifierEntry(null);
      missStreak.current = 0;
      return;
    }
    if (!inside.current) return; // pointer off-canvas: nothing to resolve
    // THE ONE OWNERSHIP RULE (#6384690070, third instance of the hit/miss
    // asymmetry class): a flower or structure entry is owned by its mesh's
    // pointer-over/pointer-out pair — the resolver never overwrites a
    // mesh-owned entry, in ANY branch. The resolver's visitor lock claims
    // only null/visitor entries (isClaimableEntry). Stated once in
    // data/magnifierKinds, consulted by every writer — no special cases.
    if (isMeshOwnedEntry(s.magnifierEntry)) return;
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
    if (isMeshOwnedEntry(cur)) return; // the ONE rule, every branch
    if (hit) {
      missStreak.current = 0;
      const next = { kind: 'visitor', visitorId: hit.kind } as MagnifierEntry;
      if (JSON.stringify(next) !== JSON.stringify(cur)) s.setMagnifierEntry(next);
      return;
    }
    // miss: a visitor lock survives the grace window, then releases
    missStreak.current++;
    if (missStreak.current > 30) {
      missStreak.current = 0;
      if (cur) s.setMagnifierEntry(null);
    }
  });

  return null;
}
