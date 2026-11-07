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
export interface WildlifeHit {
  kind: MagnifierKind;
  /** distance from the camera along the pointer ray to the creature — the
   *  same metric the mesh raycast's e.distance uses, so a wildlife hit and
   *  a mesh claim can be compared (#85: nearer along the ray wins) */
  along: number;
  /** squared perpendicular distance to the ray (the winner metric) */
  perpSq: number;
}

export function resolveWildlifeHit(
  camera: HitCamera,
  sightings: HitSighting[],
  reach: number,
): WildlifeHit | null {
  let best: MagnifierKind | null = null;
  let bestScore = Infinity;
  let bestAlong = 0;
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
      bestAlong = along;
    }
  }
  return best ? { kind: best, along: bestAlong, perpSq: bestScore } : null;
}

/**
 * #85 round 2: on-creature containment radius — the overtake requires the
 * pointer ray to pass THROUGH the creature's body, not merely within the
 * glass's reach beside it. ~a hivebee body half-diagonal (0.22/0.3 box ->
 * 0.19); a creature 0.27u off-ray sitting next to a hovered flower must NOT
 * steal the flower's entry (the round-1 overcorrection).
 */
export const WILDLIFE_CONTAINMENT_RADIUS = 0.2;

/**
 * #85 round 4: OWNERSHIP-FIRST, absolute. A MESH-OWNED entry (flower /
 * structure hover) is NEVER overtaken by wildlife — not even by a creature
 * dead-on under the pointer and nearer along the ray. The aefcd1b verdict
 * measured both: a hoverfly owned a flower hover, and a hivebee 0.86u from
 * a flower owned a clustering entry after a 2s hold, with the entry STABLE
 * (held >= 250ms) — both creatures were genuinely dead-on in front of the
 * mesh (along < claim bar), so the along-rule overtake fired; the resolver
 * genuinely preferred creatures over the hovered mesh, and that is the world
 * bug. The rule per the issue body: mesh-owned entries may not be overtaken.
 * Wildlife claims only over a claimable entry (null or visitor).
 */
export function wildlifeClaimableHit(hit: WildlifeHit | null, currentMeshOwned: boolean): WildlifeHit | null {
  if (currentMeshOwned) return null; // ownership-first: the mesh owns the entry
  return wildlifeClaimHit(hit);
}

/**
 * #85 round 3: the containment gate for every wildlife claim. A creature
 * merely NEAR the ray — inside the glass reach (1.1u) but off the body
 * (perp > 0.2u) — must never win or switch the entry: a non-contained hit
 * is treated exactly like a miss. Only a creature the pointer ray actually
 * passes through may hold the card.
 */
export function wildlifeClaimHit(hit: WildlifeHit | null): WildlifeHit | null {
  return hit !== null && hit.perpSq <= WILDLIFE_CONTAINMENT_RADIUS * WILDLIFE_CONTAINMENT_RADIUS
    ? hit
    : null;
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
