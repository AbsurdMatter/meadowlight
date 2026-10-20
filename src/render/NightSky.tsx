import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { NIGHT_SKY_TUNING } from '../data/nightSky';
import { dayPhase } from '../engine/dayCycle';
import { starVisibility } from '../engine/nightSky';
import { scaledElapsed } from '../engine/scaledTime';
import { usePlacementStore } from './placementStore';

/**
 * Session 7 U5 (#new): the night sky.
 *
 * ONE shared phase source: star visibility derives from the SAME
 * epsilon-tolerant lit window the bees/panel/save use (DAYLIGHT_START..
 * DAYLIGHT_END) — never a second definition of night. Stars fade in
 * through the golden-hour-to-dusk ramp (the sky palette's own keyframes:
 * from 0.88's fade toward the 1.0 night keys), gone by dawn, brightest
 * in winter (brightnessBySeason).
 *
 * Instanced boxes on a dome (voxel language), seeded-hash layout — no
 * Math.random, deterministic across reloads. Slow drift + gentle twinkle
 * on the shared scaled clock (full freeze holds).
 *
/** live telemetry (the beeDebug pattern) — the gate reads this */
export const starsDebug = { visible: 0, opacity: 0 };

const park = new THREE.Matrix4().makeScale(0, 0, 0);

/** deterministic dome layout (the grass hash pattern) */
function hash2(x: number, z: number, salt: number): number {
  let h = (x * 374761393 + z * 668265263 + salt * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export function NightSky() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const t = NIGHT_SKY_TUNING.stars;
  const layout = useMemo(() => {
    const out: { pos: THREE.Vector3; size: number; color: string; phase: number }[] = [];
    for (let i = 0; i < t.count; i++) {
      // fibonacci-ish spread with hash jitter: uniform over the dome
      const a = (i * 2.399963) % (Math.PI * 2) + hash2(i, 3, 1) * 0.22;
      const y = 0.12 + Math.pow(hash2(i, 7, 2), 1.4) * 0.78; // biased above horizon
      const horiz = Math.sqrt(Math.max(0, 1 - y * y));
      out.push({
        pos: new THREE.Vector3(
          Math.cos(a) * horiz * t.radius,
          y * t.radius,
          Math.sin(a) * horiz * t.radius,
        ),
        size: t.size * (1 - t.sizeJitter / 2 + hash2(i, 11, 3) * t.sizeJitter),
        color: t.colors[Math.floor(hash2(i, 13, 4) * t.colors.length)],
        phase: hash2(i, 17, 5) * Math.PI * 2,
      });
    }
    return out;
  }, [t]);

  const groupRef = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.Matrix4(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const driftPerSec = useMemo(() => (Math.PI * 2) / NIGHT_SKY_TUNING.stars.driftSeconds, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < layout.length; i++) mesh.setMatrixAt(i, park);
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
  }, [layout]);

  useFrame(() => {
    const mesh = meshRef.current;
    const group = groupRef.current;
    if (!mesh || !group) return;
    const season = usePlacementStore.getState().season;
    const visibility = starVisibility(dayPhase());
    const seasonBrightness = t.brightnessBySeason[season] ?? 0.85;
    const baseOpacity = visibility * seasonBrightness;
    // material opacity carries the fade (one shared transparent material)
    const mat3 = mesh.material as THREE.MeshBasicMaterial;
    mat3.opacity = Math.min(1, baseOpacity);
    starsDebug.opacity = mat3.opacity;
    if (baseOpacity <= 0.01) {
      if (mesh.count !== 0) {
        mesh.count = 0;
        mesh.instanceMatrix.needsUpdate = true;
      }
      starsDebug.visible = 0;
      return;
    }
    // slow drift around the pole (scaled clock — frozen under pause)
    group.rotation.y = (scaledElapsed() * driftPerSec) % (Math.PI * 2);
    const time = scaledElapsed();
    for (let i = 0; i < layout.length; i++) {
      const s = layout[i];
      const twinkle =
        1 - t.twinkleAmplitude * (0.5 + 0.5 * Math.sin(time * t.twinkleSpeed + s.phase));
      const scale = s.size * twinkle;
      mat.makeTranslation(s.pos.x, s.pos.y, s.pos.z);
      mat.scale(new THREE.Vector3(scale, scale, scale));
      mesh.setMatrixAt(i, mat);
      mesh.setColorAt(i, color.set(s.color));
    }
    mesh.count = layout.length;
    starsDebug.visible = layout.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, t.count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
