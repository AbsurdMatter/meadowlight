import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MEADOW_SIZE } from '../engine/terrain';
import { groundAt } from '../engine/ground';

const GRASS_COLORS = ['#94b364', '#8fae5f', '#87a75a', '#7d9f54'];
/** bowl cross-section: the same earth tones the hills use */
/*
 * #36 terrain retune: the rim band was EARTH brown (#8a7350 family, the
 * bowl-cross-section read), tuned when the bowl was ~1u deep — at the new
 * 0.2u shallow rim the brown strip protruded visually against the green
 * outer terrain. The rim top now reads as a DRIER GRASS tone — the
 * meadow-to-outer-meadow transition family, so the seam is grass-to-grass.
 */
const RIM_GRASS_COLORS = ['#a8a45f', '#9aa057', '#b0a768'];

export function Meadow() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const n = 44;
    const step = MEADOW_SIZE / n;
    const mat = new THREE.Matrix4();
    const color = new THREE.Color();
    let i = 0;
    for (let ix = 0; ix < n; ix++) {
      for (let iz = 0; iz < n; iz++) {
        const x = -MEADOW_SIZE / 2 + (ix + 0.5) * step;
        const z = -MEADOW_SIZE / 2 + (iz + 0.5) * step;
        // #29 pass 4: the meadow IS the terrain's low bowl — height comes
        // from the ground oracle (terrainHeight - bowl depth), the same
        // surface the placement ray and every drift system sample, so the
        // green top is the terrain top here, not a floating layer
        const h = groundAt(x, z).height;
        const r = Math.hypot(x, z);
        const isEdge = r > MEADOW_SIZE / 2 - step * 1.5;
        // edge boxes reach down past the bowl wall so the join with the
        // hills lattice reads as terrain rising, never as a layer edge
        const depth = isEdge ? 8 + 0.6 : 1.4;
        // #29 pass 4: the rim skirt is the bowl's cut-away cross-section —
        // it shows EARTH (terrain brown), not grass. Only the top surface
        // is green; the exposed wall reads as the terrain the bowl was
        // carved from, same language as the hills.
        const isRim = isEdge;
        mat.makeScale(step * 1.02, depth, step * 1.02);
        // box top must sit exactly at the heightfield value h — the same
        // surface resolvePlacement()/terrainHeight() sample — so placed
        // flowers, structures, and the ghost rest ON the visible ground
        // (the old 0.53 offset sank every box top by 0.03*depth, floating
        // everything above the meadow)
        mat.setPosition(x, h - depth * 0.5, z);
        mesh.setMatrixAt(i, mat);
        if (isRim) {
          color.set(RIM_GRASS_COLORS[
            Math.abs(Math.floor(Math.sin(ix * 12.9898 + iz * 78.233) * 43758.5)) %
              RIM_GRASS_COLORS.length
          ]);
        } else {
          color.set(
            GRASS_COLORS[
              Math.abs(Math.floor(Math.sin(ix * 12.9898 + iz * 78.233) * 43758.5)) %
                GRASS_COLORS.length
            ],
          );
        }
        const hsl = { h: 0, s: 0, l: 0 };
        color.getHSL(hsl);
        const jitter = Math.sin(ix * 3.7 + iz * 7.1) * 0.5 + Math.sin(ix * 9.2 - iz * 4.3) * 0.5;
        color.setHSL(
          hsl.h + jitter * 0.008,
          THREE.MathUtils.clamp(hsl.s + jitter * 0.02, 0, 1),
          THREE.MathUtils.clamp(hsl.l + jitter * 0.022, 0, 1),
        );
        mesh.setColorAt(i, color);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);

  const count = 44 * 44;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} receiveShadow castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}
