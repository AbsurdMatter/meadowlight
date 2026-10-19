import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { dayPhase, isDusk } from '../engine/dayCycle';
import { usePlacementStore } from './placementStore';
import { groundAt } from '../engine/ground';

/**
 * #13 (session 5): fireflies at dusk. They appear only in the dusk window
 * (phase 0.79–0.92), drifting in slow looping arcs near wild corners — the
 * ecological echo of EDUCATION.md's unmown-corner line (the messy corner is
 * where the meadow's nightlife lives). Gentle glow pulse, never a swarm:
 * a handful of soft points, cozy not busy. No fail state, no mechanic —
 * pure atmosphere. Telemetry: fireflyDebug exposes count + active (test hook).
 */

export const fireflyDebug = { count: 0, active: false };

const FIREFLY_TUNING = {
  /** gentle population: scales with wild corners, capped */
  perCorner: 4,
  max: 12,
  /** flight: slow vertical-biased loops */
  speed: 0.5,
  bobAmplitude: 0.35,
  bobSpeed: 1.1,
  /** glow pulse */
  pulseSpeed: 2.4,
  bodySize: 0.09,
  color: '#f8e89a',
  /** how far from their corner fireflies drift */
  driftRadius: 5,
} as const;

interface Firefly {
  cornerId: string;
  home: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  phase: number;
  seedA: number;
}

export function Fireflies() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const flies = useRef<Firefly[]>([]);
  const lastKey = useRef('');

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const s = usePlacementStore.getState();
    const dusk = isDusk(dayPhase());
    fireflyDebug.active = dusk;

    // rebuild only when the corner set changes
    const corners = s.structures.filter((st) => st.structureId === 'wildcorner');
    const key = corners.map((c) => c.id).join(',');
    if (key !== lastKey.current) {
      lastKey.current = key;
      const list: Firefly[] = [];
      for (const c of corners) {
        const n = Math.min(FIREFLY_TUNING.max, FIREFLY_TUNING.perCorner);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const home = new THREE.Vector3(
            c.position[0] + Math.cos(a) * 2,
            groundAt(c.position[0], c.position[2]).height + 1.2,
            c.position[2] + Math.sin(a) * 2,
          );
          list.push({
            cornerId: c.id,
            home,
            pos: home.clone(),
            vel: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).multiplyScalar(0.3),
            phase: Math.random() * Math.PI * 2,
            seedA: Math.random() * Math.PI * 2,
          });
        }
      }
      flies.current = list;
    }

    const t = clock.elapsedTime;
    let i = 0;
    if (dusk) {
      for (const f of flies.current) {
        // slow looping drift around home, vertical bias
        const targetX = f.home.x + Math.cos(t * 0.23 + f.seedA) * FIREFLY_TUNING.driftRadius * 0.6;
        const targetZ = f.home.z + Math.sin(t * 0.19 + f.seedA * 1.7) * FIREFLY_TUNING.driftRadius * 0.6;
        const targetY = f.home.y + Math.sin(t * 0.4 + f.phase) * FIREFLY_TUNING.bobAmplitude;
        const to = new THREE.Vector3(targetX, targetY, targetZ).sub(f.pos);
        const dist = to.length();
        if (dist > 0.1) {
          to.normalize().multiplyScalar(FIREFLY_TUNING.speed);
          f.vel.lerp(to, Math.min(1, delta * 2));
          f.pos.addScaledVector(f.vel, delta);
        }
        const pulse = 0.5 + 0.5 * Math.sin(t * FIREFLY_TUNING.pulseSpeed + f.phase);
        const mat = new THREE.Matrix4();
        mat.makeScale(pulse + 0.3, pulse + 0.3, pulse + 0.3);
        mat.setPosition(f.pos.x, f.pos.y, f.pos.z);
        mesh.setMatrixAt(i, mat);
        i++;
      }
    }
    fireflyDebug.count = i;
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, FIREFLY_TUNING.max]} frustumCulled={false}>
      <boxGeometry args={[FIREFLY_TUNING.bodySize, FIREFLY_TUNING.bodySize, FIREFLY_TUNING.bodySize]} />
      <meshBasicMaterial color={FIREFLY_TUNING.color} transparent opacity={0.9} />
    </instancedMesh>
  );
}
