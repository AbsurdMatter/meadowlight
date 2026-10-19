import type { Season } from './seasons';

export const BEE_TUNING = {
  /** base bees per hive at appeal 1.0 (bees scale with local appeal) */
  beesPerHive: 10,
  maxBeesPerHive: 16,
  maxBeesTotal: 180,
  /** adaptive cap: if avg frame time rises above this, shrink the swarm */
  slowFrameMs: 17,
  fastFrameMs: 13,
  adaptEveryMs: 2500,
  /** flight */
  speed: 5.5,
  arriveRadius: 0.45,
  wanderStrength: 2.2,
  bobAmplitude: 0.14,
  bobSpeed: 6,
  /** fraction of bees resting on flowers/hive at any time (gentle rhythm) */
  restChance: 0.25,
  restSeconds: [1.2, 3.5] as [number, number],
  /** body */
  bodySize: [0.22, 0.16, 0.3] as [number, number, number],
  bodyColor: '#e8b83a',
  stripeColor: '#4a3527',
  wingColor: '#fdf6e3',
  wingOpacity: 0.7,
  /** winter: bees vanish into the hive (colony clusters inside) */
  winterBeeFraction: 0,
  /** seasons where foraging is active */
  foragingSeasons: ['spring', 'summer', 'autumn'] as Season[],
} as const;

export const SOLITARY_BEE_TUNING = {
  /** solitary bees nesting per hotel — they don't form colonies */
  perHotel: 4,
  maxTotal: 40,
  /** flight: slower, shorter hops than hive bees */
  speed: 3.6,
  arriveRadius: 0.4,
  wanderStrength: 1.4,
  bobAmplitude: 0.1,
  bobSpeed: 7,
  restSeconds: [0.8, 2.2] as [number, number],
  /** body: smaller and rust-toned, clearly not hive bees */
  bodySize: [0.14, 0.11, 0.2] as [number, number, number],
  bodyColor: '#b06a3c',
  stripeColor: '#3a2a1a',
  wingColor: '#f5ead0',
  wingOpacity: 0.6,
  /** how far from its hotel a solitary bee forages */
  forageRadius: 8,
} as const;

export const RARE_POLLINATOR_TUNING = {
  /** wool-carder bee: bigger, dark, patrols its patch */
  bodySize: [0.26, 0.2, 0.34] as [number, number, number],
  bodyColor: '#3d3a35',
  stripeColor: '#c9a26a',
  wingColor: '#efe6d0',
  wingOpacity: 0.55,
  speed: 4.2,
  /** one rare pollinator per qualifying (hotel + wild corner) pair, capped */
  maxTotal: 3,
  /** hotel and wild corner must be within this range of each other */
  pairingRadius: 10,
  patrolSeconds: [2.5, 5.5] as [number, number],
} as const;
