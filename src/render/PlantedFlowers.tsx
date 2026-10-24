import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { scaledElapsed } from '../engine/scaledTime';
import * as THREE from 'three';
import { PLANTS } from '../data/plants';
import { usePlacementStore } from './placementStore';
import { isClaimableEntry } from '../data/magnifierKinds';
import { noVariation } from '../engine/variation';
import { inBloom } from '../engine/pollinator';
import { isRaining, RAIN_TUNING } from '../engine/weather';
import { companionSet } from '../engine/companions';
import { RECIPE_TUNING } from '../data/recipes';

const tmpColor = new THREE.Color();
const dullColor = new THREE.Color();
const tmpMat = new THREE.Matrix4();
const rotYMat = new THREE.Matrix4();
const swayXMat = new THREE.Matrix4();
const swayZMat = new THREE.Matrix4();
const tiltXMat = new THREE.Matrix4();
const tiltZMat = new THREE.Matrix4();
const offsetMat = new THREE.Matrix4();
const scaleMat = new THREE.Matrix4();

/** generous fixed capacity per species — meshes are never recreated on plant/remove */
const CAPACITY_PER_SPECIES = 400;

/** out-of-season petals shrink + dull (visible bloom succession) */
const OFF_BLOOM_SCALE = 0.25;
const OFF_BLOOM_LIGHTEN = 0.35;

/**
 * Perf pass (session 3):
 *  - SWAY_LOD_DISTANCE: flowers farther than this from the camera skip the
 *    per-frame sway rotation (their matrix is still written with zero sway,
 *    keeping placement/season visuals identical; 0.08 rad sway is
 *    imperceptible beyond this distance).
 *  - colorDirty: instance colors only change on season/bloom flips or when
 *    the item set changes — rewriting them every frame was the single
 *    biggest per-frame waste in the profile.
 */
const SWAY_LOD_DISTANCE = 30;

function FlowerInstances() {
  const items = usePlacementStore((s) => s.items);
  const season = usePlacementStore((s) => s.season);
  const refs = useRef<{ meshes: Record<string, THREE.InstancedMesh | null> }>({
    meshes: {},
  });
  /**
   * instanceId -> item id per species, per PART instance (the raycast returns
   * a per-part instanceId). Rebuilt ONLY when the item array reference
   * changes (plant/remove swap the array) — the per-frame matrix loop does
   * not touch it. Perf fix (#6384252148): rebuilding ~items x parts entries
   * every frame was pure allocation churn; steady-state frames are now
   * allocation-free on this path.
   */
  const idMaps = useRef<Record<string, string[]>>({});
  const lastItems = useRef<unknown>(null);
  /** last (season, itemCount) each species' colors were written for */
  const colorKey = useRef<Record<string, string>>({});

  // #6384788257: the flower CLICK-TOOL TIP IS REMOVED — the armed glass is
  // the ONE inspection surface. What the click fed beyond the tooltip was
  // the notebook's fact-SEEING flow (markFactSeen on panel open); that
  // learning now rides the glass card (MagnifierCard marks the fact seen
  // when it renders), so nothing dies silently — the v4 #40 seam is the
  // inspection entry itself.
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // clicks still mean planting while a tool is active; with no tool,
    // a flower click is now a no-op for inspection (glass-only)
  };
  // N3: the magnifying glass — hover inspection, zero mutation. Rides the
  // SAME instanced-mesh pointer events the click path uses (one input path:
  // no new DOM handlers, no stopPropagation chains — hover never swallows
  // the placement click; the card is pure display elsewhere)
  const onOver = (e: ThreeEvent<PointerEvent>, plantId: string) => {
    const s = usePlacementStore.getState();
    if (!s.magnifierOn) return;
    // #6384690070: claim only a CLAIMABLE entry — the ray can hit a flower
    // and a structure in one move (R3F fires pointer-over for every
    // intersected mesh), and the unguarded handlers raced: the last to fire
    // overwrote the other's claim (the 836d4cc flower regression — a
    // flower beside a hive always lost to the structure's over). A mesh
    // over may never steal another mesh-owned entry.
    if (!isClaimableEntry(s.magnifierEntry)) return;
    const idx = e.instanceId;
    const itemId = idx === undefined ? undefined : idMaps.current[plantId]?.[idx];
    if (itemId) s.setMagnifierEntry({ kind: 'flower', itemId });
  };
  const onOut = () => {
    const s = usePlacementStore.getState();
    // pointer-out releases ONLY our own kind — never another owner's entry
    if (s.magnifierOn && s.magnifierEntry?.kind === 'flower') s.setMagnifierEntry(null);
  };
  useFrame(({ camera }) => {
    const r = refs.current;
    const t = scaledElapsed();
    // #9: companion vigor — recipe partners bloom a touch fuller. Strictly
    // additive (a gentle scale-up on blessed flowers); unblessed flowers
    // keep the exact pre-recipe look, so nothing ever reads as penalized.
    // Rescanned on the same item set the render loop reads; cheap because
    // only recipe-relevant species enter the scan.
    const { blessed } = companionSet(items);
    // #14: rain makes blooming petals glisten (washes the colors brighter)
    const glisten = RAIN_TUNING.glisten && isRaining();
    let glistened = false;
    for (const def of PLANTS) {
      const mesh = r.meshes[def.id];
      if (!mesh) continue;
      const blooming = inBloom(def.id, season);
      const thisColorKey = season + ':' + items.length + (glisten ? ':rain:' + Math.floor(t * 8) : '');
      const colorsDirty = colorKey.current[def.id] !== thisColorKey;
      colorKey.current[def.id] = thisColorKey;
      void glistened;
      // id maps change only with the item SET (reference swap on
      // plant/remove), never with sway/bloom per-frame state
      const itemsChanged = items !== lastItems.current;
      const ids = itemsChanged ? [] : (idMaps.current[def.id] ?? []);
      let i = 0;
      for (const item of items) {
        if (item.plantId !== def.id) continue;
        const variation = item.variation ?? noVariation();
        // LOD: skip the sway rotations when far from the camera (imperceptible)
        const dx = item.position[0] - camera.position.x;
        const dz = item.position[2] - camera.position.z;
        const near = dx * dx + dz * dz <= SWAY_LOD_DISTANCE * SWAY_LOD_DISTANCE;
        const swayZ = near ? Math.sin(t * 0.9 + item.phase) * def.sway : 0;
        const swayX = near ? Math.cos(t * 0.7 + item.phase * 1.3) * def.sway * 0.5 : 0;
        for (let pi = 0; pi < def.parts.length; pi++) {
          // every part instance maps back to its item (hit anywhere on
          // the flower resolves to it) — pushed only on rebuild
          if (itemsChanged) ids.push(item.id);
          const part = def.parts[pi];
          const petal = part.petal === true;
          const partSway = part.offset[1] / Math.max(def.height, 0.001);
          const vigor = blessed.has(item.id) ? RECIPE_TUNING.vigorScale : 1;
          const bloomScale = (!petal || blooming ? 1 : OFF_BLOOM_SCALE) * vigor;
          tmpMat.makeTranslation(
            item.position[0],
            item.position[1] + variation.heightJitter,
            item.position[2],
          );
          rotYMat.makeRotationY(item.rotationY + variation.rotationY);
          tmpMat.multiply(rotYMat);
          tiltXMat.makeRotationX(variation.tiltX);
          tmpMat.multiply(tiltXMat);
          tiltZMat.makeRotationZ(variation.tiltZ);
          tmpMat.multiply(tiltZMat);
          swayXMat.makeRotationX(swayX * partSway);
          tmpMat.multiply(swayXMat);
          swayZMat.makeRotationZ(swayZ * partSway);
          tmpMat.multiply(swayZMat);
          offsetMat.makeTranslation(part.offset[0], part.offset[1], part.offset[2]);
          tmpMat.multiply(offsetMat);
          scaleMat.makeScale(
            part.size[0] * bloomScale,
            part.size[1] * bloomScale,
            part.size[2] * bloomScale,
          );
          tmpMat.multiply(scaleMat);
          mesh.setMatrixAt(i, tmpMat);
          if (colorsDirty) {
            tmpColor.set(part.color);
            if (petal && !blooming) {
              dullColor.copy(tmpColor).lerp(new THREE.Color('#b9b39a'), OFF_BLOOM_LIGHTEN);
              mesh.setColorAt(i, dullColor);
            } else if (petal && glisten) {
              // #14: rain glisten — wet petals catch the light, a soft slow
              // pulse per flower (phase offset) so the meadow shimmers gently
              const g = 0.12 + 0.1 * Math.sin(t * 2.2 + item.phase * 3);
              dullColor.copy(tmpColor).lerp(new THREE.Color('#ffffff'), g);
              mesh.setColorAt(i, dullColor);
              glistened = true;
            } else {
              mesh.setColorAt(i, tmpColor);
            }
          }
          i++;
        }
      }
      mesh.count = i;
      if (itemsChanged) idMaps.current[def.id] = ids;
      mesh.instanceMatrix.needsUpdate = true;
      if (colorsDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    lastItems.current = items;
  });
  return (
    <group>
      {PLANTS.map((def) => (
        <instancedMesh
          key={def.id}
          ref={(m) => {
            refs.current.meshes[def.id] = m;
          }}
          args={[undefined, undefined, CAPACITY_PER_SPECIES * def.parts.length]}
          castShadow
          receiveShadow
          frustumCulled={false}
          onClick={(e) => onClick(e)}
          onPointerOver={(e) => onOver(e, def.id)}
          onPointerOut={onOut}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial />
        </instancedMesh>
      ))}
    </group>
  );
}

export function PlantedFlowers() {
  return <FlowerInstances />;
}
