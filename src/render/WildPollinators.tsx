import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BUTTERFLY_TUNING,
  HOVERFLY_TUNING,
  WILD_MIN_BLOOM,
  WILD_FLOWERS_PER_EXTRA,
  type WildPollinatorTuning,
} from '../data/wildpollinators';
import {
  QUEEN_BUMBLE_TUNING,
  LAVENDER_MOTH_TUNING,
  HOVERFLY_AUTUMN_TUNING,
  isEarlySpring,
  type SeasonalVisitorTuning,
} from '../data/seasonalVisitors';
import { PLANT_BY_ID } from '../data/plants';
import { usePlacementStore } from './placementStore';
import { registerWildlifeProbe, type WildlifeKind } from './magnifierProbes';
import { inBloom } from '../engine/pollinator';
import { noVariation } from '../engine/variation';
import { dayPhase } from '../engine/dayCycle';
import { scaledDelta, scaledElapsed } from '../engine/scaledTime';
import { seasonProgress } from '../engine/seasonClock';
import { recordVisitorWindow } from './visitorLog';

/**
 * #15 (session 5): butterflies & hoverflies. Reuses the bee swarm's steering
 * approach — the SAME fixed target-resolution order as BeeSwarm (PR #34's
 * lesson): flower world data is re-resolved IMMEDIATELY after target
 * selection, same frame, so a visitor that picks a flower never steers at
 * its spawn anchor that frame (the bees-idle-at-hive trap). With no bloom in
 * range, visitors wander gently instead of parking.
 *
 * Session 7 U2 (#new): seasonal wild visitors join the same system — the
 * spring queen bumblebee and the evening lavender moth render through the
 * same instanced steering, gated by their NATURAL conditions (season, day
 * phase, target bloom). The hoverfly thins into autumn stragglers. No direct
 * spawn force exists anywhere (the session-5 butterfly decision, kept):
 * the P panel forces the conditions (season / time-of-day / flowers), never
 * the spawn.
 *
 * Telemetry follows the beeDebug pattern (addendum B): wildDebug exposes
 * per-species counts plus targetFound/targetLost/foraging/wandering/homing.
 */

interface VisitorState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** id of the placed flower this visitor heads to — re-resolved per frame */
  targetFlowerId: string | null;
  /** gentle wander point when no bloom is reachable */
  wanderTarget: THREE.Vector3 | null;
  /** true while drifting back toward a meadow anchor */
  headingHome: boolean;
  phase: number;
  restingUntil: number;
}

/** home anchor for wandering visitors: a fixed point above the meadow center */
const ANCHOR = new THREE.Vector3(0, 3.2, 0);

/** live telemetry, exposed for the test hook / P panel (beeDebug pattern) */
export const wildDebug = {
  butterflies: 0,
  hoverflies: 0,
  queenBumbles: 0,
  lavenderMoths: 0,
  targetFound: 0,
  targetLost: 0,
  foraging: 0,
  wandering: 0,
  homing: 0,
};

const tmpMat = new THREE.Matrix4();
const lookMat = new THREE.Matrix4();
const scaleMat = new THREE.Matrix4();
const up = new THREE.Vector3(0, 1, 0);
const flowerById = new Map<string, { x: number; y: number; z: number; plantId: string }>();
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

function makeVisitors(
  tuning: { speed: number },
  count: number,
): VisitorState[] {
  const out: VisitorState[] = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 10;
    out.push({
      pos: new THREE.Vector3(Math.cos(a) * r, 1.8 + Math.random() * 1.4, Math.sin(a) * r),
      vel: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(tuning.speed * 0.5),
      targetFlowerId: null,
      wanderTarget: null,
      headingHome: true,
      phase: Math.random() * Math.PI * 2,
      restingUntil: 0,
    });
  }
  return out;
}

/** the shape both tuning styles share — the render treats visitors uniformly */
interface RenderTuning {
  id: string;
  bodySize: [number, number, number];
  bodyColor: string;
  wingColor: string;
  wingAccentColor: string;
  wingOpacity: number;
  speed: number;
  wanderStrength: number;
  bobAmplitude: number;
  bobSpeed: number;
  restSeconds: [number, number];
  baseCount: number;
  maxCount: number;
  activeSeasons: import('../data/seasons').Season[];
}

function WildSpecies({ tuning }: { tuning: RenderTuning }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const wingRef = useRef<THREE.InstancedMesh>(null);
  const accentRef = useRef<THREE.InstancedMesh>(null);
  const visitors = useRef<VisitorState[]>([]);
  // N3 coverage: read-only live positions — kind per species (butterfly,
  // hoverfly, queenbumble, lavendermoth all render through this component)
  useEffect(
    () =>
      registerWildlifeProbe(tuning.id as WildlifeKind, () =>
        visitors.current.map((v) => ({ kind: tuning.id as WildlifeKind, x: v.pos.x, y: v.pos.y, z: v.pos.z })),
      ),
    [tuning.id],
  );
  const lastCount = useRef(-1);

  const bodyGeo = useMemo(() => new THREE.BoxGeometry(...tuning.bodySize), [tuning]);
  const wingGeo = useMemo(
    () =>
      new THREE.BoxGeometry(
        tuning.bodySize[0] * 3.2,
        tuning.bodySize[1] * 0.18,
        tuning.bodySize[2] * 1.1,
      ),
    [tuning],
  );
  const accentGeo = useMemo(
    () =>
      new THREE.BoxGeometry(
        tuning.bodySize[0] * 0.9,
        tuning.bodySize[1] * 0.5,
        tuning.bodySize[2] * 0.9,
      ),
    [tuning],
  );

  const update = (delta: number) => {
    const body = bodyRef.current;
    const wings = wingRef.current;
    const accent = accentRef.current;
    if (!body || !wings || !accent) return;
    const s = usePlacementStore.getState();
    syncFlowers();

    // ---- natural conditions (ONE source per semantic) ----
    // season + day phase come from their own single clock modules; the
    // seasonal visitors add their own gates on top of the shared rule
    const season = s.season;
    const phase = dayPhase();
    const seasonal = tuning as unknown as SeasonalVisitorTuning | WildPollinatorTuning;
    let active = tuning.activeSeasons.includes(season);
    // U2: the seasonal species' own gates — phase window + target bloom +
    // sub-season window. Force-able only through these natural inputs.
    if (active && 'phaseWindow' in seasonal && seasonal.phaseWindow) {
      active = seasonal.phaseWindow(phase);
    }
    if (active && (tuning.id === 'queenbumble' || tuning.id === 'lavendermoth')) {
      // queen: early spring only (a late-spring meadow sees workers, not her)
      if (tuning.id === 'queenbumble') active = isEarlySpring(seasonProgress());
    }
    // target-bloom gate: the seasonal species come for SPECIFIC flowers
    let targetIds: string[] | null = null;
    if ('targetPlantIds' in seasonal && seasonal.targetPlantIds) {
      targetIds = seasonal.targetPlantIds;
    }
    let blooming: string[] = active
      ? s.items
          .filter(
            (f) =>
              inBloom(f.plantId, season) &&
              (!targetIds || targetIds.includes(f.plantId)),
          )
          .map((f) => f.id)
      : [];

    // population: base + one per WILD_FLOWERS_PER_EXTRA blooming flowers,
    // gated at WILD_MIN_BLOOM so an empty meadow stays quiet; capped
    let target = 0;
    if (active && blooming.length >= WILD_MIN_BLOOM) {
      target = Math.min(
        tuning.maxCount,
        tuning.baseCount + Math.floor((blooming.length - WILD_MIN_BLOOM) / WILD_FLOWERS_PER_EXTRA),
      );
    }
    // U2: autumn hoverfly stragglers — thin the population, never grow it
    if (tuning.id === 'hoverfly' && season === HOVERFLY_AUTUMN_TUNING.season) {
      target = Math.floor(target * HOVERFLY_AUTUMN_TUNING.fraction);
    }
    if (target !== lastCount.current) {
      lastCount.current = target;
      const list = visitors.current;
      while (list.length > target) list.pop();
      while (list.length < target) list.push(...makeVisitors(tuning, target - list.length));
      // the visit WINDOW record rides the same natural-condition gate —
      // one notebook entry per visitor per season window, never per frame
      if (target > 0 && (tuning.id === 'queenbumble' || tuning.id === 'lavendermoth')) {
        recordVisitorWindow(tuning.id, season);
      }
    }

    const t = scaledElapsed();
    if (tuning.id === 'butterfly') wildDebug.butterflies = visitors.current.length;
    else if (tuning.id === 'hoverfly') wildDebug.hoverflies = visitors.current.length;
    else if (tuning.id === 'queenbumble') wildDebug.queenBumbles = visitors.current.length;
    else if (tuning.id === 'lavendermoth') wildDebug.lavenderMoths = visitors.current.length;

    // U2: the straggler's air — a touch slower in autumn (tuning, not a hack)
    const speedScale =
      tuning.id === 'hoverfly' && season === HOVERFLY_AUTUMN_TUNING.season
        ? HOVERFLY_AUTUMN_TUNING.speedScale
        : 1;

    for (let bi = 0; bi < visitors.current.length; bi++) {
      const v = visitors.current[bi];

      // PR #34's fixed resolution order, unchanged: resolve, then — if a new
      // target was picked this frame — re-resolve immediately so steering
      // aims at the flower, never at the anchor while resting inside it
      let flowerInfo = v.targetFlowerId ? flowerById.get(v.targetFlowerId) : undefined;
      if (flowerInfo && !inBloom(flowerInfo.plantId, s.season)) flowerInfo = undefined;
      if (targetIds && flowerInfo && !targetIds.includes(flowerInfo.plantId)) flowerInfo = undefined;
      if (v.targetFlowerId !== null && !flowerInfo) {
        v.targetFlowerId = null;
        v.headingHome = true;
        v.wanderTarget = null;
        wildDebug.targetLost++;
      }

      if (v.restingUntil <= t && v.targetFlowerId === null) {
        if (blooming.length > 0) {
          v.targetFlowerId = blooming[Math.floor(Math.random() * blooming.length)];
          flowerInfo = flowerById.get(v.targetFlowerId) ?? undefined;
          if (flowerInfo && !inBloom(flowerInfo.plantId, s.season)) flowerInfo = undefined;
          if (targetIds && flowerInfo && !targetIds.includes(flowerInfo.plantId)) flowerInfo = undefined;
          if (flowerInfo) {
            v.headingHome = false;
            v.wanderTarget = null;
            wildDebug.targetFound++;
          } else {
            v.targetFlowerId = null;
            v.headingHome = true;
            wildDebug.targetLost++;
          }
        } else {
          // no bloom: gentle wander, never park
          v.headingHome = false;
          if (!v.wanderTarget) {
            v.wanderTarget = new THREE.Vector3(
              (Math.random() - 0.5) * 26,
              1.6 + Math.random() * 1.8,
              (Math.random() - 0.5) * 26,
            );
          }
        }
      }

      const target = new THREE.Vector3();
      if (v.targetFlowerId !== null && flowerInfo) {
        const def = PLANT_BY_ID[flowerInfo.plantId];
        target.set(
          flowerInfo.x,
          flowerInfo.y + (def ? def.height * 0.9 : 0.7),
          flowerInfo.z,
        );
        wildDebug.foraging++;
      } else if (v.wanderTarget && !v.headingHome) {
        target.copy(v.wanderTarget);
        wildDebug.wandering++;
      } else {
        target.copy(ANCHOR);
        wildDebug.homing++;
      }

      if (v.restingUntil <= t) {
        const toTarget = target.clone().sub(v.pos);
        const dist = toTarget.length();
        if (dist < 0.5) {
          // N2: arrival at a flower IS the visit — one write path, deduped
          if (v.targetFlowerId !== null) usePlacementStore.getState().recordVisit(v.targetFlowerId);
          v.restingUntil =
            t +
            tuning.restSeconds[0] +
            Math.random() * (tuning.restSeconds[1] - tuning.restSeconds[0]);
          v.targetFlowerId = null;
          v.headingHome = true;
          v.wanderTarget = null;
        } else {
          toTarget.normalize().multiplyScalar(tuning.speed * speedScale);
          toTarget.x += Math.sin(t * 2.2 + v.phase) * tuning.wanderStrength;
          toTarget.z += Math.cos(t * 1.9 + v.phase * 1.3) * tuning.wanderStrength;
          v.vel.lerp(toTarget, Math.min(1, delta * 3));
          v.pos.addScaledVector(v.vel, delta);
        }
      }

      const bob = Math.sin(t * tuning.bobSpeed + v.phase) * tuning.bobAmplitude;
      lookMat.lookAt(v.pos, target, up);
      lookMat.setPosition(0, 0, 0);
      tmpMat.makeTranslation(v.pos.x, v.pos.y + bob, v.pos.z);
      tmpMat.multiply(lookMat);
      body.setMatrixAt(bi, tmpMat);
      accent.setMatrixAt(bi, tmpMat);
      // wings: slow flap for butterflies, blur-fast shimmer for hoverflies
      const flapRate =
        tuning.id === 'butterfly' ? 7 : tuning.id === 'lavendermoth' ? 14 : 40;
      const flap = Math.abs(Math.sin(t * flapRate + v.phase)) * 0.9 + 0.1;
      tmpMat.makeTranslation(v.pos.x, v.pos.y + bob + 0.04, v.pos.z);
      tmpMat.multiply(lookMat);
      scaleMat.makeScale(flap, 1, 1);
      tmpMat.multiply(scaleMat);
      wings.setMatrixAt(bi, tmpMat);
    }
    body.count = visitors.current.length;
    accent.count = visitors.current.length;
    wings.count = visitors.current.length;
    body.instanceMatrix.needsUpdate = true;
    accent.instanceMatrix.needsUpdate = true;
    wings.instanceMatrix.needsUpdate = true;
  };

  useFrame(() => {
    try {
      update(scaledDelta());
    } catch (err) {
      if (!crashLogged) {
        crashLogged = true;
        console.error('[wild pollinators] frame error contained:', err);
      }
    }
  });

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[bodyGeo, undefined, tuning.maxCount]} frustumCulled={false}
        onPointerOver={() => {
          // N3: the glass zooms a hovered visitor — pure inspection riding
          // the mesh's own pointer events (one input path, zero mutation)
          const s = usePlacementStore.getState();
          if (s.magnifierOn) s.setMagnifierEntry({ kind: 'visitor', visitorId: tuning.id });
        }}
        onPointerOut={() => {
          const s = usePlacementStore.getState();
          if (s.magnifierOn && s.magnifierEntry?.kind === 'visitor') s.setMagnifierEntry(null);
        }}
      >
        <meshLambertMaterial color={tuning.bodyColor} />
      </instancedMesh>
      <instancedMesh ref={accentRef} args={[accentGeo, undefined, tuning.maxCount]} frustumCulled={false}>
        <meshLambertMaterial color={tuning.wingColor} />
      </instancedMesh>
      <instancedMesh ref={wingRef} args={[wingGeo, undefined, tuning.maxCount]} frustumCulled={false}>
        <meshLambertMaterial color={tuning.wingAccentColor} transparent opacity={tuning.wingOpacity} />
      </instancedMesh>
    </group>
  );
}

export function WildPollinators() {
  return (
    <group>
      <WildSpecies tuning={BUTTERFLY_TUNING} />
      <WildSpecies tuning={HOVERFLY_TUNING} />
      <WildSpecies tuning={QUEEN_BUMBLE_TUNING} />
      <WildSpecies tuning={LAVENDER_MOTH_TUNING} />
    </group>
  );
}
