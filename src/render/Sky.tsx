import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { FOG } from '../data/environment';
import { skyPaletteAt, GOLDEN_HOUR, dayPhase, advanceDay } from '../engine/dayCycle';

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
    advanceDay(delta);
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
 * flat, fog-melted boxes in a ring far out (r 56..74), heights stepping with
 * the day palette's horizon. Composes with the #31 second rim (they read as
 * further ranges). One instanced mesh, static.
 */
const ridgeColor = new THREE.Color();
export function DistantRidge() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 96;
  // U6: ridge silhouettes track the live sky horizon (night = dark ridge)
  useFrame(() => {
    const m = meshRef.current;
    if (!m || !m.instanceColor) return;
    const live = skyPaletteAt(dayPhase());
    const palette = skyPaletteAt(GOLDEN_HOUR);
    ridgeColor.copy(new THREE.Color(palette.horizon)).lerp(new THREE.Color(live.horizon), 0.8);
    for (let i = 0; i < count; i++) m.setColorAt(i, ridgeColor);
    m.instanceColor.needsUpdate = true;
  });
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
    const palette = skyPaletteAt(GOLDEN_HOUR);
    const base = new THREE.Color(palette.horizon);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng() * 0.06;
      const r = 56 + rng() * 18;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // stepped peaks: taller at two "range" headings for composition
      const rangeBoost = Math.max(0, Math.cos(a * 2 + 0.8)) * 5;
      const h = 4 + rng() * 3 + rangeBoost;
      const w = 9 + rng() * 6;
      mat.makeScale(w, h, 4);
      mat.setPosition(x, h * 0.28, z);
      mesh.setMatrixAt(i, mat);
      // melt toward the horizon glow: far ridges barely distinct from sky
      color.copy(base).lerp(fogColor, 0.35);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}
