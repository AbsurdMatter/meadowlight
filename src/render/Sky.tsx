import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { FOG, HILLS, shapedHeight } from '../data/environment';
import { skyPaletteAt, dayPhase, advanceDay } from '../engine/dayCycle';
import { advanceSeasons, seasonClockOverridden } from '../engine/seasonClock';
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
    // ONE time system: this is the single site that advances both clocks
    // (day cycle + #11 season calendar). Nothing else may tick either —
    // a second advance site is how two clocks drift apart.
    advanceDay(delta);
    if (!seasonClockOverridden()) {
      const store = usePlacementStore.getState();
      const crossed = advanceSeasons(delta, store.season);
      if (crossed.length > 0) store.arriveAtSeason(crossed[crossed.length - 1], true);
    }
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
  const count = 96;
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const rng = (() => {
      let s = 60221;
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
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng() * 0.06;
      const r = 50 + rng() * 12;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // ground at this box's own position, from the shared oracle —
      // the same function the hills renderer and placement use
      const ground = shapedHeight(x, z);
      // hills, not a wall: extents match the far-hills scale (1.4 box
      // height + rise), with a mild range boost at two headings
      const rangeBoost = Math.max(0, Math.cos(a * 2 + 0.8)) * 1.1;
      const h = HILLS.boxHeight + 1.2 + rng() * 1.4 + rangeBoost;
      const w = 9 + rng() * 6;
      // PR #35 second-round fix (the point-anchor was not enough): a
      // distant hill must read as land rising from the terrain — the box
      // bottom must sit BELOW ground across its FULL footprint, with
      // margin for reachable viewing angles. The center is placed so the
      // box rises h above the LOCAL anchor ground and extends a fixed
      // 4.5u skirt below it — deeper than the ~2u the terrain can rise
      // across a 15u-wide box footprint, so no edge bottom clears the
      // terrain behind it at any camera angle the orbit allows.
      const skirt = 4.5;
      const total = h + skirt;
      mat.makeScale(w, total, 4);
      // bottom = ground - skirt (sunk below terrain with margin); the
      // visible hill crest still rises h above the anchor ground
      mat.setPosition(x, ground - skirt + total / 2, z);
      mesh.setMatrixAt(i, mat);
      // the hills' own color logic: hill palette, fog-blended by distance
      // with the same curve the Hills renderer uses (fogBlendStrength 0.55)
      const t = THREE.MathUtils.clamp(
        (r - HILLS.fogBlendStart) / (HILLS.fogBlendEnd - HILLS.fogBlendStart),
        0,
        1,
      );
      const base = hillColors[Math.floor(rng() * hillColors.length)];
      color.copy(base).lerp(fogColor, t * HILLS.fogBlendStrength);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}
