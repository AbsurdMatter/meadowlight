/**
 * Session 7 U1: the ONE shared seeded-hash source.
 *
 * The carry-over rule (v3 ROADMAP): "seed hash joins dayPhase/season as
 * named state with exactly one definition." Every deterministic roll in the
 * world that must be stable across reloads (ambient scatter, grass drifts,
 * bushlet jitter — and now volunteer seeding) derives from this pattern.
 * Until now the pattern lived as private copies in GrassTufts.tsx /
 * PlacedStructures.tsx; the seeding module is the first BEHAVIORAL consumer
 * (it decides what exists in the world, not just how it looks), so the
 * definition is promoted here and the render copies stay render-only.
 *
 * Same math as the grass hash2 (quantized integer hash, stable across
 * machines — no Math.random anywhere in seeding).
 */
export function hash2(x: number, z: number, salt: number): number {
  let h = (x * 374761393 + z * 668265263 + salt * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/** three-int hash: the seeding roll's own arity (seed, epoch, item) */
export function hash3(a: number, b: number, c: number, salt: number): number {
  return hash2(a * 73856093 ^ b * 19349663, c * 83492791, salt);
}
