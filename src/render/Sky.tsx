import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { FOG, HILLS } from '../data/environment';
import { ridgeBoxes, ridgeInstanceCapacity } from '../engine/hillsLayout';
import { skyPaletteAt, dayPhase, advanceDay } from '../engine/dayCycle';
import { advanceSeasons } from '../engine/seasonClock';
import { timeMultiplier } from '../engine/timeControl';
import { tickScaledTime, scaledDelta } from '../engine/scaledTime';
import { tickPrecipSchedule, setPrecipDeltaSource } from '../engine/rainSchedule';
import { usePlacementStore } from './placementStore';

/**
 * #6 (session 5): graded voxel sky. The flat linear gradient becomes a
 * BANDED gradient (quantized color steps — the sky reads as voxel-art,
 * matching the world's stepped language) built from the day-cycle palette.
 * timeOfDay defaults to golden hour, so at rest the look matches the
 * pre-session-5 meadow (no visual regression); U6's clock drives it live.
 */

/** quantize a hex color toward another in N visible steps (voxel bands) */
function bandColor(a: THREE.Color, b: THREE.Color, t: number, steps: number): THREE.Color {
  const q = Math.round(t * steps) / steps;
  return a.clone().lerp(b, q);
}

/** quantize a palette for the texture cache key: 40 steps per channel is
 *  imperceptible per-frame but stops the canvas rebuild from running 60x/s */
function paletteKey(p: ReturnType<typeof skyPaletteAt>): string {
  const q = (x: string) => Math.round(parseInt(x.slice(1), 16) / 0x080808);
  return [q(p.top), q(p.mid), q(p.horizon), q(p.fog)].join(',');
}

function buildSkyTexture(palette: ReturnType<typeof skyPaletteAt>): THREE.CanvasTexture {
  const size = 256;
  const bands = 14;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const top = new THREE.Color(palette.top);
  const mid = new THREE.Color(palette.mid);
  const horizon = new THREE.Color(palette.horizon);
  for (let b = 0; b < bands; b++) {
    const t = b / (bands - 1);
    let c: THREE.Color;
    if (t < 0.55) c = bandColor(top, mid, t / 0.55, 7);
    else c = bandColor(mid, horizon, (t - 0.55) / 0.45, 6);
    ctx.fillStyle = '#' + c.getHexString();
    ctx.fillRect(0, Math.floor((b / bands) * size), size, Math.ceil(size / bands) + 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Sky() {
  const { scene } = useThree();
  // U6: the sky follows the live day clock; the banded texture rebuilds only
  // when the quantized palette actually steps (rare), fog/light follow freely
  const texRef = useRef<THREE.CanvasTexture | null>(null);
  const lastKey = useRef('');
  const fogRef = useRef<THREE.Fog | null>(null);
  useFrame((_, delta) => {
    // ONE time system, now truly one: this single site advances both SIM
    // clocks AND ticks the shared ANIMATION clock (scaledTime) — every
    // animation system consumes scaledDelta()/scaledElapsed() from it, so
    // speed changes and pause reach the whole world through one multiply.
    tickScaledTime(delta);
    // N1: the precipitation schedule consumes the shared scaled dt for its
    // fast settle — injected ONCE here so the module stays engine-pure
    // (never an R3F import inside engine).
    setPrecipDeltaSource(scaledDelta);
    // ONE time system: this is the single site that advances both clocks
    // (day cycle + #11 season calendar). Nothing else may tick either —
    // a second advance site is how two clocks drift apart. The speed
    // control (#36 item 2) multiplies ONCE, here, for both clocks — never
    // two separate scalings; paused = multiplier 0. A forced day phase
    // holds the day clock (setDayPhase's own override); the season clock
    // has no hold — a dial selection starts the season and this site
    // keeps drifting it (round-1 finding 3).
    const scaled = delta * timeMultiplier();
    advanceDay(scaled);
    // N1 (session 8): natural precipitation advances at the SAME single time
    // site — windows derive from (worldSeed, season ordinal, progress); the
    // ordinal rides seedingEpoch (the store's rollover count, advanced at
    // the ONE season-advance site) so the weather calendar never repeats
    // box-fresh each year. Pause fully freezes it (scaled = 0); 1x-8x scales
    // the weather with everything else. No input path exists.
    const store = usePlacementStore.getState();
    tickPrecipSchedule(store.worldSeed, store.seedingEpoch, store.season);
    // Round-1 finding 3: the season calendar ALWAYS advances here — a dial
    // selection starts the season (progress 0) and this site keeps drifting
    // it; the seasonClock has no hold state. Pause freezes it via scaled = 0.
    const crossed = advanceSeasons(scaled, store.season);
    if (crossed.length > 0) store.arriveAtSeason(crossed[crossed.length - 1], true);
    const phase = dayPhase();
    const palette = skyPaletteAt(phase);
    const key = paletteKey(palette);
    if (key !== lastKey.current || !texRef.current) {
      lastKey.current = key;
      texRef.current?.dispose();
      texRef.current = buildSkyTexture(palette);
      scene.background = texRef.current;
    }
    if (!fogRef.current || fogRef.current.color.getHex() !== new THREE.Color(palette.fog).getHex()) {
      if (!fogRef.current) {
        fogRef.current = new THREE.Fog(palette.fog, FOG.near, FOG.far);
        scene.fog = fogRef.current;
      } else {
        fogRef.current.color.set(palette.fog);
      }
    }
  });
  return null;
}

/**
 * Distant terrain variation (#6): a silhouette ridge beyond the hills zone —
 * flat, fog-melted boxes in a ring (r 50..62), heights stepping with
 * the day palette's horizon. Composes with the #31 second rim (they read as
 * further ranges). One instanced mesh, static.
 *
 * PR #35 terrain fix (bottom-clears-oracle, the #28 pattern): every box is
 * anchored to the SHARED shapedHeight() at its own (x, z) — box bottom sits
 * below the terrain it visually rests on, so nothing floats. The earlier
 * version used absolute y = h * 0.28 at r 56..74, past the end of the hills
 * meshes (HILLS.outerRadius 50), leaving a floating wall over empty ground.
 */
/**
 * Distant terrain (#6, redesigned per PR #35 review): a further range of
 * hills IN THE MEADOW'S OWN VOXEL LANGUAGE — the same hillColors palette,
 * the same fog-blend math, the same lit Lambert material as the Hills
 * renderer, sitting ON the shared shapedHeight() (bottom-clears-oracle).
 * The first version inherited the sky unit's treatment (MeshBasicMaterial,
 * horizon-glow colors) and read as clouds/mist — terrain and sky are
 * distinct systems; nothing between them may read as a third thing.
 */
export function DistantRidge() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  // #83 redesign: the ridge is the same SQUARE world-lattice block family as
  // the rim, out to ridgeOuterRadius — drawn from the ONE shared layout source
  // (ridgeBoxes()), replacing the old fixed-angular-pitch w×4 boxes whose
  // rectangular footprints leaked sky at glancing short-end views.
  const count = useMemo(() => ridgeInstanceCapacity(), []);
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const rng = (() => {
      let s = 60222;
      return () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
      };
    })();
    const mat = new THREE.Matrix4();
    const color = new THREE.Color();
    const fogColor = new THREE.Color(FOG.color);
    // the HILLS renderer's own palette + fog blend — terrain, not sky
    const hillColors = HILLS.hillColors.map((c) => new THREE.Color(c));
    let i = 0;
    for (const box of ridgeBoxes()) {
      rng(); rng(); rng(); rng(); // layout consumed: jx, jz, extraH, spare
      // square footprint; bottom sunk rimSkirt below the shared shapedHeight
      // oracle at the box's own position (bottom-clears-oracle, PR #35) — the
      // layout carries the full rendered top/bottom, one source
      const size = box.half * 2;
      const boxH = box.top - box.bottom;
      mat.makeScale(size, boxH, size);
      mat.setPosition(box.x, (box.top + box.bottom) / 2, box.z);
      mesh.setMatrixAt(i, mat);
      const local = Math.hypot(box.x, box.z);
      const t = THREE.MathUtils.clamp(
        (local - HILLS.fogBlendStart) / (HILLS.fogBlendEnd - HILLS.fogBlendStart),
        0,
        1,
      );
      const base = hillColors[Math.floor(rng() * hillColors.length)];
      color.copy(base).lerp(fogColor, t * HILLS.fogBlendStrength);
      mesh.setColorAt(i, color);
      i++;
    }
    // #83: runtime invariant — three.js silently drops instances past the
    // buffer capacity; surface it loudly (gate-visible via no-console-errors)
    if (i > count) {
      console.error('[render] ridge instanced buffer under-sized: capacity ' + count + ' < drawn ' + i);
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}
