import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { scaledDelta, scaledElapsed } from '../engine/scaledTime';
import * as THREE from 'three';
import { BEE_TUNING } from '../data/bees';
import { PLANT_BY_ID } from '../data/plants';
import { usePlacementStore } from './placementStore';
import { computeAppeal, beesForHive, inBloom, FORAGE_RADIUS, type PollinatorWorld } from '../engine/pollinator';
import { isRaining, RAIN_TUNING } from '../engine/weather';
import { dayPhase, isDaylight } from '../engine/dayCycle';
import { advanceComb } from '../engine/honey';

/** #10 honey telemetry, exposed for the P panel / test hook */
export const honeyDebug = { lastForagingBees: 0, lastAppeal: 0 };
import { noVariation } from '../engine/variation';
import type { PlacedStructure } from '../engine/persistence';

interface BeeState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  hiveIndex: number;
  /** id of the placed flower item this bee heads to. Never an array index:
   *  ids stay valid across remove / stress-restore / save-load, and are
   *  re-resolved from the placement store every frame. */
  targetFlowerId: string | null;
  /** true while heading home to the hive */
  headingHome: boolean;
  /** gentle forage-wander point near the hive when no bloom is reachable:
   *  bees must keep flying, never park frozen at the hive entrance */
  wanderTarget: THREE.Vector3 | null;
  phase: number;
  restingUntil: number;
}

const MAX_BEES = BEE_TUNING.maxBeesTotal;

/** live swarm telemetry, exposed for the test hook / P panel bee debug */
export const beeDebug = {
  count: 0,
  /** cumulative: a bee acquired a flower target */
  targetFound: 0,
  /** cumulative: a bee's target vanished (removed / out of bloom) */
  targetLost: 0,
  /** this frame: bees steering to a flower / wandering / heading home */
  foraging: 0,
  wandering: 0,
  homing: 0,
  /** this frame: mean and max distance of bees from their hive */
  avgDistFromHive: 0,
  maxDistFromHive: 0,
  /** this frame: mean flight speed (a parked swarm reads ~0) */
  avgSpeed: 0,
  /** cumulative: wander points picked (empty-meadow behavior) */
  wanderPicked: 0,
};
const tmpMat = new THREE.Matrix4();
const lookMat = new THREE.Matrix4();
const scaleMat = new THREE.Matrix4();
const up = new THREE.Vector3(0, 1, 0);
const world: PollinatorWorld = { flowers: [], water: [], shelter: [], bushes: [], season: 'summer' };
/** flower id -> world position (+bloom info), rebuilt from the store each frame */
const flowerById = new Map<string, { x: number; y: number; z: number; plantId: string }>();
let crashLogged = false;
let firstSwarmFired = false;

/** Build the shared engine view of the world from the placement store (no duplicated state). */
function syncWorld() {
  const s = usePlacementStore.getState();
  world.season = s.season;
  world.flowers = s.items.map((f) => ({
    x: f.position[0],
    z: f.position[2],
    plantId: f.plantId,
  }));
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
  world.water = s.structures
    .filter((st) => st.structureId === 'bath')
    .map((st) => ({ x: st.position[0], z: st.position[2] }));
  world.shelter = s.structures
    .filter((st) => st.structureId === 'hedge')
    .map((st) => ({ x: st.position[0], z: st.position[2] }));
  // #7: placeable bushes join the shelter view at their own strength
  world.bushes = s.structures
    .filter((st) => st.structureId === 'bush')
    .map((st) => ({ x: st.position[0], z: st.position[2] }));
}

export function BeeSwarm() {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const stripeRef = useRef<THREE.InstancedMesh>(null);
  const wingRef = useRef<THREE.InstancedMesh>(null);
  const bees = useRef<BeeState[]>([]);
  const adaptiveCap = useRef<number>(MAX_BEES);
  const frameEma = useRef<number>(16);
  const lastAdapt = useRef(0);
  const lastHivesKey = useRef('');

  const initBee = (hiveIndex: number, hive: PlacedStructure, phase: number): BeeState => ({
    pos: new THREE.Vector3(
      hive.position[0] + (Math.random() - 0.5) * 1.2,
      hive.position[1] + 1.4 + Math.random() * 0.4,
      hive.position[2] + (Math.random() - 0.5) * 1.2,
    ),
    vel: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)
      .normalize()
      .multiplyScalar(BEE_TUNING.speed * 0.5),
    hiveIndex,
    targetFlowerId: null,
    headingHome: true,
    wanderTarget: null,
    phase,
    restingUntil: 0,
  });

  const updateSwarm = (delta: number, rawDelta: number) => {
    const body = bodyRef.current;
    const stripes = stripeRef.current;
    const wings = wingRef.current;
    if (!body || !stripes || !wings) return;
    const s = usePlacementStore.getState();
    const hives = s.structures.filter((st) => st.structureId === 'hive');
    syncWorld();
    const foraging = BEE_TUNING.foragingSeasons.includes(s.season);

    // adaptive swarm cap: measure frame time, cap the bee count. The frame
    // metric stays RAW (perf must observe real device frames even when the
    // world is slowed or paused); only the adaptation CADENCE uses the
    // shared scaled clock (adaptation is world behavior, not measurement).
    const dt = Math.min(rawDelta, 0.1) * 1000;
    frameEma.current = frameEma.current * 0.95 + dt * 0.05;
    if (scaledElapsed() * 1000 - lastAdapt.current > BEE_TUNING.adaptEveryMs) {
      lastAdapt.current = scaledElapsed() * 1000;
      if (frameEma.current > BEE_TUNING.slowFrameMs && adaptiveCap.current > 24) {
        adaptiveCap.current = Math.max(24, Math.floor(adaptiveCap.current * 0.8));
      } else if (frameEma.current < BEE_TUNING.fastFrameMs && adaptiveCap.current < MAX_BEES) {
        adaptiveCap.current = Math.min(MAX_BEES, Math.floor(adaptiveCap.current * 1.15) + 1);
      }
    }

    // target bee counts per hive from local appeal
    const perHive = hives.map((hive) => {
      const appeal = computeAppeal(
        { x: hive.position[0], z: hive.position[2] },
        world,
        FORAGE_RADIUS,
      ).score;
      return foraging
        ? beesForHive(appeal, BEE_TUNING.beesPerHive, BEE_TUNING.maxBeesPerHive)
        : Math.round(BEE_TUNING.maxBeesPerHive * BEE_TUNING.winterBeeFraction);
    });
    const targetTotal = Math.min(
      adaptiveCap.current,
      perHive.reduce((a, b) => a + b, 0),
    );
    // #10: comb fill advances from REAL observed foraging effort —
    // appeal-scaled, daylight- and season-gated (the same gates the bees'
    // own foraging uses), through the ONE shared store field. Pure math in
    // engine/honey.ts; this loop only supplies the observed inputs.
    const daylight = isDaylight(dayPhase());
    const foragingNow = beeDebug.foraging > 0 ? beeDebug.foraging : 0;
    honeyDebug.lastForagingBees = foragingNow;
    hives.forEach((hive, hi) => {
      const store2 = usePlacementStore.getState();
      const current = store2.hiveCombs[hive.id] ?? 0;
      if (current >= 1) return;
      // share this frame's foraging bees across hives by their bee count
      const share = perHive[hi] > 0 ? foragingNow * (perHive[hi] / Math.max(1, targetTotal)) : 0;
      const appealHere = computeAppeal(
        { x: hive.position[0], z: hive.position[2] },
        world,
        FORAGE_RADIUS,
      ).score;
      honeyDebug.lastAppeal = appealHere;
      const next = advanceComb(current, Math.min(delta, 0.1), share, appealHere, s.season, daylight);
      if (next !== current) store2.setComb(hive.id, next);
    });


    // reconcile bee list (add/remove gently, keep existing bees stable)
    const hivesKey = hives.map((h) => h.id).join(',') + '|' + perHive.join(',');
    if (hivesKey !== lastHivesKey.current) {
      lastHivesKey.current = hivesKey;
      const list = bees.current;
      while (list.length > targetTotal) list.pop();
      let hi = 0;
      while (list.length < targetTotal && hives.length > 0) {
        list.push(initBee(hi % hives.length, hives[hi % hives.length], Math.random() * Math.PI * 2));
        hi++;
      }
      // reassign bees whose hive vanished
      list.forEach((b, idx) => {
        if (b.hiveIndex >= hives.length) b.hiveIndex = idx % Math.max(1, hives.length);
      });
    } else if (bees.current.length > targetTotal) {
      bees.current.length = targetTotal;
    }

    const t = scaledElapsed();
    beeDebug.foraging = 0;
    beeDebug.wandering = 0;
    beeDebug.homing = 0;
    let distSum = 0;
    let distMax = 0;
    let speedSum = 0;
    const blooming = s.items
      .filter((f) => foraging && inBloom(f.plantId, s.season))
      .map((f) => f.id);

    for (let bi = 0; bi < bees.current.length; bi++) {
      const bee = bees.current[bi];
      const hive = hives[bee.hiveIndex] ?? hives[0];
      if (!hive) {
        // no hive: park off-screen (count is 0 in that case anyway)
        tmpMat.makeScale(0, 0, 0);
        body.setMatrixAt(bi, tmpMat);
        wings.setMatrixAt(bi, tmpMat);
        continue;
      }

      // resolve the target by id every frame: if the flower was removed
      // (deletion, stress-test restore, save/load), re-target or go home
      let flowerInfo = bee.targetFlowerId ? flowerById.get(bee.targetFlowerId) : undefined;
      if (flowerInfo && !inBloom(flowerInfo.plantId, s.season)) flowerInfo = undefined;
      if (bee.targetFlowerId !== null && !flowerInfo) {
        bee.targetFlowerId = null;
        bee.headingHome = true;
        bee.wanderTarget = null;
        beeDebug.targetLost++;
      }

      if (bee.restingUntil <= t && bee.targetFlowerId === null) {
        // #14: rain sends the colony home - cozy, never punished; a bee
        // mid-trip finishes it, the next pick is the hive
        // #13 (P-trigger verification found the gap): night too - real
        // colonies stop foraging in the dark and cluster until morning
        if ((RAIN_TUNING.beesHome && isRaining()) || !isDaylight(dayPhase())) {
          bee.headingHome = true;
          bee.wanderTarget = null;
        } else if (blooming.length > 0 && Math.random() > 0.15) {
          bee.targetFlowerId = blooming[Math.floor(Math.random() * blooming.length)];
          // re-resolve immediately: flowerInfo must match the new target this
          // same frame, or steering below would aim at the hive while the bee
          // sits inside the hive's arrive radius -> instant "arrive" -> rest ->
          // forever parked at the entrance (the bees-idle-at-hive bug)
          flowerInfo = flowerById.get(bee.targetFlowerId) ?? undefined;
          if (flowerInfo && !inBloom(flowerInfo.plantId, s.season)) flowerInfo = undefined;
          if (flowerInfo) {
            bee.headingHome = false;
            bee.wanderTarget = null;
            beeDebug.targetFound++;
          } else {
            // lost between selection and resolution (removed this frame)
            bee.targetFlowerId = null;
            bee.headingHome = true;
            beeDebug.targetLost++;
          }
        } else if (blooming.length > 0) {
          bee.headingHome = true; // sometimes home
        } else {
          // no bloom reachable at all: forage-wander near the hive, keep
          // flying — a swarm frozen at the entrance is a dead meadow
          bee.headingHome = false;
          if (!bee.wanderTarget) {
            bee.wanderTarget = new THREE.Vector3(
              hive.position[0] + (Math.random() - 0.5) * 14,
              hive.position[1] + 1.2 + Math.random() * 1.6,
              hive.position[2] + (Math.random() - 0.5) * 14,
            );
            beeDebug.wanderPicked++;
          }
        }
      }

      const target = new THREE.Vector3();
      if (bee.targetFlowerId !== null && flowerInfo) {
        const def = PLANT_BY_ID[flowerInfo.plantId];
        target.set(
          flowerInfo.x,
          flowerInfo.y + (def ? def.height * 0.8 : 0.6),
          flowerInfo.z,
        );
        beeDebug.foraging++;
      } else if (bee.wanderTarget && !bee.headingHome) {
        target.copy(bee.wanderTarget);
        beeDebug.wandering++;
      } else {
        target.set(hive.position[0], hive.position[1] + 1.5, hive.position[2]);
        beeDebug.homing++;
      }

      if (bee.restingUntil <= t) {
        const toTarget = target.clone().sub(bee.pos);
        const dist = toTarget.length();
        if (dist < BEE_TUNING.arriveRadius) {
          // arrived: rest a moment, then pick a new target
          bee.restingUntil =
            t +
            BEE_TUNING.restSeconds[0] +
            Math.random() * (BEE_TUNING.restSeconds[1] - BEE_TUNING.restSeconds[0]);
          bee.targetFlowerId = null;
          bee.headingHome = true;
          bee.wanderTarget = null;
        } else {
          toTarget.normalize().multiplyScalar(BEE_TUNING.speed);
          // gentle wander so flight feels alive
          toTarget.x += Math.sin(t * 3.1 + bee.phase) * BEE_TUNING.wanderStrength;
          toTarget.z += Math.cos(t * 2.7 + bee.phase * 1.4) * BEE_TUNING.wanderStrength;
          bee.vel.lerp(toTarget, Math.min(1, delta * 4));
          bee.pos.addScaledVector(bee.vel, delta);
        }
      }

      // telemetry: distance from hive + flight speed (parked-swarm detector)
      const hiveDx = bee.pos.x - hive.position[0];
      const hiveDz = bee.pos.z - hive.position[2];
      const hiveDist = Math.sqrt(hiveDx * hiveDx + hiveDz * hiveDz);
      distSum += hiveDist;
      if (hiveDist > distMax) distMax = hiveDist;
      speedSum += bee.vel.length();

      // render (body + stripe share the transform)
      const bob = Math.sin(t * BEE_TUNING.bobSpeed + bee.phase) * BEE_TUNING.bobAmplitude;
      lookMat.lookAt(bee.pos, target, up);
      lookMat.setPosition(0, 0, 0);
      tmpMat.makeTranslation(bee.pos.x, bee.pos.y + bob, bee.pos.z);
      tmpMat.multiply(lookMat);
      body.setMatrixAt(bi, tmpMat);
      stripes.setMatrixAt(bi, tmpMat);
      // wings: flap via scale pulse
      const flap = Math.sin(t * 40 + bee.phase) * 0.5;
      tmpMat.makeTranslation(bee.pos.x, bee.pos.y + bob + 0.06, bee.pos.z);
      tmpMat.multiply(lookMat);
      scaleMat.makeScale(1 + flap, 1 + flap, 1);
      tmpMat.multiply(scaleMat);
      wings.setMatrixAt(bi, tmpMat);
    }
    beeDebug.count = bees.current.length;
    if (beeDebug.count > 0) {
      beeDebug.avgDistFromHive = distSum / beeDebug.count;
      beeDebug.maxDistFromHive = distMax;
      beeDebug.avgSpeed = speedSum / beeDebug.count;
    } else {
      beeDebug.avgDistFromHive = 0;
      beeDebug.maxDistFromHive = 0;
      beeDebug.avgSpeed = 0;
    }
    if (bees.current.length > 0 && !firstSwarmFired) {
      firstSwarmFired = true;
      const s2 = usePlacementStore.getState();
      if (!s2.milestones.includes('firstSwarm')) {
        s2.earnMilestone(
          'firstSwarm',
          'Wings in the air',
          'Bees are foraging! A colony visits flowers at its own gentle rhythm.',
        );
      }
    }
    body.count = bees.current.length;
    stripes.count = bees.current.length;
    wings.count = bees.current.length;
    body.instanceMatrix.needsUpdate = true;
    stripes.instanceMatrix.needsUpdate = true;
    wings.instanceMatrix.needsUpdate = true;
  };

  useFrame((_, delta) => {
    try {
      updateSwarm(scaledDelta(), delta);
    } catch (err) {
      // invariant: no exception may ever escape the frame loop; contain it,
      // log once, and keep the app alive
      if (!crashLogged) {
        crashLogged = true;
        console.error('[bees] frame error contained (swarm pauses, app unaffected):', err);
      }
    }
  });

  const bodyGeo = useMemo(() => new THREE.BoxGeometry(...BEE_TUNING.bodySize), []);
  const stripeGeo = useMemo(
    () =>
      new THREE.BoxGeometry(
        BEE_TUNING.bodySize[0] * 1.04,
        BEE_TUNING.bodySize[1] * 1.04,
        BEE_TUNING.bodySize[2] * 0.35,
      ),
    [],
  );
  const wingGeo = useMemo(
    () => new THREE.BoxGeometry(BEE_TUNING.bodySize[0] * 2.6, BEE_TUNING.bodySize[1] * 0.2, BEE_TUNING.bodySize[2] * 1.1),
    [],
  );
  return (
    <group>
      <instancedMesh ref={bodyRef} args={[bodyGeo, undefined, MAX_BEES]} frustumCulled={false} castShadow>
        <meshLambertMaterial color={BEE_TUNING.bodyColor} />
      </instancedMesh>
      <instancedMesh ref={stripeRef} args={[stripeGeo, undefined, MAX_BEES]} frustumCulled={false}>
        <meshLambertMaterial color={BEE_TUNING.stripeColor} />
      </instancedMesh>
      <instancedMesh ref={wingRef} args={[wingGeo, undefined, MAX_BEES]} frustumCulled={false}>
        <meshLambertMaterial color={BEE_TUNING.wingColor} transparent opacity={BEE_TUNING.wingOpacity} />
      </instancedMesh>
    </group>
  );
}
