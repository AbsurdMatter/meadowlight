import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MEADOW_SIZE } from '../engine/terrain';
import { groundAt } from '../engine/ground';

const GRASS_COLORS = ['#94b364', '#8fae5f', '#87a75a', '#7d9f54'];
/** bowl cross-section: the same earth tones the hills use */
/*
 * #36 terrain retune (round 5): the rim band was EARTH brown, then a
 * drier-grass tone — both read as a distinct surface pasted between the
 * meadow and the outer terrain. The final read: a PALETTE BRIDGE — the
 * band samples toward the meadow's own grass at the inner boundary and
 * toward the hills' near-meadow greens at the outer boundary, with
 * per-cell dither (voxel-language jitter, not alpha) so the transition
 * drifts naturally; corner cells dither strongest. See the isRim branch.
 */

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
          // #36 round-5 palette bridge: the rim band reads as a gradient
          // TOWARD whichever terrain it touches — inner rim rows lean to
          // the meadow's own grass, outer rim rows lean to the hills'
          // near-meadow greens, with per-cell palette jitter so the
          // boundary is a natural drift, not a third surface. Corner
          // cells (the fold regions) get the strongest dither — the
          // transition was most abrupt there.
          const outerEdge = MEADOW_SIZE / 2;
          const innerEdge = outerEdge - step * 3;
          // 0 at the inner boundary -> 1 at the outermost cells
          const t = THREE.MathUtils.clamp((r - innerEdge) / (outerEdge - innerEdge), 0, 1);
          const jitter = Math.abs(Math.floor(Math.sin(ix * 12.9898 + iz * 78.233) * 43758.5) % 1000) / 1000;
          // near-meadow hills greens (the family the outer terrain wears)
          const hillA = new THREE.Color('#8fae5f');
          const hillB = new THREE.Color('#9cb96a');
          const meadowA = new THREE.Color('#94b364');
          const meadowB = new THREE.Color('#7d9f54');
          const towardHills = (jitter < 0.5 ? hillA : hillB).clone();
          const towardMeadow = (jitter < 0.5 ? meadowA : meadowB).clone();
          // dither: random cells swap families across the whole band, with
          // probability rising toward the outer edge (and extra at corners)
          const isCorner = Math.abs(x) > innerEdge && Math.abs(z) > innerEdge;
          const swapP = Math.min(1, t + (isCorner ? 0.35 : 0));
          color.copy(jitter < swapP ? towardHills : towardMeadow);
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
