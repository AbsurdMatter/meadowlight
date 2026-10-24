/**
 * #14 (session 5) + session 8 N1 round 2: gentle precipitation, natural.
 * Cozy weather, never a fail state: rain/snow only change what you SEE
 * (bees home, flowers glisten, audio hushes) — appeal never drops, nothing
 * is ever punished.
 *
 * ONE source: the schedule (engine/rainSchedule) derives every window from
 * the shared seeded hash — binary on/off, season-weighted, winter = snow.
 * This module is the resolver consumers already read: isRaining() keeps its
 * meaning (rain OR snow = precipitation for bees-home/glisten/audio-hush),
 * plus isSnowing() for the winter visual. The old P-panel force buttons are
 * GONE (binding directive: precipitation is natural and unclickable — no
 * input path; the panel shows readback only). Gates drive the season and
 * let the weather derive.
 */
import { precipitationNow, isPrecipitating, tickPrecipSchedule, setPrecipitatingForTest } from './rainSchedule';

/** true while any precipitation falls (rain or snow) — bees home, glisten, hush */
export function isRaining(): boolean {
  return isPrecipitating();
}

export { setPrecipitatingForTest };

/** true while SNOW falls (the winter visual; rain renders otherwise) */
export function isSnowing(): boolean {
  return precipitationNow()?.kind === 'snow';
}

/**
 * The live visual verdict for the precipitation renderer: null = dry.
 * Consumers scale intensity by the fast settle (rain fading in reads as
 * weather turning, not a step).
 */
export function precipitationVisual(): { kind: 'rain' | 'snow'; intensity: number } | null {
  return precipitationNow();
}

/**
 * Session-8 re-export of the schedule tick (Sky calls this at its single
 * time site); kept here so engine consumers import weather, not the
 * schedule module directly.
 */
export { tickPrecipSchedule };

export const RAIN_TUNING = {
  /** rain instance caps (one instanced mesh, columns of drops) */
  drops: 220,
  /** fall speed */
  fallSpeed: 14,
  /** the box around the meadow the rain fills */
  areaHalf: 24,
  top: 14,
  /** re-seed a drop's xy when it lands; drift the storm slowly */
  windX: 1.2,
  /** bees stay home while raining (existing headingHome path) */
  beesHome: true,
  /** flowers glisten: petal emissive pulse while raining */
  glisten: true,
  /** audio hushes to this fraction while raining */
  audioDamp: 0.45,
} as const;
