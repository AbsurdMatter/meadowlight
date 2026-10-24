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
export type MagnifierEntry =
  | { kind: 'flower'; itemId: string }
  | { kind: 'visitor'; visitorId: MagnifierKind }
  | null;
