/**
 * Session 8 N1: the natural rain schedule tuning — one source in data.
 *
 * Rain arrives on its own in deterministic season-weighted windows
 * (engine/rainSchedule consumes this): winter most, summer least, never
 * purely random. The weighting IS the spell curve — wetShare is the
 * chance-of-rain ceiling per season, and a season's weather ladder is
 * derived entirely from the world's seed, so the same world weathers the
 * same across reloads and machines.
 */
export const RAIN_SCHEDULE_TUNING = {
  /** chance-of-rain ceiling per season (winter most, summer least) */
  wetShare: {
    spring: 0.3,
    summer: 0.12,
    autumn: 0.24,
    winter: 0.45,
  },
  /** how many wet/dry quanta a season breaks into (window granularity) */
  quantum: 12,
  /** fraction of the season where the wet chance eases in/out (no step at boundaries) */
  edgeEase: 0.1,
} as const;

/**
 * N1 PROPOSAL (taste-first, user eyeball decides): does winter precipitation
 * read as RAIN or SNOW? Defaults to 'rain' — the existing, already-tuned
 * visual — until the user's eyeball picks from screenshots. Switching to
 * 'snow' re-tunes ONLY renderer constants (drop size/speed/spread) via this
 * data flag, never schedule logic.
 */
export const RAIN_PROPOSAL = {
  winterPrecip: 'rain' as 'rain' | 'snow',
} as const;
