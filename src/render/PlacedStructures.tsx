import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { STRUCTURES } from '../data/structures';
import { usePlacementStore } from './placementStore';
import { noVariation } from '../engine/variation';
import { combReady } from '../engine/honey';
import { HONEY_TUNING } from '../data/honey';

/** Deterministic 0..1 hash from two integers (the grass pattern) — stable
 *  across reloads, no RNG state, saves stay byte-stable. */
function hash2(x: number, z: number, salt: number): number {
  let h = (x * 374761393 + z * 668265263 + salt * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

const tmpMat = new THREE.Matrix4();
const rotYMat = new THREE.Matrix4();
const tiltXMat = new THREE.Matrix4();
const tiltZMat = new THREE.Matrix4();
const offsetMat = new THREE.Matrix4();
const scaleMat = new THREE.Matrix4();
const tmpColor = new THREE.Color();
/** #10: a DEDICATED color object — combColor must never alias tmpColor.
 * The original honey-glow bug: combColor aliased tmpColor, so each part's
 * `tmpColor.set(part.color)` overwrite (STRAW, DARK_WOOD…) replaced the
 * lerp result before the honey parts' setColorAt read it — the glow wrote
 * the previous part's color and NOTHING changed with fill. */
const combColor = new THREE.Color();
const combFloor = new THREE.Color(HONEY_TUNING.combColorFloor);
const combFull = new THREE.Color(HONEY_TUNING.combColorFull);

/** generous fixed capacity per structure type (never recreated on place/remove) */
const CAPACITY_PER_STRUCTURE = 60;

export function PlacedStructures() {
  const structures = usePlacementStore((s) => s.structures);
  const openNotebook = usePlacementStore((s) => s.openNotebook);
  const refs = useRef<{ meshes: Partial<Record<string, THREE.InstancedMesh | null>> }>({
    meshes: {},
  });
  /** instanceIndex -> placed-structure id, per structure type (for hive clicks) */
  const idMaps = useRef<Partial<Record<string, string[]>>>({});

  const onClick = (e: ThreeEvent<MouseEvent>, structureId: string) => {
    e.stopPropagation();
    const s = usePlacementStore.getState();
    if (s.selectedPlantId || s.selectedStructureId) return;
    // #10: a FULL hive gives a jar — the harvest ceremony (dip + toast)
    // fires from the store; a not-yet-full hive still opens the notebook
    if (structureId === 'hive') {
      const hiveId = idMaps.current[structureId]?.[e.instanceId ?? -1];
      if (hiveId) {
        // #36 hive popup: the harvest moment happens AT the hive — the
        // popup carries the fill state + harvest button (ONE shared
        // harvestHoney path under it and the P panel); the info panel
        // stays reachable via the popup's 'more' link
        s.openHivePopup(hiveId);
        return;
      }
    }
    openNotebook({ kind: 'structure', id: structureId });
  };

  useFrame(({ clock }) => {
    const r = refs.current;
    const t = clock.elapsedTime;
    const store = usePlacementStore.getState();
    for (const def of STRUCTURES) {
      const mesh = r.meshes[def.id];
      if (!mesh) continue;
      let i = 0;
      const ids: string[] = [];
      for (const s of structures) {
        if (s.structureId !== def.id) continue;
        ids.push(s.id);
        const variation = s.variation ?? noVariation();
        const swayZ = Math.sin(t * 0.5 + i * 1.7) * 0.012;
        const swayX = Math.cos(t * 0.4 + i * 2.3) * 0.008;
        // PR #35 polish: bushes are objects — deterministic per-instance
        // Y-rotation + slight scale jitter from the quantized saved
        // position (the grass hash2 pattern: stable across reloads, no
        // Math.random, saves stay byte-stable). Bushes only; other
        // structures keep their authored orientation.
        let bushRotY = 0;
        let bushScale = 1;
        if (s.structureId === 'bush') {
          const qx = Math.round(s.position[0] * 20);
          const qz = Math.round(s.position[2] * 20);
          bushRotY = hash2(qx, qz, 901) * Math.PI * 2;
          bushScale = 0.88 + hash2(qx, qz, 902) * 0.28;
        }
        // #10: the harvest ceremony — the hive dips and settles over
        // harvestDipSeconds (a gentle thank-you bow, then back to rest)
        let dip = 0;
        if (s.structureId === 'hive') {
          const startedAt = store.harvestDips[s.id];
          if (typeof startedAt === 'number') {
            const age = (performance.now() - startedAt) / 1000;
            const dur = HONEY_TUNING.harvestDipSeconds;
            if (age < dur) {
              // smooth down-and-settle: sin ease in, settle back
              const phase = age / dur;
              dip = -Math.sin(phase * Math.PI) * HONEY_TUNING.harvestDip;
            }
          }
        }
        // #10 comb-as-filling-jar (user retune): the honey parts GROW with
        // fill (thin warm core -> full band, scale lerp from tuning) AND
        // saturate floor-amber -> deep honey gold. The empty end stays
        // warm ("settling in", never sad); the full end is unmistakable at
        // a glance — a bigger, more saturated honey silhouette.
        const combFill = s.structureId === 'hive' ? store.hiveCombs[s.id] ?? 0 : 0;
        combColor.copy(combFloor).lerp(combFull, combFill);
        const combScale =
          HONEY_TUNING.combScaleFloor +
          (HONEY_TUNING.combScaleFull - HONEY_TUNING.combScaleFloor) * combFill;
        for (let pi = 0; pi < def.parts.length; pi++) {
          const part = def.parts[pi];
          const isHoneyPart =
            s.structureId === 'hive' && HONEY_TUNING.combPartIndices.includes(pi);
          tmpMat.makeTranslation(
            s.position[0],
            s.position[1] + variation.heightJitter + dip,
            s.position[2],
          );
          rotYMat.makeRotationY(s.rotationY + variation.rotationY + bushRotY);
          tmpMat.multiply(rotYMat);
          tiltXMat.makeRotationX(swayX + variation.tiltX);
          tmpMat.multiply(tiltXMat);
          tiltZMat.makeRotationZ(swayZ + variation.tiltZ);
          tmpMat.multiply(tiltZMat);
          offsetMat.makeTranslation(part.offset[0], part.offset[1], part.offset[2]);
          tmpMat.multiply(offsetMat);
          const partScale = isHoneyPart ? combScale : bushScale;
          scaleMat.makeScale(
            part.size[0] * partScale,
            part.size[1] * partScale,
            part.size[2] * partScale,
          );
          tmpMat.multiply(scaleMat);
          mesh.setMatrixAt(i, tmpMat);
          if (isHoneyPart) {
            mesh.setColorAt(i, combColor);
          } else {
            mesh.setColorAt(i, tmpColor.set(part.color));
          }
          i++;
        }
      }
      mesh.count = i;
      idMaps.current[def.id] = ids;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    void combReady; // engine import kept for the click path's store check
  });
  return (
    <group>
      {STRUCTURES.map((def) => (
        <instancedMesh
          key={def.id}
          ref={(m) => {
            refs.current.meshes[def.id] = m;
          }}
          args={[undefined, undefined, CAPACITY_PER_STRUCTURE * def.parts.length]}
          castShadow
          receiveShadow
          frustumCulled={false}
          onClick={(e) => onClick(e, def.id)}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial />
        </instancedMesh>
      ))}
    </group>
  );
}
