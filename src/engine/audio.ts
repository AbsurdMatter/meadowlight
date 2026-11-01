import { AMBIENT_AUDIO } from '../data/audio';
import { isRaining, RAIN_TUNING } from './weather';

/**
 * Ambient audio: soft generated wind + gentle bee buzz via WebAudio.
 *
 * Rules honored here:
 *  - OFF by default; the graph is only constructed on the user's toggle
 *    click (browser autoplay policy: audio must start from a gesture).
 *  - Buzz volume follows the live bee count (hive + solitary + rare),
 *    re-read from the placement store each tick.
 *  - Nothing here touches the DOM or canvas events.
 *
 * The graph:
 *   noiseBuffer -> BufferSource(loop) -> BiquadFilter(bandpass) -> windGain
 *                                                        LFO -> windGain.gain
 *   osc(saw 170Hz) + osc(saw 170Hz detuned) -> BiquadFilter(lowpass) -> buzzGain
 *   windGain + buzzGain -> masterGain -> destination
 */

export interface AudioDebugInfo {
  running: boolean;
  nodes: {
    windSource: boolean;
    windFilter: boolean;
    windGain: boolean;
    buzzOsc1: boolean;
    buzzOsc2: boolean;
    buzzFilter: boolean;
    buzzGain: boolean;
    masterGain: boolean;
  };
  beeCountAtLastTick: number;
}

interface AmbientAudio {
  ctx: AudioContext | null;
  masterGain: GainNode | null;
  windGain: GainNode | null;
  buzzGain: GainNode | null;
  buzzOsc1: OscillatorNode | null;
  buzzOsc2: OscillatorNode | null;
  windSource: AudioBufferSourceNode | null;
  lfo: OscillatorNode | null;
  tickTimer: ReturnType<typeof setInterval> | null;
  beeCountAtLastTick: number;
}

const audio: AmbientAudio = {
  ctx: null,
  masterGain: null,
  windGain: null,
  buzzGain: null,
  buzzOsc1: null,
  buzzOsc2: null,
  windSource: null,
  lfo: null,
  tickTimer: null,
  beeCountAtLastTick: 0,
};

/** getBeeCount is injected so the engine stays free of render imports */
let getBeeCount: () => number = () => 0;
export function setBeeCountSource(fn: () => number) {
  getBeeCount = fn;
}

/**
 * O3 (v4, #41): the PURE buzz-level function — the one source the live
 * tick and the unit/gate tests read. Volume follows the live bee count
 * (0..1 scaled to maxGain), hushed by rain/snow (the same natural-condition
 * source the visuals read — one clock, one truth). Unit-testable: no
 * WebAudio, no DOM.
 */
export function buzzLevelForBeeCount(count: number): number {
  const bees = Math.max(0, count);
  let level = Math.min(1, bees / AMBIENT_AUDIO.buzz.fullAtBees) * AMBIENT_AUDIO.buzz.maxGain;
  if (isRaining()) level *= RAIN_TUNING.audioDamp;
  return level;
}

/**
 * O3 (v4, #41): the toggle's persisted state (save-additive: the audio
 * preference survives reloads; OFF by default, ever). The corner toggle is
 * the SINGLE switch — this is its state, nothing else writes it.
 */
const AUDIO_PREF_KEY = 'meadowlight.audio';
export function audioEnabled(): boolean {
  try {
    return localStorage.getItem(AUDIO_PREF_KEY) === '1';
  } catch {
    return false;
  }
}
export function setAudioEnabled(on: boolean): void {
  try {
    localStorage.setItem(AUDIO_PREF_KEY, on ? '1' : '0');
  } catch {
    // storage unavailable — the toggle just lives in memory
  }
}

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    // pink-ish noise: smoothed random, gentler than raw white
    const white = Math.random() * 2 - 1;
    last = last * 0.97 + white * 0.03;
    data[i] = last * 8;
  }
  return buf;
}

/** Construct and start the graph. Only call from a user gesture. */
export function startAmbientAudio(): boolean {
  if (audio.ctx) {
    void audio.ctx.resume();
    return true;
  }
  try {
    const Ctor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    const ctx = new Ctor();
    const masterGain = ctx.createGain();
    masterGain.gain.value = AMBIENT_AUDIO.master.maxGain;
    masterGain.connect(ctx.destination);

    // wind
    const windSource = ctx.createBufferSource();
    windSource.buffer = makeNoiseBuffer(ctx);
    windSource.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = AMBIENT_AUDIO.wind.filterFreq;
    windFilter.Q.value = AMBIENT_AUDIO.wind.filterQ;
    const windGain = ctx.createGain();
    windGain.gain.value = AMBIENT_AUDIO.wind.baseGain;
    windSource.connect(windFilter).connect(windGain).connect(masterGain);

    // slow breathing LFO on the wind
    const lfo = ctx.createOscillator();
    lfo.frequency.value = AMBIENT_AUDIO.wind.lfoHz;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = AMBIENT_AUDIO.wind.baseGain * AMBIENT_AUDIO.wind.lfoDepth;
    lfo.connect(lfoDepth).connect(windGain.gain);

    // bee buzz
    const buzzOsc1 = ctx.createOscillator();
    buzzOsc1.type = 'sawtooth';
    buzzOsc1.frequency.value = AMBIENT_AUDIO.buzz.baseHz;
    const buzzOsc2 = ctx.createOscillator();
    buzzOsc2.type = 'sawtooth';
    buzzOsc2.frequency.value = AMBIENT_AUDIO.buzz.baseHz;
    buzzOsc2.detune.value = AMBIENT_AUDIO.buzz.detune;
    const buzzFilter = ctx.createBiquadFilter();
    buzzFilter.type = 'lowpass';
    buzzFilter.frequency.value = AMBIENT_AUDIO.buzz.filterFreq;
    buzzFilter.Q.value = AMBIENT_AUDIO.buzz.filterQ;
    const buzzGain = ctx.createGain();
    buzzGain.gain.value = 0;
    buzzOsc1.connect(buzzFilter);
    buzzOsc2.connect(buzzFilter);
    buzzFilter.connect(buzzGain).connect(masterGain);

    windSource.start();
    lfo.start();
    buzzOsc1.start();
    buzzOsc2.start();

    audio.ctx = ctx;
    audio.masterGain = masterGain;
    audio.windGain = windGain;
    audio.buzzGain = buzzGain;
    audio.buzzOsc1 = buzzOsc1;
    audio.buzzOsc2 = buzzOsc2;
    audio.windSource = windSource;
    audio.lfo = lfo;

    // buzz volume follows the live bee count (cheap tick, not per frame) —
    // through the ONE pure function (buzzLevelForBeeCount), so the gate and
    // the tick read the same source. Rain/snow hush comes from the same
    // natural-condition source the visuals read (one clock, one truth).
    audio.tickTimer = setInterval(() => {
      try {
        const count = getBeeCount();
        audio.beeCountAtLastTick = count;
        if (!audio.buzzGain || !audio.ctx) return;
        const t = audio.ctx.currentTime;
        audio.buzzGain.gain.setTargetAtTime(buzzLevelForBeeCount(count), t, 0.4);
      } catch {
        // never let the audio tick throw
      }
    }, 1000);
    setAudioEnabled(true);
    return true;
  } catch {
    audio.ctx = null;
    return false;
  }
}

/** Suspend and tear down. Safe to call when never started. */
export function stopAmbientAudio(): void {
  try {
    if (audio.tickTimer) clearInterval(audio.tickTimer);
    audio.tickTimer = null;
    audio.windSource?.stop();
    audio.lfo?.stop();
    audio.buzzOsc1?.stop();
    audio.buzzOsc2?.stop();
    void audio.ctx?.close();
  } catch {
    // teardown must never throw
  }
  audio.ctx = null;
  audio.masterGain = null;
  audio.windGain = null;
  audio.buzzGain = null;
  audio.buzzOsc1 = null;
  audio.buzzOsc2 = null;
  audio.windSource = null;
  audio.lfo = null;
  setAudioEnabled(false);
}

/** Is the audio graph live right now? */
export function audioRunning(): boolean {
  return !!audio.ctx && audio.ctx.state !== 'closed';
}

/** Readback for the test harness: verify the graph by construction. */
export function audioDebugInfo(): AudioDebugInfo | null {
  if (!audio.ctx) return null;
  return {
    running: audioRunning(),
    nodes: {
      windSource: !!audio.windSource,
      windFilter: !!audio.windSource,
      windGain: !!audio.windGain,
      buzzOsc1: !!audio.buzzOsc1,
      buzzOsc2: !!audio.buzzOsc2,
      buzzFilter: !!audio.buzzOsc1,
      buzzGain: !!audio.buzzGain,
      masterGain: !!audio.masterGain,
    },
    beeCountAtLastTick: audio.beeCountAtLastTick,
  };
}
