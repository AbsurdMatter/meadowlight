import type { Season } from './seasons';

/**
 * #15 (session 5): butterflies & hoverflies — distinct species mapped to
 * real pollinator principles. Both reuse the bee swarm's steering approach
 * (see WildPollinators.tsx) — no new simulation system.
 */

export interface WildPollinatorTuning {
  id: 'butterfly' | 'hoverfly';
  /** body size (butterflies read BIG at gameplay distance, hoverflies tiny) */
  bodySize: [number, number, number];
  bodyColor: string;
  /** wing color — butterflies carry the identification color */
  wingColor: string;
  wingAccentColor: string;
  wingOpacity: number;
  /** flight: butterflies arc slowly, hoverflies dart and hover in place */
  speed: number;
  wanderStrength: number;
  bobAmplitude: number;
  bobSpeed: number;
  restSeconds: [number, number];
  /** population: active per blooming patch of the meadow */
  baseCount: number;
  maxCount: number;
  /** seasons these visitors are active (no butterflies in winter) */
  activeSeasons: Season[];
}

export const BUTTERFLY_TUNING: WildPollinatorTuning = {
  id: 'butterfly',
  bodySize: [0.14, 0.1, 0.34],
  bodyColor: '#3a2a1a',
  wingColor: '#e8a03c',
  wingAccentColor: '#f2d49b',
  wingOpacity: 0.95,
  // slow arcing flight — visibly unlike the bees' direct lines
  speed: 2.6,
  wanderStrength: 3.2,
  bobAmplitude: 0.22,
  bobSpeed: 3.4,
  restSeconds: [2.0, 4.5],
  baseCount: 2,
  maxCount: 6,
  activeSeasons: ['spring', 'summer', 'autumn'],
};

export const HOVERFLY_TUNING: WildPollinatorTuning = {
  id: 'hoverfly',
  // tiny — half a bee — with the mimic's stripes (bodyColor + wingColor band)
  bodySize: [0.11, 0.08, 0.16],
  bodyColor: '#e8c83a',
  wingColor: '#4a3527',
  wingAccentColor: '#fdf6e3',
  wingOpacity: 0.6,
  // darting flight with station-keeping hops (high wander, short rests)
  speed: 3.8,
  wanderStrength: 2.4,
  bobAmplitude: 0.08,
  bobSpeed: 9,
  restSeconds: [0.3, 0.9],
  baseCount: 2,
  maxCount: 5,
  activeSeasons: ['spring', 'summer', 'autumn'],
};

/** minimum blooming flowers before wild visitors appear at all */
export const WILD_MIN_BLOOM = 3;

/** flower-count-to-visitor scaling: one extra visitor per N blooming flowers */
export const WILD_FLOWERS_PER_EXTRA = 12;
