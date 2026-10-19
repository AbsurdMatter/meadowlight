import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { FOG } from '../data/environment';
import { skyPaletteAt, GOLDEN_HOUR } from '../engine/dayCycle';

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

export function Sky() {
  const { scene } = useThree();
  const skyTexture = useMemo(() => {
    const palette = skyPaletteAt(GOLDEN_HOUR);
    const size = 256;
    const bands = 14;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    // banded gradient: each band is a flat fill of a quantized blend — the
    // stepped language of the meadow, in the sky
    const top = new THREE.Color(palette.top);
    const mid = new THREE.Color(palette.mid);
    const horizon = new THREE.Color(palette.horizon);
    for (let b = 0; b < bands; b++) {
      const t = b / (bands - 1);
      // two-stop blend: top->mid for the upper half, mid->horizon below
      let c: THREE.Color;
      if (t < 0.55) c = bandColor(top, mid, t / 0.55, 7);
      else c = bandColor(mid, horizon, (t - 0.55) / 0.45, 6);
      ctx.fillStyle = '#' + c.getHexString();
      ctx.fillRect(0, Math.floor((b / bands) * size), size, Math.ceil(size / bands) + 1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  useMemo(() => {
    scene.background = skyTexture;
    scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);
  }, [scene, skyTexture]);
  return null;
}

/**
 * Distant terrain variation (#6): a silhouette ridge beyond the hills zone —
 * flat, fog-melted boxes in a ring far out (r 56..74), heights stepping with
 * the day palette's horizon. Composes with the #31 second rim (they read as
 * further ranges). One instanced mesh, static.
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
