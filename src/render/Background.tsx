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
import { groundAt } from '../engine/ground';

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
        // pond-as-terrain: the pond body + sandy band are laid by the pond
        // system on THIS grid — hills boxes yield those cells entirely
        const lakeD = Math.hypot(x - LAKE.center[0], z - LAKE.center[1]);
        if (lakeD <= LAKE.radius + LAKE.shoreWidth) continue;
        // no jitter near the band edge so terrain meets the band flush
        const nearBand = lakeD < LAKE.radius + LAKE.shoreWidth + step * 1.5;
        const jitterScale = nearBand ? 0 : HILLS.jitter;
        const jx = x + (rng() - 0.5) * step * jitterScale;
        const jz = z + (rng() - 0.5) * step * jitterScale;
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
  /**
   * Pond-as-terrain: the pond is part of the terrain grid, not a special
   * object. On the SAME 1.6 step the hills use (snapped, unjittered here):
   *  - SANDY BAND: terrain-height boxes in a ring around the carved area,
   *    lightly sand-tinted — the un-carved banks (highest by construction)
   *  - CARVED BASIN: inside the disc, terrain boxes DROPPED to the carved
   *    floor depth, tinted blue-green — the solid pond bottom, no void
   *  - WATER BODY: translucent boxes filling from the floor up to a
   *    surface half a step below the band top (#28 closed by construction)
   * Every piece snaps to the same grid the regular terrain follows, so
   * edges meet in clean voxel steps: no gaps, no overlaps, no offsets.
   */
  const bandRef = useRef<THREE.InstancedMesh>(null);
  const floorRef = useRef<THREE.InstancedMesh>(null);
  const waterRef = useRef<THREE.InstancedMesh>(null);

  const step = LAKE.voxelStep;
  const cx = LAKE.center[0];
  const cz = LAKE.center[1];
  // capacity bounds per ring (generous, counts set after fill)
  const bandCount = useMemo(() => {
    const r = LAKE.radius + LAKE.shoreWidth;
    return Math.ceil((Math.PI * (r + step) ** 2) / (step * step));
  }, []);
  const waterCount = useMemo(
    () => Math.ceil((Math.PI * (LAKE.radius + step) ** 2) / (step * step)),
    [],
  );

  useEffect(() => {
    const band = bandRef.current;
    const floor = floorRef.current;
    const water = waterRef.current;
    if (!band || !floor || !water) return;
    const mat = new THREE.Matrix4();
    const color = new THREE.Color();
    const sand = new THREE.Color(LAKE.shoreColor);
    const bottom = new THREE.Color(LAKE.bottomColor);
    const waterCol = new THREE.Color(LAKE.colorA);

    let bi = 0; // band index
    let fi = 0; // floor index
    let wi = 0; // water index
    // one deterministic pass over the pond's grid neighborhood — snapped,
    // NO jitter: the pond pieces are grid-locked by definition
    for (let gx = cx - (LAKE.radius + LAKE.shoreWidth) - step; gx <= cx + (LAKE.radius + LAKE.shoreWidth) + step; gx += step) {
      for (let gz = cz - (LAKE.radius + LAKE.shoreWidth) - step; gz <= cz + (LAKE.radius + LAKE.shoreWidth) + step; gz += step) {
        const d = Math.hypot(gx - cx, gz - cz);
        const ground = groundAt(gx, gz).height;
        if (d <= LAKE.radius) {
          // CARVED BASIN: solid floor at the carved depth (blue-green,
          // visible through the water), water body filling above it
          const floorTop = ground - LAKE.carveDepth;
          const depth = LAKE.carveDepth + 0.4; // reach under the banks
          mat.makeScale(step * 1.02, depth, step * 1.02);
          mat.setPosition(gx, floorTop - depth / 2, gz);
          floor.setMatrixAt(fi, mat);
          color.copy(bottom);
          floor.setColorAt(fi, color);
          fi++;
          // water body: floor -> surface (a step below the band top)
          const surf = ground - LAKE.surfaceDrop;
          const wh = Math.max(0.05, surf - floorTop);
          mat.makeScale(step * 0.98, wh, step * 0.98);
          mat.setPosition(gx, floorTop + wh / 2, gz);
          water.setMatrixAt(wi, mat);
          color.copy(waterCol);
          water.setColorAt(wi, color);
          wi++;
        } else if (d <= LAKE.radius + LAKE.shoreWidth) {
          // SANDY BAND: terrain-height boxes (the un-carved banks), tinted
          const depth = 1.4 + Math.max(0, ground) * 0.5;
          mat.makeScale(step * 1.02, depth, step * 1.02);
          mat.setPosition(gx, ground - depth * 0.5 + 0.01, gz);
          band.setMatrixAt(bi, mat);
          color.copy(sand).lerp(bottom, 0.15);
          band.setColorAt(bi, color);
          bi++;
        }
      }
    }
    band.count = bi;
    floor.count = fi;
    water.count = wi;
    for (const [mesh] of [[band], [floor], [water]] as [THREE.InstancedMesh][]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, []);

  return (
    <group>
      <instancedMesh ref={bandRef} args={[undefined, undefined, bandCount]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={floorRef} args={[undefined, undefined, waterCount]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={waterRef} args={[undefined, undefined, waterCount]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial transparent opacity={LAKE.opacity} />
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
