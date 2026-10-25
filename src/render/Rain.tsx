import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { scaledDelta } from '../engine/scaledTime';
import * as THREE from 'three';
import { precipitationVisual } from '../engine/weather';
import { PRECIP_TUNING, RAIN_VISUAL } from '../data/rain';
import { hash2 } from '../engine/seededHash';

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

/**
 * #45 (v4): the burst spread telemetry — the xz extent of the LIVE drop
 * field, read back by the gate to prove the initial burst covers the full
 * spawn area (the user-observed concentrated burst). Display/test only.
 */
export const rainSpreadDebug = { x: 0, z: 0 };

/**
 * #45 (v4) + round-1 finding 1: ONE spawn-distribution source for the
 * initial burst AND the steady fall. Both derive x/z from the shared seeded
 * hash over the SAME full area (RAIN_VISUAL.areaHalf) — the initial burst
 * spreads across the whole area exactly like the steady emitter re-seeds a
 * landed drop. (The user-observed "concentrated burst" was the Math.random
 * initial positions vs the wider steady area; the round-1 regression was the
 * snow onset scaling the area by the flake SIZE — a 4.3u center box. The
 * flake size is the cube SCALE, never the spawn area.) A tiny hash salt
 * keeps the burst and the steady positions from coinciding exactly.
 * Pure: no Math.random anywhere in the distribution.
 */
function spawnPosition(index: number, salt: number, area: number): { x: number; z: number } {
  return {
    x: (hash2(index, salt, 0x5eed) * 2 - 1) * area,
    z: (hash2(salt, index, 0x5eed) * 2 - 1) * area,
  };
}

interface Drop {
  x: number;
  z: number;
  y: number;
  speed: number;
  len: number;
}

export function Rain() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshLambertMaterial>(null);
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
      // #45 + round-1 finding 1: the burst is distributed by the SAME seeded
      // function the steady fall uses, over the SAME full area — never a
      // concentrated patch. The old snow onset multiplied the area by the
      // flake SIZE (0.09), seeding every flake into a 4.3u box at the
      // meadow's center; the first visible frames were a tight cluster
      // mid-screen while the rest of the viewport stayed empty (the
      // user-observed "circular cluster ~1/3 screen width"). The area is
      // RAIN_VISUAL.areaHalf for BOTH kinds — the flake size is the cube
      // SCALE, not the spawn area.
      const area = RAIN_VISUAL.areaHalf;
      for (let i = 0; i < RAIN_VISUAL.drops; i++) {
        const spawn = spawnPosition(i, 1, area);
        list.push({
          x: spawn.x,
          z: spawn.z,
          y: hash2(i, 2, 0x5eed) * RAIN_VISUAL.top,
          speed: vis.kind === 'snow'
            ? PRECIP_TUNING.snow.fallSpeed * (0.85 + hash2(i, 3, 0x5eed) * 0.3)
            : RAIN_VISUAL.fallSpeed * (0.85 + hash2(i, 3, 0x5eed) * 0.3),
          len: 0.5 + hash2(i, 4, 0x5eed) * 0.5,
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
    for (let di = 0; di < drops.current.length; di++) {
      const d = drops.current[di];
      d.y -= d.speed * delta;
      d.x += windX * delta;
      if (d.y < 0) {
        d.y = RAIN_VISUAL.top;
        // #45: the steady re-seed rides the SAME distribution function —
        // one source for burst and steady fall (the drop's own index keeps
        // the roll stable and distinct from the initial-burst rolls)
        const spawn = spawnPosition(di, 5, RAIN_VISUAL.areaHalf);
        d.x = spawn.x;
        d.z = spawn.z;
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
    // #45: track the live field's xz extent (the burst-spread readback —
    // reads the drop list the mesh mirrors, no matrix round-trip)
    if (i > 0) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let k = 0; k < i; k++) {
        const d = drops.current[k];
        if (d.x < minX) minX = d.x;
        if (d.x > maxX) maxX = d.x;
        if (d.z < minZ) minZ = d.z;
        if (d.z > maxZ) maxZ = d.z;
      }
      rainSpreadDebug.x = maxX - minX;
      rainSpreadDebug.z = maxZ - minZ;
    } else {
      rainSpreadDebug.x = 0;
      rainSpreadDebug.z = 0;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, RAIN_VISUAL.drops]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      {/* #6384616654: SNOW reads matte white by REFLECTANCE, not emission —
          meshBasicMaterial is unlit (reads as glowing at night/dusk), so
          the shared precip material is now Lambert (lit): snow is bright
          because it catches the scene's light, like real snow. Same
          material for rain (also unlit before — same fix class). */}
      <meshLambertMaterial
        ref={matRef}
        color={RAIN_VISUAL.color}
        transparent
        opacity={RAIN_VISUAL.opacity}
      />
    </instancedMesh>
  );
}
