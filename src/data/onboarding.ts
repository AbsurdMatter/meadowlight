import type { Season } from './seasons';

/**
 * O1 (v4, #39): onboarding tuning — all values live here, never in
 * components. The onboarding lives INSIDE the fiction: the notebook
 * "notices" things; there is never a modal wall of text.
 */
export const ONBOARDING_TUNING = {
  /**
   * The seeded starter patch — a few flowers + a hive alive on frame one.
   * Derived from the worldSeed via the shared seeded hash (hash2), NEVER
   * Math.random: the same seed always grows the same welcome meadow.
   * Species chosen to bloom in the boot season (summer) so the meadow
   * reads alive immediately; positions keep clear of the pond (the ground
   * oracle is consulted at seed time — a fold cell never receives a plant).
   */
  starter: {
    /** (plantId, ring position) pairs — 5 flowers in a gentle drift */
    flowers: [
      { plantId: 'lavender', ring: 0 },
      { plantId: 'clover', ring: 1 },
      { plantId: 'lavender', ring: 2 },
      { plantId: 'clover', ring: 3 },
      { plantId: 'lavender', ring: 4 },
    ] as { plantId: string; ring: number }[],
    /** the hive's ring position (frame one: a colony is alive) */
    hiveRing: 2.5,
    /** drift radius of the flower ring around meadow center */
    ringRadius: 5,
    /** angular jitter per ring slot (seeded, subtle — never a perfect circle) */
    jitter: 0.35,
  },
  /**
   * Timed notebook nudges, in-fiction. Each nudge fires on a REAL condition
   * (never a fake timer alone): the condition is the trigger, the delay is
   * the minimum quiet before it may speak. Nudges write the SAME state the
   * player's own actions write (openNotebook — one input path).
   */
  nudges: {
    /** minimum seconds of world time before the first nudge may fire */
    firstAfterSeconds: 20,
    /** quiet between nudges (seconds of world time) */
    gapSeconds: 45,
    /** the season-dial nudge fires once the player has seen a season change */
    seasonDialAfterSeasons: 1,
  },
  /** show-once persistence: the whole onboarding is dismissed forever */
  showOnce: true,
} as const;

/** the boot season a fresh world starts in (matches persistence freshWorld) */
export const BOOT_SEASON: Season = 'summer';
