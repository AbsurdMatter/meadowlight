/**
 * #14 (session 5): gentle rain. Cozy weather, never a fail state: rain only
 * changes what you SEE (bees home, flowers glisten, audio hushes) — appeal
 * never drops, nothing is ever punished. Pure module: the P harness can
 * toggle it, the renderers read one source.
 *
 * Session 8 N1: isRaining() is now the ONE resolver over the natural
 * season-weighted schedule (engine/rainSchedule — deterministic windows on
 * the shared scaled clock) plus the P-panel manual override. The P-panel
 * rain ON/OFF buttons remain the session-5 trigger suite: while an override
 * holds it masks the natural verdict; releasing it (rain OFF with no
 * schedule rain, or a fresh tick) drops back to the schedule with no step.
 * Consumers (BeeSwarm bees-home, PlantedFlowers glisten, audio hush,
 * Rain renderer) keep reading isRaining() exactly as before — no new
 * machinery, composition only.
 */
import { clearManualRain, resolveNaturalRain, setManualRain } from './rainSchedule';

export function isRaining(): boolean {
  return resolveNaturalRain();
}

/**
 * P harness / tests: toggle rain on/off directly — the manual override on
 * top of the natural schedule (masks the natural verdict while it holds).
 */
export function setRaining(v: boolean): void {
  setManualRain(v);
}

/** P harness / tests: release the override — the natural schedule drives again */
export function releaseRainOverride(): void {
  clearManualRain();
}

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
