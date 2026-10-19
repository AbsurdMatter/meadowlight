/**
 * #14 (session 5): gentle rain. Cozy weather, never a fail state: rain only
 * changes what you SEE (bees home, flowers glisten, audio hushes) — appeal
 * never drops, nothing is ever punished. Pure module: the P harness can
 * toggle it, the renderers read one source.
 */

const weather = { raining: false };
export function isRaining(): boolean {
  return weather.raining;
}
/** P harness / tests: toggle rain on/off directly */
export function setRaining(v: boolean): void {
  weather.raining = v;
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
