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
