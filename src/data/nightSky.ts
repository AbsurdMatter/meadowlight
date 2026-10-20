import { CLOUDS } from './environment';

/**
 * Session 7 U5 (#new): night sky & cloud translucency.
 *
 * (a) CLOUDS: more translucent — softly veiled, never blocking the view,
 *     never gone (the session-5 legibility criterion, in reverse). Tuning
 *     lives HERE; the composed-cloud material reads it. The material value
 *     is the asserted observable (the gate reads it through the test hook).
 *
 * (b) STARS: at night through the SAME palette-lit window logic — ONE
 *     shared phase source (the isDaylight epsilon-tolerant boundaries:
 *     dawn 0.22 -> dusk 0.88; stars fade in through the golden-hour-to-dusk
 *     ramp, are gone by dawn, brightest in winter's long nights).
 *
 * No fail state, no new mechanics: pure atmosphere. The winter-long-night
 * brightness pairs with the v2 speed control (the same complaint, solved
 * from the other side).
 */
export const NIGHT_SKY_TUNING = {
  clouds: {
    /**
     * The veiled-cloud opacity (was CLOUDS.opacity 0.92 — near-opaque).
     * Softly translucent: the sky's bands read through the puffs, the
     * meadow is never walled off, and the clouds are never gone.
     */
    opacity: 0.55,
  },
  stars: {
    /** count laid on the sky dome */
    count: 160,
    /** dome radius (inside the far plane, beyond the ridge) */
    radius: 90,
    /** base size */
    size: 0.28,
    /** size jitter fraction */
    sizeJitter: 0.7,
    /** the star family: cool whites + a warm accent, the night palette's own */
    colors: ['#fdf6e3', '#e8eafc', '#fff4e0', '#dfe8ff'],
    /** slow drift: full dome rotation period, seconds of scaled time */
    driftSeconds: 600,
    /**
     * Brightness by season: winter's long nights get the fullest sky
     * (something to look at in the slow phase). The lit window is fixed
     * (0.22..0.88); winter's darkness is longer in the calendar's felt
     * time, and this multiplies the peak brightness so the winter night
     * is the memorable one.
     */
    brightnessBySeason: { spring: 0.85, summer: 0.75, autumn: 0.9, winter: 1.0 } as Record<
      string,
      number
    >,
    /** gentle twinkle (phase-offset pulse) */
    twinkleAmplitude: 0.25,
    twinkleSpeed: 0.7,
  },
} as const;

/** the original composed-cloud opacity (kept for the gate's regression read) */
export const CLOUDS_OPACITY_BEFORE = CLOUDS.opacity;
