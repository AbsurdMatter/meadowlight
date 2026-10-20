/**
 * Session 7 fix unit (#37 comments 6295330190 / 6295337642): the ONE shared
 * scaled animation clock.
 *
 * The regression: the SIMULATION scaled (Sky.tsx multiplies its frame delta
 * by timeMultiplier() before advancing the day/season clocks) but every
 * ANIMATION system consumed R3F's raw frame delta / clock.elapsedTime —
 * a two-sources dt regression, and pause (multiplier 0) never reached the
 * animation layer at all, so pause was an invisible state.
 *
 * The fix is at the source, not per-system: ONE accumulator, ticked from
 * the ONE time system (Sky.tsx's useFrame — the same single site that
 * advances the day/season clocks), holding dt * timeMultiplier() (exactly
 * 0 when paused). Every animation system reads scaledDelta() /
 * scaledElapsed() from here; none may touch R3F's raw delta or
 * clock.elapsedTime for world motion.
 *
 * Pause semantics (user decision, named in AGENTS.md): FULL FREEZE — the
 * world holds its breath, sim AND animation. One scaled dt (0 when paused)
 * achieves this at the source; there is no sim-frozen-but-animating state
 * and no per-system pause checks.
 *
 * Frame-order note: Sky mounts first in the scene, so its useFrame ticks
 * this accumulator before the animation systems read it each frame.
 */
import { timeMultiplier } from './timeControl';

const state = { elapsed: 0, lastDelta: 0 };

/** the single tick — called ONLY from Sky.tsx's useFrame (the one time site) */
export function tickScaledTime(rawDelta: number): void {
  const d = rawDelta * timeMultiplier();
  state.lastDelta = d;
  state.elapsed += d;
}

/** the scaled frame delta (0 while paused) — what animation systems consume */
export function scaledDelta(): number {
  return state.lastDelta;
}

/** the scaled elapsed time (frozen while paused) — for phase/bob/pulse math */
export function scaledElapsed(): number {
  return state.elapsed;
}
