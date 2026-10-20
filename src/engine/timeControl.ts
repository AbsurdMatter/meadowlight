/**
 * #36 item 2 (session 6, approved scope): scene speed control — pause +
 * discrete multipliers (1x/2x/4x/8x), plus a "jump to morning / spring"
 * convenience that reuses the EXISTING force-day/force-season override
 * paths (never a new time path).
 *
 * ONE SHARED SCALING SITE: Sky.tsx multiplies delta once and passes the
 * scaled delta to BOTH advanceDay and advanceSeasons — never two separate
 * scalings (the two clocks can never drift out of proportion). The tuned
 * constants (DAY_CYCLE_SECONDS, SEASON_SECONDS) are untouched.
 *
 * NOT PERSISTED (deliberate): a paused or accelerated meadow on reload
 * resumes natural time — a returning visitor must never find a frozen
 * world. The control state lives only in this module's memory.
 *
 * 8x rationale (user follow-up): night and winter read as too long — 8x
 * turns the 12-min day into 90s and a season into ~2 min, so a slow phase
 * can be genuinely skipped past, not nudged. Any override (forced phase
 * or forced season) still pauses the natural clock exactly as before;
 * speed applies only to natural drift.
 */

export const SPEED_STEPS = [1, 2, 4, 8] as const;
export type SpeedStep = (typeof SPEED_STEPS)[number];

const control = { multiplier: 1 as SpeedStep, paused: false };

/** the current speed multiplier (1 when paused — pause wins) */
export function timeMultiplier(): number {
  return control.paused ? 0 : control.multiplier;
}

export function isPaused(): boolean {
  return control.paused;
}

export function currentSpeedStep(): SpeedStep {
  return control.multiplier;
}

export function setSpeedStep(step: SpeedStep): void {
  if (!SPEED_STEPS.includes(step)) return;
  control.multiplier = step;
  control.paused = false;
}

export function setPaused(paused: boolean): void {
  control.paused = paused;
}
