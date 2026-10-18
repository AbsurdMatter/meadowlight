/** Shared gentle rolling-meadow heightfield, used by both rendering and placement. */
export const MEADOW_SIZE = 44;

export function terrainHeight(x: number, z: number): number {
  const h =
    Math.sin(x * 0.16) * 0.9 +
    Math.cos(z * 0.13) * 0.8 +
    Math.sin((x + z) * 0.07) * 1.1 +
    Math.sin(x * 0.31 + z * 0.23) * 0.25;
  return h * 0.55;
}
