import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { scaledDelta } from '../engine/scaledTime';
import * as THREE from 'three';
import { precipitationVisual } from '../engine/weather';
import { PRECIP_TUNING, RAIN_VISUAL } from '../data/rain';

/**
 * #14 (session 5) + session 8 N1: gentle voxel precipitation — one
 * instanced mesh, zero cost when dry (count 0). Cozy: no storm darkness,
 * no fail state; the meadow just gets a soft wash. N1 round 2: winter
 * renders SNOW (decided) — slower, softer, whiter flakes; spring/summer/
 * autumn render the session-5 rain columns (visual unchanged). The kind
 * and the fast settle intensity both come from the ONE schedule source
 * (engine/rainSchedule via weather.precipitationVisual) — no local state,
 * no input path.
 */
export const rainDebug = { count: 0, kind: 'dry' as 'dry' | 'rain' | 'snow', intensity: 0 };

interface Drop {
  x: number;
  z: number;
  y: number;
  speed: number;
  len: number;
}

export function Rain() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const drops = useRef<Drop[]>([]);
  const seededFor = useRef<'' | 'rain' | 'snow'>('');

  // #14 blocker fix: park every instance at zero scale on mount and force
  // count 0. three.js InstancedMesh constructors set count = capacity and
  // leave matrices as identity, so an unparked mesh renders `capacity`
  // 1x1x1 unit cubes at the origin (the "floating ghost voxel" over the
  // meadow) until rain first toggles. Park on mount; the dry branch below
  // also parks unconditionally.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const park = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < RAIN_VISUAL.drops; i++) mesh.setMatrixAt(i, park);
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const vis = precipitationVisual();
    const kind = vis ? vis.kind : null;
    rainDebug.kind = kind ?? 'dry';
    rainDebug.intensity = vis ? vis.intensity : 0;

    // park + return when dry (unconditional — the boot-state lesson)
    if (!vis) {
      seededFor.current = '';
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
      rainDebug.count = 0;
      return;
    }

    // (re)seed the column field when the kind CHANGES (rain <-> snow have
    // different speeds/sizes; re-seeding mid-settle would restart the fall
    // visually, so seeding keys on kind only, never on intensity)
    if (seededFor.current !== vis.kind) {
      seededFor.current = vis.kind;
      const list: Drop[] = [];
      const area = vis.kind === 'snow' ? PRECIP_TUNING.snow.size * RAIN_VISUAL.areaHalf : RAIN_VISUAL.areaHalf;
      for (let i = 0; i < RAIN_VISUAL.drops; i++) {
        list.push({
          x: (Math.random() * 2 - 1) * area,
          z: (Math.random() * 2 - 1) * area,
          y: Math.random() * RAIN_VISUAL.top,
          speed: vis.kind === 'snow'
            ? PRECIP_TUNING.snow.fallSpeed * (0.85 + Math.random() * 0.3)
            : RAIN_VISUAL.fallSpeed * (0.85 + Math.random() * 0.3),
          len: 0.5 + Math.random() * 0.5,
        });
      }
      drops.current = list;
      // the shared instanced mesh re-materials per kind (one mesh, one
      // material object — only its color/opacity mutate; no remount)
      if (matRef.current) {
        if (vis.kind === 'snow') {
          matRef.current.color.set(PRECIP_TUNING.snow.color);
          matRef.current.opacity = PRECIP_TUNING.snow.opacity;
        } else {
          matRef.current.color.set(RAIN_VISUAL.color);
          matRef.current.opacity = RAIN_VISUAL.opacity;
        }
      }
    }

    const delta = scaledDelta();
    const thickness = vis.kind === 'snow' ? PRECIP_TUNING.snow.size : 0.045;
    const windX = vis.kind === 'snow' ? PRECIP_TUNING.snow.windX : RAIN_VISUAL.windX;
    const mat = new THREE.Matrix4();
    let i = 0;
    const cap = Math.floor(RAIN_VISUAL.drops * vis.intensity);
    for (const d of drops.current) {
      d.y -= d.speed * delta;
      d.x += windX * delta;
      if (d.y < 0) {
        d.y = RAIN_VISUAL.top;
        d.x = (Math.random() * 2 - 1) * RAIN_VISUAL.areaHalf;
        d.z = (Math.random() * 2 - 1) * RAIN_VISUAL.areaHalf;
      }
      if (i < cap) {
        mat.makeScale(thickness, d.len, thickness);
        mat.setPosition(d.x, d.y, d.z);
        mesh.setMatrixAt(i, mat);
        i++;
      }
    }
    rainDebug.count = i;
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, RAIN_VISUAL.drops]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        color={RAIN_VISUAL.color}
        transparent
        opacity={RAIN_VISUAL.opacity}
      />
    </instancedMesh>
  );
}
