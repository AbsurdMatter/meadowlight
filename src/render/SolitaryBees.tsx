import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { scaledDelta, scaledElapsed } from '../engine/scaledTime';
import * as THREE from 'three';
import { SOLITARY_BEE_TUNING, RARE_POLLINATOR_TUNING } from '../data/bees';
import { PLANT_BY_ID } from '../data/plants';
import { usePlacementStore } from './placementStore';
import { inBloom } from '../engine/pollinator';
import { noVariation } from '../engine/variation';
import type { PlacedStructure } from '../engine/persistence';

/**
 * Solitary bees nesting in placed bee hotels — visually distinct from the
 * hive swarm (smaller, rust-toned) so the player can tell them apart, per
 * the ecology: 70%+ of bee species are solitary and don't live in hives.
 *
 * Also renders the rare wool-carder bee when a wild corner sits within
 * pairing range of a hotel: bigger, dark, patrolling its patch.
 *
 * Targets are placed-flower IDs re-resolved from the store every frame —
 * never indices or raw references (the session-2 invariant).
 */

interface SoloBeeState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** id of the placed hotel this bee nests in */
  hotelId: string;
  targetFlowerId: string | null;
  headingHome: boolean;
  phase: number;
  restingUntil: number;
}

interface RareBeeState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** hotel + wild corner pair this bee patrols */
  hotelId: string;
  cornerId: string;
  headingHome: boolean;
  phase: number;
  restingUntil: number;
}

const MAX_SOLO = SOLITARY_BEE_TUNING.maxTotal;
const MAX_RARE = RARE_POLLINATOR_TUNING.maxTotal;

/** live counts, exposed for the test hook / perf harness */
export const solitaryBeeDebug = { count: 0 };
export const rareBeeDebug = { count: 0 };

const tmpMat = new THREE.Matrix4();
const lookMat = new THREE.Matrix4();
const scaleMat = new THREE.Matrix4();
const up = new THREE.Vector3(0, 1, 0);
/** flower id -> world position, rebuilt from the store each frame */
const flowerById = new Map<string, { x: number; y: number; z: number; plantId: string }>();
const tmpVec = new THREE.Vector3();
let crashLogged = false;

function syncFlowers() {
  const s = usePlacementStore.getState();
  flowerById.clear();
  for (const f of s.items) {
    const variation = f.variation ?? noVariation();
    flowerById.set(f.id, {
      x: f.position[0],
      y: f.position[1] + variation.heightJitter,
      z: f.position[2],
      plantId: f.plantId,
    });
  }
}

/** blooming flower ids within radius of a point */
function bloomingNear(x: number, z: number, radius: number, season: string): string[] {
  const out: string[] = [];
  const r2 = radius * radius;
  for (const [id, f] of flowerById) {
    if ((f.x - x) ** 2 + (f.z - z) ** 2 <= r2 && inBloom(f.plantId, season as never)) {
      out.push(id);
    }
  }
  return out;
}

export function SolitaryBees() {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const stripeRef = useRef<THREE.InstancedMesh>(null);
  const wingRef = useRef<THREE.InstancedMesh>(null);
  const rareBodyRef = useRef<THREE.InstancedMesh>(null);
  const rareStripeRef = useRef<THREE.InstancedMesh>(null);
  const rareWingRef = useRef<THREE.InstancedMesh>(null);
  const bees = useRef<SoloBeeState[]>([]);
  const rareBees = useRef<RareBeeState[]>([]);
  const lastKey = useRef('');
  const lastRareKey = useRef('');

  const update = (delta: number) => {
    const body = bodyRef.current;
    const stripes = stripeRef.current;
    const wings = wingRef.current;
    const rareBody = rareBodyRef.current;
    const rareStripes = rareStripeRef.current;
    const rareWings = rareWingRef.current;
    if (!body || !stripes || !wings || !rareBody || !rareStripes || !rareWings) return;
    const s = usePlacementStore.getState();
    const season = s.season;
    const foraging = ['spring', 'summer', 'autumn'].includes(season);
    syncFlowers();

    const hotels = s.structures.filter((st) => st.structureId === 'hotel');
    const corners = s.structures.filter((st) => st.structureId === 'wildcorner');

    // --- solitary bees: up to perHotel per placed hotel, if flowers bloom nearby
    const perHotelNow = foraging ? SOLITARY_BEE_TUNING.perHotel : 1;
    const key = hotels.map((h) => h.id).join(',') + '|' + season;
    if (key !== lastKey.current) {
      lastKey.current = key;
      const want = Math.min(MAX_SOLO, hotels.length * perHotelNow);
      const list = bees.current;
      while (list.length > want) list.pop();
      while (list.length < want && hotels.length > 0) {
        const hotel = hotels[list.length % hotels.length];
        list.push({
          pos: new THREE.Vector3(
            hotel.position[0] + (Math.random() - 0.5) * 0.6,
            hotel.position[1] + 1.5 + Math.random() * 0.3,
            hotel.position[2] + (Math.random() - 0.5) * 0.6,
          ),
          vel: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)
            .normalize()
            .multiplyScalar(SOLITARY_BEE_TUNING.speed * 0.5),
          hotelId: hotel.id,
          targetFlowerId: null,
          headingHome: true,
          phase: Math.random() * Math.PI * 2,
          restingUntil: 0,
        });
      }
      // drop bees whose hotel vanished
      const hotelIds = new Set(hotels.map((h) => h.id));
      bees.current = bees.current.filter((b) => hotelIds.has(b.hotelId));
    }

    const t = scaledElapsed();
    const hotelById = new Map(hotels.map((h) => [h.id, h]));

    for (let bi = 0; bi < bees.current.length; bi++) {
      const bee = bees.current[bi];
      const hotel = hotelById.get(bee.hotelId);
      if (!hotel) {
        tmpMat.makeScale(0, 0, 0);
        body.setMatrixAt(bi, tmpMat);
        stripes.setMatrixAt(bi, tmpMat);
        wings.setMatrixAt(bi, tmpMat);
        continue;
      }
      // re-resolve target by id every frame
      let flowerInfo = bee.targetFlowerId ? flowerById.get(bee.targetFlowerId) : undefined;
      if (flowerInfo && !inBloom(flowerInfo.plantId, season)) flowerInfo = undefined;
      if (bee.targetFlowerId !== null && !flowerInfo) {
        bee.targetFlowerId = null;
        bee.headingHome = true;
      }
      if (bee.restingUntil <= t && bee.targetFlowerId === null) {
        const near = bloomingNear(hotel.position[0], hotel.position[2], SOLITARY_BEE_TUNING.forageRadius, season);
        if (foraging && near.length > 0 && Math.random() > 0.2) {
          bee.targetFlowerId = near[Math.floor(Math.random() * near.length)];
          bee.headingHome = false;
        } else {
          bee.headingHome = true;
        }
      }
      const target = tmpVec;
      if (bee.targetFlowerId !== null && flowerInfo) {
        const def = PLANT_BY_ID[flowerInfo.plantId];
        target.set(flowerInfo.x, flowerInfo.y + (def ? def.height * 0.8 : 0.5), flowerInfo.z);
      } else {
        target.set(hotel.position[0], hotel.position[1] + 1.5, hotel.position[2]);
      }
      if (bee.restingUntil <= t) {
        const toTarget = target.clone().sub(bee.pos);
        const dist = toTarget.length();
        if (dist < SOLITARY_BEE_TUNING.arriveRadius) {
          bee.restingUntil =
            t +
            SOLITARY_BEE_TUNING.restSeconds[0] +
            Math.random() * (SOLITARY_BEE_TUNING.restSeconds[1] - SOLITARY_BEE_TUNING.restSeconds[0]);
          bee.targetFlowerId = null;
          bee.headingHome = true;
        } else {
          toTarget.normalize().multiplyScalar(SOLITARY_BEE_TUNING.speed);
          toTarget.x += Math.sin(t * 3.4 + bee.phase) * SOLITARY_BEE_TUNING.wanderStrength;
          toTarget.z += Math.cos(t * 2.9 + bee.phase * 1.3) * SOLITARY_BEE_TUNING.wanderStrength;
          bee.vel.lerp(toTarget, Math.min(1, delta * 4));
          bee.pos.addScaledVector(bee.vel, delta);
        }
      }
      const bob = Math.sin(t * SOLITARY_BEE_TUNING.bobSpeed + bee.phase) * SOLITARY_BEE_TUNING.bobAmplitude;
      lookMat.lookAt(bee.pos, target, up);
      lookMat.setPosition(0, 0, 0);
      tmpMat.makeTranslation(bee.pos.x, bee.pos.y + bob, bee.pos.z);
      tmpMat.multiply(lookMat);
      body.setMatrixAt(bi, tmpMat);
      stripes.setMatrixAt(bi, tmpMat);
      const flap = Math.sin(t * 44 + bee.phase) * 0.5;
      tmpMat.makeTranslation(bee.pos.x, bee.pos.y + bob + 0.05, bee.pos.z);
      tmpMat.multiply(lookMat);
      scaleMat.makeScale(1 + flap, 1 + flap, 1);
      tmpMat.multiply(scaleMat);
      wings.setMatrixAt(bi, tmpMat);
    }
    solitaryBeeDebug.count = bees.current.length;
    body.count = bees.current.length;
    stripes.count = bees.current.length;
    wings.count = bees.current.length;
    body.instanceMatrix.needsUpdate = true;
    stripes.instanceMatrix.needsUpdate = true;
    wings.instanceMatrix.needsUpdate = true;

    // --- rare wool-carder bees: one per (hotel, corner) pair, capped
    const pairs: { hotel: PlacedStructure; corner: PlacedStructure }[] = [];
    for (const h of hotels) {
      for (const c of corners) {
        if (
          Math.hypot(h.position[0] - c.position[0], h.position[2] - c.position[2]) <=
          RARE_POLLINATOR_TUNING.pairingRadius
        ) {
          pairs.push({ hotel: h, corner: c });
        }
      }
    }
    const rareKey = pairs.map((p) => p.hotel.id + '>' + p.corner.id).join(',');
    if (rareKey !== lastRareKey.current) {
      lastRareKey.current = rareKey;
      const want = Math.min(MAX_RARE, pairs.length) * (foraging ? 1 : 0);
      const list = rareBees.current;
      while (list.length > want) list.pop();
      let i = 0;
      while (list.length < want && i < pairs.length) {
        const pair = pairs[i];
        list.push({
          pos: new THREE.Vector3(pair.corner.position[0], pair.corner.position[1] + 0.8, pair.corner.position[2]),
          vel: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5),
          hotelId: pair.hotel.id,
          cornerId: pair.corner.id,
          headingHome: true,
          phase: Math.random() * Math.PI * 2,
          restingUntil: 0,
        });
        i++;
      }
    }
    for (let ri = 0; ri < rareBees.current.length; ri++) {
      const bee = rareBees.current[ri];
      const corner = corners.find((c) => c.id === bee.cornerId);
      const hotel = hotelById.get(bee.hotelId);
      if (!corner || !hotel) {
        tmpMat.makeScale(0, 0, 0);
        rareBody.setMatrixAt(ri, tmpMat);
        rareStripes.setMatrixAt(ri, tmpMat);
        rareWings.setMatrixAt(ri, tmpMat);
        continue;
      }
      // patrol between its wild corner and its hotel
      const target = tmpVec;
      if (bee.headingHome) {
        target.set(corner.position[0], corner.position[1] + 0.8, corner.position[2]);
      } else {
        target.set(hotel.position[0], hotel.position[1] + 1.4, hotel.position[2]);
      }
      if (bee.restingUntil <= t) {
        const toTarget = target.clone().sub(bee.pos);
        const dist = toTarget.length();
        if (dist < 0.5) {
          bee.headingHome = !bee.headingHome;
          bee.restingUntil =
            t + RARE_POLLINATOR_TUNING.patrolSeconds[0] +
            Math.random() * (RARE_POLLINATOR_TUNING.patrolSeconds[1] - RARE_POLLINATOR_TUNING.patrolSeconds[0]);
        } else {
          toTarget.normalize().multiplyScalar(RARE_POLLINATOR_TUNING.speed);
          toTarget.x += Math.sin(t * 2.2 + bee.phase) * 0.8;
          toTarget.z += Math.cos(t * 2.5 + bee.phase) * 0.8;
          bee.vel.lerp(toTarget, Math.min(1, delta * 3));
          bee.pos.addScaledVector(bee.vel, delta);
        }
      }
      const bob = Math.sin(t * 5.5 + bee.phase) * 0.09;
      lookMat.lookAt(bee.pos, target, up);
      lookMat.setPosition(0, 0, 0);
      tmpMat.makeTranslation(bee.pos.x, bee.pos.y + bob, bee.pos.z);
      tmpMat.multiply(lookMat);
      rareBody.setMatrixAt(ri, tmpMat);
      rareStripes.setMatrixAt(ri, tmpMat);
      const flap = Math.sin(t * 36 + bee.phase) * 0.5;
      tmpMat.makeTranslation(bee.pos.x, bee.pos.y + bob + 0.07, bee.pos.z);
      tmpMat.multiply(lookMat);
      scaleMat.makeScale(1 + flap, 1 + flap, 1);
      tmpMat.multiply(scaleMat);
      rareWings.setMatrixAt(ri, tmpMat);
    }
    rareBeeDebug.count = rareBees.current.length;
    rareBody.count = rareBees.current.length;
    rareStripes.count = rareBees.current.length;
    rareWings.count = rareBees.current.length;
    rareBody.instanceMatrix.needsUpdate = true;
    rareStripes.instanceMatrix.needsUpdate = true;
    rareWings.instanceMatrix.needsUpdate = true;
  };

  useFrame(() => {
    try {
      update(scaledDelta());
    } catch (err) {
      if (!crashLogged) {
        crashLogged = true;
        console.error('[solitary bees] frame error contained:', err);
      }
    }
  });

  const bodyGeo = useMemo(() => new THREE.BoxGeometry(...SOLITARY_BEE_TUNING.bodySize), []);
  const stripeGeo = useMemo(
    () =>
      new THREE.BoxGeometry(
        SOLITARY_BEE_TUNING.bodySize[0] * 1.04,
        SOLITARY_BEE_TUNING.bodySize[1] * 1.04,
        SOLITARY_BEE_TUNING.bodySize[2] * 0.35,
      ),
    [],
  );
  const wingGeo = useMemo(
    () =>
      new THREE.BoxGeometry(
        SOLITARY_BEE_TUNING.bodySize[0] * 2.6,
        SOLITARY_BEE_TUNING.bodySize[1] * 0.2,
        SOLITARY_BEE_TUNING.bodySize[2] * 1.1,
      ),
    [],
  );
  const rareBodyGeo = useMemo(() => new THREE.BoxGeometry(...RARE_POLLINATOR_TUNING.bodySize), []);
  const rareStripeGeo = useMemo(
    () =>
      new THREE.BoxGeometry(
        RARE_POLLINATOR_TUNING.bodySize[0] * 1.04,
        RARE_POLLINATOR_TUNING.bodySize[1] * 1.04,
        RARE_POLLINATOR_TUNING.bodySize[2] * 0.35,
      ),
    [],
  );
  const rareWingGeo = useMemo(
    () =>
      new THREE.BoxGeometry(
        RARE_POLLINATOR_TUNING.bodySize[0] * 2.6,
        RARE_POLLINATOR_TUNING.bodySize[1] * 0.2,
        RARE_POLLINATOR_TUNING.bodySize[2] * 1.1,
      ),
    [],
  );
  return (
    <group>
      <instancedMesh ref={bodyRef} args={[bodyGeo, undefined, MAX_SOLO]} frustumCulled={false}>
        <meshLambertMaterial color={SOLITARY_BEE_TUNING.bodyColor} />
      </instancedMesh>
      <instancedMesh ref={stripeRef} args={[stripeGeo, undefined, MAX_SOLO]} frustumCulled={false}>
        <meshLambertMaterial color={SOLITARY_BEE_TUNING.stripeColor} />
      </instancedMesh>
      <instancedMesh ref={wingRef} args={[wingGeo, undefined, MAX_SOLO]} frustumCulled={false}>
        <meshLambertMaterial color={SOLITARY_BEE_TUNING.wingColor} transparent opacity={SOLITARY_BEE_TUNING.wingOpacity} />
      </instancedMesh>
      <instancedMesh ref={rareBodyRef} args={[rareBodyGeo, undefined, MAX_RARE]} frustumCulled={false}>
        <meshLambertMaterial color={RARE_POLLINATOR_TUNING.bodyColor} />
      </instancedMesh>
      <instancedMesh ref={rareStripeRef} args={[rareStripeGeo, undefined, MAX_RARE]} frustumCulled={false}>
        <meshLambertMaterial color={RARE_POLLINATOR_TUNING.stripeColor} />
      </instancedMesh>
      <instancedMesh ref={rareWingRef} args={[rareWingGeo, undefined, MAX_RARE]} frustumCulled={false}>
        <meshLambertMaterial color={RARE_POLLINATOR_TUNING.wingColor} transparent opacity={RARE_POLLINATOR_TUNING.wingOpacity} />
      </instancedMesh>
    </group>
  );
}
