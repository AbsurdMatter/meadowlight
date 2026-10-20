/**
 * Session 8 N3: the magnifying-glass inspector — tuning + proposal flag.
 *
 * Taste-first: the glass is DATA-FLAGGED and defaults ON for dev
 * verification but the visual presentation (card position, zoom cue) is
 * tuned here as one-constant values the user's eyeball confirms.
 *
 * One input path rule: the glass adds ZERO new DOM input layers — the
 * hover rides R3F's existing pointer events on the already-rendered
 * instanced meshes (the same raycast path clicks use), and the card is
 * pure display (pointer-events: none except its own close affordance).
 * Pure inspection, zero mutation: hovering never writes to the world.
 */
export const MAGNIFIER_TUNING = {
  /** N3 PROPOSAL flag: the glass entry in the palette (user eyeball decides) */
  enabled: true,
  /** where the detail card sits (bottom-center above the notebook card) */
  cardBottom: 210,
  /** how long after pointer-left the card lingers (ms) — zero flicker */
  lingerMs: 450,
  /**
   * N3 coverage: how close the pointer ray must pass to a live creature
   * (world units) for the glass to lock onto it — the wildlife hit radius.
   * One-constant taste value (the user's eyeball confirms the feel).
   */
  wildlifeReach: 1.1,
} as const;
