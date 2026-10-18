/**
 * General placement variation: random Y-rotation + slight height jitter +
 * minimal tilt, decided ONCE at placement time and frozen into the save.
 * Existing saves are never re-randomized (they simply carry neutral values).
 */

export interface PlacementVariation {
  rotationY: number;
  heightJitter: number;
  tiltX: number;
  tiltZ: number;
}

export const VARIATION_TUNING = {
  heightJitter: 0.05,
  maxTilt: 0.06, // radians (~3.4 degrees)
} as const;

export const DEFAULT_PLACEMENT_VARIATION = true;

const neutral: PlacementVariation = { rotationY: 0, heightJitter: 0, tiltX: 0, tiltZ: 0 };

/** Neutral variation (toggle OFF, or legacy saves). */
export function noVariation(): PlacementVariation {
  return { ...neutral };
}

/** Roll fresh variation for a newly placed item (toggle ON). */
export function rollVariation(): PlacementVariation {
  return {
    rotationY: Math.random() * Math.PI * 2,
    heightJitter: (Math.random() * 2 - 1) * VARIATION_TUNING.heightJitter,
    tiltX: (Math.random() * 2 - 1) * VARIATION_TUNING.maxTilt,
    tiltZ: (Math.random() * 2 - 1) * VARIATION_TUNING.maxTilt,
  };
}

export function variationFor(enabled: boolean): PlacementVariation {
  return enabled ? rollVariation() : noVariation();
}
