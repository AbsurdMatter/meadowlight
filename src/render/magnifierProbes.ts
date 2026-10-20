/**
 * Session 8 N3 coverage round: live wildlife positions for the magnifier.
 *
 * Every animated system (BeeSwarm, SolitaryBees, WildPollinators, Fireflies,
 * the pond dragonflies) keeps its creatures' live positions in private
 * refs — this registry is the ONE read-only bridge the magnifier's
 * per-frame hit resolution consumes. Systems register a provider on mount
 * and unregister on unmount; the glass only ever READS (zero mutation).
 *
 * One input path: the inspector consumes the same raw window pointermove
 * the placement ghost already tracks (the established session-2 pattern
 * for shared pointer state) and resolves the ray to the nearest creature —
 * a different HIT RESOLUTION, not a second input path.
 */
export type WildlifeKind =
  | 'hivebee'
  | 'solitarybee'
  | 'rarebee'
  | 'butterfly'
  | 'hoverfly'
  | 'queenbumble'
  | 'lavendermoth'
  | 'fireflies'
  | 'dragonfly';

export interface WildlifeSighting {
  kind: WildlifeKind;
  x: number;
  y: number;
  z: number;
}

type Provider = () => WildlifeSighting[];

const providers = new Map<WildlifeKind, Provider>();

/** systems call this on mount: register a live-position provider (read-only) */
export function registerWildlifeProbe(kind: WildlifeKind, provider: Provider): () => void {
  providers.set(kind, provider);
  return () => {
    if (providers.get(kind) === provider) providers.delete(kind);
  };
}

/** the magnifier's one read: every creature currently alive, with positions */
export function allWildlife(): WildlifeSighting[] {
  const out: WildlifeSighting[] = [];
  for (const provide of providers.values()) {
    out.push(...provide());
  }
  return out;
}

/** telemetry only (gate/debug): which systems currently expose wildlife */
export function wildlifeProbeKinds(): WildlifeKind[] {
  return [...providers.keys()];
}
