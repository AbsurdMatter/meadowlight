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

/**
 * #29 pass 2: the exact band/hills boundary on the shared lattice. A cell
 * of the 1.6 grid with center-distance <= this value belongs to the pond
 * system (band pieces); hills lays everything beyond. half-diagonal of a
 * step*1.02 box means no hills box can straddle into the band, and no band
 * gap opens: the edge is exact, not approximated.
 */
/** The single water-surface Y for the whole pond: flat, one level. */
function pondWaterSurfaceY(): number {
  return groundAt(LAKE.center[0], LAKE.center[1]).height - LAKE.surfaceDrop;
}

/**
 * #29 pass 2: the EXACT band/hills boundary on the shared lattice. A cell
 * belongs to the pond system (band pieces) iff any CORNER of its box
 * touches the band region — corner distance, not center distance, because
 * axis-aligned boxes approach the round pond diagonally: a center rule
 * underestimates the near corner (source of the residual meadow cut-in).
 * Hills skips exactly the same set: the two systems partition the lattice.
 */
function isPondBandCell(x: number, z: number): boolean {
  // hills box sizes VARY (minSize..maxSize x step, plus jitter) — the
  // classifier must use the maximum possible extent, or a big box can
  // still poke into the band from a cell classified as hills
  const half = (HILLS.step * HILLS.maxSize) / 2 + HILLS.step * HILLS.jitter * 0.5;
  const dx = x - LAKE.center[0];
  const dz = z - LAKE.center[1];
  const maxD = LAKE.radius + LAKE.shoreWidth;
  return (
    Math.hypot(dx - half, dz - half) <= maxD ||
    Math.hypot(dx + half, dz - half) <= maxD ||
    Math.hypot(dx - half, dz + half) <= maxD ||
    Math.hypot(dx + half, dz + half) <= maxD
  );
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
        // pond-as-terrain, ONE cell map (#29 pass 2): the boundary is
        // EXACT on the shared lattice — the band claims every cell whose
        // box would touch it (center within maxD + half-diagonal), and
        // hills skips exactly that set. No straddling box can cut in.
        if (isPondBandCell(x, z)) continue;
        // no jitter near the band so hills boxes meet the band flush
        const lakeDB = Math.hypot(x - LAKE.center[0], z - LAKE.center[1]);
        const nearBand = lakeDB < LAKE.radius + LAKE.shoreWidth + step * 1.5;
        const jitterScale = nearBand ? 0 : HILLS.jitter;
        const jx = x + (rng() - 0.5) * step * jitterScale;
        const jz = z + (rng() - 0.5) * step * jitterScale;
        const h = backgroundHeight(jx, jz);
        const size = step * (HILLS.minSize + rng() * (HILLS.maxSize - HILLS.minSize));
        const extraDepth = Math.max(0, h - backgroundHeight(0, 0)) + 4;
        const boxH = HILLS.boxHeight + extraDepth;
        mat.makeScale(size, boxH, size);
        mat.setPosition(jx, h - boxH * 0.55, jz);
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
   * Pond-as-terrain, one cell map (#29): the pond pass runs ON the hills'
   * own lattice — the same origin and 1.6 step, snapped. Every lattice
   * cell near the pond is EXACTLY ONE of: pond (carved floor + water),
   * sandy band (granulated into 2x2 sub-pieces), or hills terrain (laid by
   * the hills pass, which skips the first two). One lattice means zero
   * offset overlaps ("meadow cut-in") and zero sliver gaps ("holes") at
   * the shoreline — by construction, not by tuning.
   */
  const bandRef = useRef<THREE.InstancedMesh>(null);
  const floorRef = useRef<THREE.InstancedMesh>(null);
  const waterRef = useRef<THREE.InstancedMesh>(null);

  const step = HILLS.step;
  const sub = LAKE.bandSubdivision;
  const subStep = step / sub;
  const cx = LAKE.center[0];
  const cz = LAKE.center[1];

  const bandCount = useMemo(() => {
    // band covers the FULL corner-extended ring, generously sized
    const r = LAKE.radius + LAKE.shoreWidth + step * 1.6;
    const cells = Math.ceil((Math.PI * (r + step) ** 2 - Math.PI * LAKE.radius ** 2) / (step * step));
    return Math.ceil(cells * sub * sub * 1.5);
  }, []);
  const waterCount = useMemo(
    () => Math.ceil((Math.PI * (LAKE.radius + step) ** 2) / (step * step)),
    [],
  );

  /** band cells: every lattice cell whose box touches the band region —
   *  corner-exact (isPondBandCell), full ring, uniformly granulated */
  const isBandCell = (x: number, z: number) =>
    isPondBandCell(x, z) && Math.hypot(x - LAKE.center[0], z - LAKE.center[1]) > LAKE.radius;

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

    // THE HILLS LATTICE: same origin (-outer) and step the hills pass uses.
    // Iterate lattice cells whose center falls within maxD + step of the
    // pond center — the cell's classification is by its CENTER, so the
    // partition is exact on this lattice.
    const outer = HILLS.outerRadius;
    let bi = 0;
    let fi = 0;
    let wi = 0;
    for (let x = -outer; x <= outer; x += step) {
      for (let z = -outer; z <= outer; z += step) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > LAKE.radius + LAKE.shoreWidth + step * 2) continue;
        const ground = groundAt(x, z).height;
        if (d <= LAKE.radius) {
          // POND CELL: carved solid floor + translucent water body above
          const floorTop = ground - LAKE.carveDepth;
          const depth = LAKE.carveDepth + 0.4;
          mat.makeScale(step * 1.02, depth, step * 1.02);
          mat.setPosition(x, floorTop - depth / 2, z);
          floor.setMatrixAt(fi, mat);
          floor.setColorAt(fi, color.copy(bottom));
          fi++;
          // WATER FINDS ITS LEVEL (#29 pass 2): one constant surface Y
          // for the entire pond — sampled once at the pond center, never
          // per-cell. Every cube's top shares this exact Y.
          const wh = Math.max(0.05, pondWaterSurfaceY() - floorTop);
          mat.makeScale(step * 0.98, wh, step * 0.98);
          mat.setPosition(x, floorTop + wh / 2, z);
          water.setMatrixAt(wi, mat);
          water.setColorAt(wi, color.copy(waterCol));
          wi++;
        } else if (isBandCell(x, z)) {
          // BAND CELL: granulate into sub x sub snapped sub-pieces.
          // Sub-piece heights follow the heightfield at their own centers
          // (sub-pieces are exact subdivisions — still on the parent
          // lattice lines, zero offsets possible).
          // #29 pass 4: reverted to the neat, grid-aligned band (pass-2
          // style) — the shoreline speaks the same disciplined voxel-step
          // language as the rest of the world; no jitter, no rotation
          for (let sx = 0; sx < sub; sx++) {
            for (let sz = 0; sz < sub; sz++) {
              const px = x + (sx - (sub - 1) / 2) * subStep;
              const pz = z + (sz - (sub - 1) / 2) * subStep;
              const g = groundAt(px, pz).height;
              const depth = 1.4 + Math.max(0, g) * 0.5;
              mat.makeScale(subStep * 1.02, depth, subStep * 1.02);
              mat.setPosition(px, g - depth * 0.5 + 0.01, pz);
              band.setMatrixAt(bi, mat);
              // gentle per-piece tone variance (subtle, in-language)
              const v = 0.12 + ((sx * 3 + sz * 5) % 4) * 0.04;
              band.setColorAt(bi, color.copy(sand).lerp(bottom, v));
              bi++;
            }
          }
        }
      }
    }
    band.count = bi;
    floor.count = fi;
    water.count = wi;
    for (const mesh of [band, floor, water]) {
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
    // #6: composed clouds — the template's wind-swept silhouette with small
    // seeded variation so clusters are siblings, not clones
    return CLOUDS.clusters.map((c, ci) => ({
      ...c,
      x: (rng() * 2 - 1) * CLOUDS.wrapHalfWidth,
      puffs: CLOUDS.puffTemplate.map((p, pi) => ({
        offset: [
          p.offset[0] + (rng() - 0.5) * 1.2,
          p.offset[1] + (rng() - 0.5) * 0.4,
          p.offset[2] + (rng() - 0.5) * 1.2,
        ] as [number, number, number],
        size: [
          p.size[0] * (0.85 + rng() * 0.3),
          p.size[1] * (0.85 + rng() * 0.3),
          p.size[2] * (0.85 + rng() * 0.3),
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
