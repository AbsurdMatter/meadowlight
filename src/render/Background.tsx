import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MEADOW_SIZE } from '../engine/terrain';
import {
  HILLS,
  LAKE,
  TREES,
  CLOUDS,
  FOG,
  backgroundHeight,
} from '../data/environment';

function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function Hills() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const count = useMemo(() => {
    const inner = HILLS.innerRadius;
    const outer = HILLS.outerRadius;
    const step = HILLS.step;
    const area = Math.PI * (outer * outer - inner * inner);
    return Math.floor(area / (step * step));
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const rng = makeRng(20260101);
    const mat = new THREE.Matrix4();
    const color = new THREE.Color();
    const fogColor = new THREE.Color(FOG.color);
    const meadow = HILLS.meadowGrassColors.map((c) => new THREE.Color(c));
    const hills = HILLS.hillColors.map((c) => new THREE.Color(c));
    const step = HILLS.step;
    let i = 0;
    const outer = HILLS.outerRadius;
    for (let x = -outer; x <= outer; x += step) {
      for (let z = -outer; z <= outer; z += step) {
        const r = Math.hypot(x, z);
        if (r < HILLS.innerRadius || r > outer) continue;
        const jx = x + (rng() - 0.5) * step * HILLS.jitter;
        const jz = z + (rng() - 0.5) * step * HILLS.jitter;
        const h = backgroundHeight(jx, jz);
        const size = step * (HILLS.minSize + rng() * (HILLS.maxSize - HILLS.minSize));
        const extraDepth = Math.max(0, h - backgroundHeight(0, 0)) + 4;
        mat.makeScale(size, HILLS.boxHeight + extraDepth, size);
        mat.setPosition(jx, h - (HILLS.boxHeight + extraDepth) * 0.55, jz);
        mesh.setMatrixAt(i, mat);
        const local = Math.hypot(jx, jz);
        const nearMeadow = local < HILLS.liftStartRadius + 4;
        const base = nearMeadow
          ? meadow[Math.floor(rng() * meadow.length)]
          : hills[Math.floor(rng() * hills.length)];
        const t = THREE.MathUtils.clamp(
          (local - HILLS.fogBlendStart) / (HILLS.fogBlendEnd - HILLS.fogBlendStart),
          0,
          1,
        );
        color.copy(base).lerp(fogColor, t * HILLS.fogBlendStrength);
        mesh.setColorAt(i, color);
        i++;
      }
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Lake() {
  const waterRef = useRef<THREE.InstancedMesh>(null);
  const shoreRef = useRef<THREE.InstancedMesh>(null);

  const shoreCount = useMemo(() => {
    const step = LAKE.voxelStep;
    const ringArea = Math.PI * ((LAKE.radius + LAKE.shoreWidth) ** 2 - LAKE.radius ** 2);
    return Math.ceil(ringArea / (step * step)) * 2;
  }, []);

  /**
   * Voxel water capacity: every grid cell whose center lies within
   * radius + one step (boundary cells included) — the same step grid the
   * shore ring uses, snapped to cell centers. Generous upper bound.
   */
  const waterCount = useMemo(() => {
    const step = LAKE.voxelStep;
    const r = LAKE.radius + step;
    return Math.ceil(Math.PI * (r * 1.2) ** 2 / (step * step)) + 8;
  }, []);

  useEffect(() => {
    const shore = shoreRef.current;
    if (!shore) return;
    const rng = makeRng(715517);
    const mat = new THREE.Matrix4();
    const color = new THREE.Color();
    const fogColor = new THREE.Color(FOG.color);
    const bed = new THREE.Color(LAKE.bedColor);
    const sand = new THREE.Color(LAKE.shoreColor);
    const step = LAKE.voxelStep;
    let i = 0;
    for (let x = -60; x <= 60; x += step) {
      for (let z = -60; z <= 60; z += step) {
        const dx = x - LAKE.center[0];
        const dz = z - LAKE.center[1];
        const d = Math.hypot(dx, dz);
        if (d < LAKE.radius - 0.2 || d > LAKE.radius + LAKE.shoreWidth) continue;
        const jx = x + (rng() - 0.5) * step * 0.6;
        const jz = z + (rng() - 0.5) * step * 0.6;
        const jd = Math.hypot(jx - LAKE.center[0], jz - LAKE.center[1]);
        const h = backgroundHeight(jx, jz);
        const sink = THREE.MathUtils.clamp((LAKE.radius + LAKE.shoreWidth - jd) / LAKE.shoreWidth, 0, 1);
        const y = h - 0.35 * sink;
        mat.makeScale(step * 1.15, 1.1, step * 1.15);
        mat.setPosition(jx, y - 0.5, jz);
        shore.setMatrixAt(i, mat);
        color.copy(sand).lerp(bed, sink).lerp(fogColor, 0.18);
        shore.setColorAt(i, color);
        i++;
      }
    }
    shore.count = i;
    shore.instanceMatrix.needsUpdate = true;
    if (shore.instanceColor) shore.instanceColor.needsUpdate = true;
    shore.computeBoundingSphere();
  }, []);

  /**
   * Voxel water surface: instanced cubes on the step grid, snapped to cell
   * centers (no rounded disc). A cell is water when its center is within
   * LAKE.radius; boundary cells whose center is just outside but whose
   * area still overlaps the disc get a partial-width box, so the waterline
   * steps cleanly into the shore. Each cube's top sits at
   * LAKE.level + LAKE.surfaceHeight (a visible voxel lip above the old
   * plane level); depth tint blends the two water colors so shallow edges
   * read warmer.
   */
  useEffect(() => {
    const water = waterRef.current;
    if (!water) return;
    const mat = new THREE.Matrix4();
    const color = new THREE.Color();
    const colorA = new THREE.Color(LAKE.colorA);
    const colorB = new THREE.Color(LAKE.colorB);
    const bed = new THREE.Color(LAKE.bedColor);
    const step = LAKE.voxelStep;
    const cx = LAKE.center[0];
    const cz = LAKE.center[1];
    const topY = LAKE.level + LAKE.surfaceHeight;
    let i = 0;
    for (let gx = -60; gx <= 60; gx += step) {
      for (let gz = -60; gz <= 60; gz += step) {
        const x = cx + Math.round((gx - cx) / step) * step;
        const z = cz + Math.round((gz - cz) / step) * step;
        const d = Math.hypot(x - cx, z - cz);
        if (d > LAKE.radius + step * 0.5) continue;
        // fraction of the cell covered by the disc (0..1)
        const cover = THREE.MathUtils.clamp((LAKE.radius - d) / step + 0.5, 0, 1);
        if (cover <= 0.05) continue;
        const size = step * Math.max(0.35, cover);
        const ground = backgroundHeight(x, z);
        // cube extends from below the ground up to the waterline lip
        const bottom = Math.min(ground - 0.4, topY - 1.6);
        const h = topY - bottom;
        mat.makeScale(size, h, size);
        mat.setPosition(x, bottom + h / 2, z);
        water.setMatrixAt(i, mat);
        // depth tint: shallow (near the rim) shows more bed color through
        const depth = THREE.MathUtils.clamp((LAKE.radius - d) / LAKE.radius, 0, 1);
        color.copy(colorA).lerp(colorB, 0.4).lerp(bed, (1 - depth) * LAKE.shallowTint);
        water.setColorAt(i, color);
        i++;
      }
    }
    water.count = i;
    water.instanceMatrix.needsUpdate = true;
    if (water.instanceColor) water.instanceColor.needsUpdate = true;
    water.computeBoundingSphere();
  }, []);

  return (
    <group>
      <instancedMesh ref={shoreRef} args={[undefined, undefined, shoreCount]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={waterRef} args={[undefined, undefined, waterCount]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial transparent opacity={LAKE.opacity} vertexColors />
      </instancedMesh>
    </group>
  );
}

function Forest() {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const foliageRef = useRef<THREE.InstancedMesh>(null);

  const totalTrees = useMemo(
    () => TREES.clusters.reduce((a, c) => a + c.count, 0),
    [],
  );
  const maxFoliage = useMemo(() => {
    let max = 0;
    for (const v of TREES.variants) max = Math.max(max, v.foliage.length);
    return totalTrees * max;
  }, [totalTrees]);

  useEffect(() => {
    const trunks = trunkRef.current;
    const foliage = foliageRef.current;
    if (!trunks || !foliage) return;
    const rng = makeRng(991103);
    const mat = new THREE.Matrix4();
    const color = new THREE.Color();
    const fogColor = new THREE.Color(FOG.color);
    let trunkI = 0;
    let foliageI = 0;
    for (const cluster of TREES.clusters) {
      for (let t = 0; t < cluster.count; t++) {
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * cluster.spread;
        const x = cluster.x + Math.cos(a) * r;
        const z = cluster.z + Math.sin(a) * r;
        const gy = backgroundHeight(x, z);
        const variant = TREES.variants[Math.floor(rng() * TREES.variants.length)];
        const scale = 0.8 + rng() * 0.5;
        const rotY = rng() * Math.PI * 2;
        const dist = Math.hypot(x, z);
        const fogT = THREE.MathUtils.clamp(
          (dist - HILLS.fogBlendStart) / (HILLS.fogBlendEnd - HILLS.fogBlendStart),
          0,
          1,
        ) * HILLS.fogBlendStrength;
        mat.makeRotationY(rotY);
        const trunk = variant.trunk;
        mat.multiply(
          new THREE.Matrix4().makeScale(
            trunk.size[0] * scale,
            trunk.size[1] * scale,
            trunk.size[2] * scale,
          ),
        );
        mat.setPosition(x, gy + trunk.offset[1] * scale, z);
        trunks.setMatrixAt(trunkI, mat);
        color
          .set(TREES.trunkColors[Math.floor(rng() * TREES.trunkColors.length)])
          .lerp(fogColor, fogT);
        trunks.setColorAt(trunkI, color);
        trunkI++;
        for (const f of variant.foliage) {
          mat.makeRotationY(rotY + rng() * 0.2);
          mat.multiply(
            new THREE.Matrix4().makeScale(
              f.size[0] * scale,
              f.size[1] * scale,
              f.size[2] * scale,
            ),
          );
          mat.setPosition(x, gy + f.offset[1] * scale, z);
          foliage.setMatrixAt(foliageI, mat);
          color
            .set(TREES.foliageColors[Math.floor(rng() * TREES.foliageColors.length)])
            .lerp(fogColor, fogT);
          foliage.setColorAt(foliageI, color);
          foliageI++;
        }
      }
    }
    trunks.count = trunkI;
    foliage.count = foliageI;
    trunks.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
    if (trunks.instanceColor) trunks.instanceColor.needsUpdate = true;
    if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    foliage.computeBoundingSphere();
  }, []);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, totalTrees]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={foliageRef} args={[undefined, undefined, maxFoliage]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
    </group>
  );
}

function Clouds() {
  const groupRef = useRef<THREE.Group>(null);
  const clusterRefs = useRef<(THREE.Group | null)[]>([]);

  const clusters = useMemo(() => {
    const rng = makeRng(31415);
    return CLOUDS.clusters.map((c, ci) => ({
      ...c,
      x: (rng() * 2 - 1) * CLOUDS.wrapHalfWidth,
      puffs: Array.from({ length: CLOUDS.puffsPerCloud }, (_, pi) => ({
        offset: [
          (rng() * 2 - 1) * 5.5,
          (rng() * 2 - 1) * 1.2,
          (rng() * 2 - 1) * 2.5,
        ] as [number, number, number],
        size: [
          3 + rng() * 4.5,
          1.2 + rng() * 1.4,
          2.5 + rng() * 3,
        ] as [number, number, number],
        seed: ci * 10 + pi,
      })),
    }));
  }, []);

  useFrame((_, delta) => {
    for (let i = 0; i < clusters.length; i++) {
      const g = clusterRefs.current[i];
      if (!g) continue;
      g.position.x += clusters[i].speed * delta;
      if (g.position.x > CLOUDS.wrapHalfWidth) {
        g.position.x = -CLOUDS.wrapHalfWidth;
      }
    }
  });

  const rng2 = useMemo(() => makeRng(27182), []);

  return (
    <group ref={groupRef}>
      {clusters.map((c, ci) => (
        <group
          key={ci}
          ref={(g) => {
            clusterRefs.current[ci] = g;
          }}
          position={[c.x, c.height, c.z]}
          scale={c.scale}
        >
          {c.puffs.map((p, pi) => {
            const shade = 0.92 + rng2() * 0.08;
            return (
              <mesh key={pi} position={p.offset}>
                <boxGeometry args={p.size} />
                <meshLambertMaterial
                  color={new THREE.Color(CLOUDS.color).multiplyScalar(shade)}
                  transparent
                  opacity={CLOUDS.opacity}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

export function Background() {
  return (
    <group>
      <Hills />
      <Lake />
      <Forest />
      <Clouds />
    </group>
  );
}

void MEADOW_SIZE;
