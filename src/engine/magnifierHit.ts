/**
 * N3 magnifier wildlife hit resolution — a PURE function (PR #38 comment
 * #6383586724): pointer + camera state + live probe positions in, the hit
 * entry out. No three.js import, no render layer, no store — unit-testable
 * with synthetic probe+pointer pairs (the session-7 one-source pattern).
 *
 * The wildlife-hit contract, fixed by the divergence diagnosis:
 * - the hit is computed against the CURRENT probe position at pointer time
 *   (wildlife MOVES — a stale capture is a phantom hit),
 * - the nearest creature to the RAY wins (closest to the pointer's line
 *   of sight, not closest to the camera — a creature behind a hovered
 *   one must not steal the lock),
 * - MISS IS NOT A CLEAR: a frame where no creature is in reach keeps the
 *   current entry (creatures cross the reach boundary mid-hover; the entry
 *   clears when the pointer actually LEAVES, not when the lock wobbles).
 *   This was the live-chain break: the old resolver wrote null on every
 *   in-between frame, wiping entries the check (and the user's hover)
 *   had just set.
 */
import type { MagnifierEntry, MagnifierKind } from '../data/magnifierKinds';

/** a live sighting from the probe registry (current frame position) */
export interface HitSighting {
  kind: MagnifierKind;
  x: number;
  y: number;
  z: number;
}

/** camera state needed to resolve a hit (flat, three-free — pure) */
export interface HitCamera {
  /** camera world position */
  camX: number;
  camY: number;
  camZ: number;
  /** normalized pointer ray direction in world space */
  dirX: number;
  dirY: number;
  dirZ: number;
}

/**
 * Resolve the wildlife hit: returns the entry for the creature nearest the
 * pointer ray within reach, or null when nothing is in reach.
 *
 * Reach is measured PERPENDICULAR to the ray (the pointer's line of sight),
 * so a distant creature hovering under the pointer still hits at range.
 */
export function resolveWildlifeHit(
  camera: HitCamera,
  sightings: HitSighting[],
  reach: number,
): { kind: MagnifierKind } | null {
  let best: MagnifierKind | null = null;
  let bestScore = Infinity;
  for (const w of sightings) {
    // vector camera -> creature
    const dx = w.x - camera.camX;
    const dy = w.y - camera.camY;
    const dz = w.z - camera.camZ;
    // projection along the pointer ray
    const along = dx * camera.dirX + dy * camera.dirY + dz * camera.dirZ;
    if (along <= 0) continue; // behind the camera
    // perpendicular distance to the ray (the pointer's line of sight)
    const lenSq = dx * dx + dy * dy + dz * dz;
    const perpSq = lenSq - along * along;
    if (perpSq > reach * reach) continue; // outside the glass's reach
    // nearest to the RAY wins: pure perpendicular distance. (A previous
    // version added an along-the-ray tie-break, which let a creature NEAR
    // the camera but off-axis steal the lock from the one dead-on under
    // the pointer — a unit test caught it; the eye means the creature
    // under the pointer, not the closest one.)
    if (perpSq < bestScore) {
      bestScore = perpSq;
      best = w.kind;
    }
  }
  return best ? { kind: best } : null;
}

/**
 * The resolver's per-frame ENTRY DECISION (also pure, also tested):
 * hit found -> that entry; no hit -> KEEP the current visitor entry
 * (a wobble is not a pointer-leave); the glass/cursor decides clears.
 */
export function nextWildlifeEntry(
  hit: { kind: MagnifierKind } | null,
  currentVisitorId: MagnifierKind | null,
): MagnifierEntry {
  if (hit) return { kind: 'visitor', visitorId: hit.kind };
  if (currentVisitorId) return { kind: 'visitor', visitorId: currentVisitorId };
  return null;
}
