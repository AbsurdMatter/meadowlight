/** Ambient audio tuning — all values live here, never in components. */
export const AMBIENT_AUDIO = {
  /** wind: band-passed noise, slowly breathing gain */
  wind: {
    filterFreq: 320,
    filterQ: 0.6,
    lfoHz: 0.07,
    lfoDepth: 0.5,
    baseGain: 0.06,
  },
  /** bee buzz: detuned saw pair, amplitude follows live bee count */
  buzz: {
    baseHz: 170,
    detune: 6,
    /** buzz gain per bee at the cap (total scaled 0..1) */
    maxGain: 0.045,
    /** bee count at which the buzz reaches full volume */
    fullAtBees: 60,
    /** the filter that keeps the buzz soft and round */
    filterFreq: 900,
    filterQ: 2,
  },
  master: {
    /** gentle overall cap so nothing is ever loud */
    maxGain: 0.5,
  },
} as const;
