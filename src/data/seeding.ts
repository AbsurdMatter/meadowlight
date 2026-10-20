/**
 * Session 7 U1 (#new): self-seeding tuning — ALL knobs live here, never in
 * components (AGENTS.md rule).
 *
 * Design contract (v3 ROADMAP, session 7 item 1): flowers occasionally
 * volunteer a seedling in a nearby plantable cell — rare, capped per
 * region, roster-compatible neighbors; seedlings clearable like any plant,
 * never reading as weeds. The meadow becomes partly self-grown.
 *
 * WHEN: one roll per parent flower per SEASON ROLLOVER (the arriveAtSeason
 * site — the single season-advance path, shared with the day clock in
 * Sky.tsx). No per-frame rolls: seeding is a calendar event, not a twitch.
 *
 * WHO seeds: only flowers that were IN BLOOM during the season just ended —
 * real ecology (a flower sets seed after it blooms), and it keeps winter
 * quiet (crocus seeds in spring after its winter bloom).
 *
 * WHO rises: the same species, or a bloom-season-compatible companion —
 * a roster species that shares a bloom season with the parent. Never a
 * random species: a volunteer never reads as a weed because it reads as
 * "more of what's already thriving here".
 */
export const SEEDING_TUNING = {
  /**
   * chance one blooming parent sets a seedling at a season rollover.
   * A 30-flower meadow with ~2/3 blooming volunteers ~1 per season;
   * the caps below dominate long before this can grow a thicket.
   */
  chancePerBloomingParent: 0.06,
  /** candidate cells probed around the parent (hash-ordered, first fit wins) */
  candidateCells: 6,
  /** seedlings land min..max this far from the parent, world units */
  seedDistanceMin: 1.1,
  seedDistanceMax: 2.6,
  /** region = square of this side; the per-region cap makes growth read as
   *  drifts filling in, never a monoculture wall advancing on the meadow */
  regionSize: 5.5,
  /** max volunteers per region per rollover (the invasiveness brake) */
  maxPerRegionPerSeason: 2,
  /** max volunteers per rollover, whole meadow (the hard ceiling) */
  maxPerSeason: 5,
  /** volunteers never land closer than this to an existing flower's cell */
  minSpacing: 0.85,
} as const;

/**
 * NAMED STATE (the carry-over rule): the world's seed hash joins
 * dayPhase/season. Stable across reloads, assigned once per world — old
 * (v6-and-earlier) saves derive theirs from their own contents, so the
 * same old blob always seeds the same meadow.
 */
export const DEFAULT_WORLD_SEED = 12345;

/** save v7 additive field name (persistence.ts writes/reads this) */
export const SEEDING_FACTS = {
  volunteer: 'Volunteer seedlings are how real meadows spread — flowers set seed after they bloom, and the meadow slowly fills itself in. Clear any seedling like any other plant if it landed somewhere you did not want it.',
} as const;
