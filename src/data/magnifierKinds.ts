/**
 * N3 magnifier kind taxonomy — ONE shared source (PR #38 comment #6383586724,
 * divergence diagnosis (b)): the resolver and the card previously each had
 * their own idea of the entry shape; now both import this. No literals.
 */
export const MAGNIFIER_KINDS = [
  'hivebee',
  'solitarybee',
  'rarebee',
  'butterfly',
  'hoverfly',
  'queenbumble',
  'lavendermoth',
  'fireflies',
  'dragonfly',
] as const;

/** every living thing the glass can reach (shared enum, single source) */
export type MagnifierKind = (typeof MAGNIFIER_KINDS)[number];

/** the store's inspection entry: flowers by placed id, wildlife by kind */
/**
 * The glass's entry taxonomy (#6384616654): the glass inspects EVERYTHING —
 * flowers by placed id, wildlife by kind, structures by placed id. ONE
 * shared source for the store, the resolver, the meshes, and the card.
 */
export type MagnifierEntry =
  | { kind: 'flower'; itemId: string }
  | { kind: 'visitor'; visitorId: MagnifierKind }
  | { kind: 'structure'; structureId: string }
  | null;

/**
 * #6384690070: the ONE ownership rule, stated once and shared. A flower or
 * structure entry is owned by its mesh's pointer-over/pointer-out pair —
 * neither the resolver NOR another mesh's pointer-over may steal it. Only
 * null or visitor entries are claimable (the resolver owns visitor locks).
 * Every writer (resolver, flower mesh, structure mesh) consults this.
 */
export function isMeshOwnedEntry(
  e: MagnifierEntry,
): e is { kind: 'flower'; itemId: string } | { kind: 'structure'; structureId: string } {
  return e !== null && (e.kind === 'flower' || e.kind === 'structure');
}

/** an entry a claimant may overwrite: nothing held, or a visitor lock */
export function isClaimableEntry(e: MagnifierEntry): boolean {
  return e === null || e.kind === 'visitor';
}

/**
 * #6384878002: the SYMMETRIC claim rule. The ca70052 asymmetry: once a
 * mesh claimed, the OTHER mesh's pointer-over refused forever (its own
 * pointer-out only fires when the ray leaves that mesh ENTIRELY — near a
 * hive, a flower's claim stuck and the hive could never take over, and
 * vice versa). Symmetry: when the ray intersects several meshes, the one
 * NEARER THE POINTER (smaller raycast distance) may OVERTAKE the current
 * claim; a claimant farther than the current claim waits. The winning
 * distance is display-scope (never world state, never serialized).
 */
const claimDistance = { value: Infinity };

/** may this mesh pointer-over claim? records the distance when it does */
export function meshMayClaim(current: MagnifierEntry, distance: number): boolean {
  if (isClaimableEntry(current)) {
    claimDistance.value = distance;
    return true;
  }
  if (isMeshOwnedEntry(current) && distance < claimDistance.value) {
    claimDistance.value = distance;
    return true;
  }
  return false;
}

/** the claim released (pointer-out / glass off) — the distance bar resets */
export function releaseClaim(): void {
  claimDistance.value = Infinity;
}
