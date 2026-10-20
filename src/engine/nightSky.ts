/**
 * Session 7 U5: the star-visibility predicate — PURE, ONE shared source.
 *
 * Derives night from the SAME epsilon-tolerant lit window the bees, the P
 * panel, and the save use (DAYLIGHT_START..DAYLIGHT_END in dayCycle) —
 * never a second definition of night. The render (NightSky.tsx), the unit
 * tests, and the gate all read this function.
 *
 *   deep night (before 0.22 / after 0.88): fully visible
 *   dusk ramp 0.80 -> 0.88: 0 -> 1 (golden hour darkens into stars)
 *   dawn ramp 0.22 -> 0.30: 1 -> 0 (stars out by full morning)
 */
import { DAYLIGHT_START, DAYLIGHT_END } from './dayCycle';

export function starVisibility(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  if (p > 0.8 && p <= DAYLIGHT_END) {
    return (p - 0.8) / (DAYLIGHT_END - 0.8);
  }
  if (p >= DAYLIGHT_START && p < 0.3) {
    return 1 - (p - DAYLIGHT_START) / (0.3 - DAYLIGHT_START);
  }
  if (p < DAYLIGHT_START || p > DAYLIGHT_END) return 1;
  return 0;
}
