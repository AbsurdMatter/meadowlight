import type { Season } from './seasons';
import { hash3 } from '../engine/seededHash';

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

/**
 * UI round (#6383907384): per-butterfly wing palette — data flag list, ONE
 * source; the renderer picks per-butterfly by the seeded hash of the
 * butterfly's stable identity (world seed + window ordinal + index), never
 * render-side Math.random: same world = same butterfly colors.
 */
export const BUTTERFLY_WING_PALETTE = ['#d98a8a', '#a3bdd9', '#c0a8d9', '#d9b98a'] as const;
const BUTTERFLY_ACCENT_PALETTE = ['#f0cccc', '#d0e0f0', '#e4d8f0', '#f2e4cc'] as const;

/** deterministic wing + accent pair for one butterfly's stable identity */
export function butterflyColors(seed: number, ordinal: number, index: number): {
  wing: string;
  accent: string;
} {
  const h = hash3(Math.floor(seed), ordinal, index, 0xb0f1);
  const i = Math.floor(h * BUTTERFLY_WING_PALETTE.length) % BUTTERFLY_WING_PALETTE.length;
  return { wing: BUTTERFLY_WING_PALETTE[i], accent: BUTTERFLY_ACCENT_PALETTE[i] };
}

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
