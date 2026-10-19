import { useEffect, useState } from 'react';
import { usePlacementStore } from '../render/placementStore';
import { beeDebug } from '../render/BeeSwarm';
import { solitaryBeeDebug, rareBeeDebug } from '../render/SolitaryBees';
import { theme } from './theme';

/**
 * #18 postcard stats strip: gentle nature facts, never scores.
 *
 * Reads the LIVE store (the same data the placement/bee systems use):
 *   - nature planted   — items.length (flowers in the ground)
 *   - bee care put up  — structures.length (hives, baths, hotels, hedges,
 *                        wild corners — everything the player put up FOR bees)
 *   - bees about       — the live swarm count (colony + solitary + rare)
 *   - seasons passed   — wildSeasons.length (the seasons dial has turned
 *                        through while a wild corner has been present)
 * Facts, phrased warm; no numbers-as-judgement, no high-score framing.
 * Styled from the theme module only.
 */
function natureFacts(): string[] {
  const s = usePlacementStore.getState();
  const bees = beeDebug.count + solitaryBeeDebug.count + rareBeeDebug.count;
  const facts: string[] = [];
  facts.push(
    s.items.length === 1
      ? 'one flower in the ground — every meadow starts here'
      : `${s.items.length} flowers planted`,
  );
  facts.push(
    s.structures.length === 0
      ? 'no bee care up yet — the meadow manages on its own'
      : s.structures.length === 1
        ? 'one piece of bee care put up'
        : `${s.structures.length} pieces of bee care put up`,
  );
  facts.push(
    bees === 0
      ? 'the air is quiet — bees come with blooms'
      : bees === 1
        ? 'one bee about the meadow'
        : `${bees} bees about the meadow`,
  );
  facts.push(
    (s.wildSeasons?.length ?? 0) === 0
      ? 'the seasons have not turned yet'
      : `${s.wildSeasons.length} season${s.wildSeasons.length === 1 ? '' : 's'} passed`,
  );
  return facts;
}

export function PostcardStats() {
  const [facts, setFacts] = useState<string[]>(natureFacts());
  useEffect(() => {
    const t = setInterval(() => setFacts(natureFacts()), 800);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      data-postcard-stats
      style={{
        position: 'absolute',
        bottom: '100%',
        right: 0,
        marginBottom: 8,
        padding: '10px 14px',
        borderRadius: theme.border.radiusPanel,
        background: theme.color.panelSolid,
        border: `${theme.border.chunk}px solid ${theme.color.honey}`,
        boxShadow: theme.border.shadowPanel,
        color: theme.color.text,
        fontFamily: theme.font.family,
        fontSize: theme.font.smallSize,
        lineHeight: theme.font.lineHeight,
        whiteSpace: 'pre-line',
        maxWidth: 320,
        pointerEvents: 'auto',
      }}
    >
      {facts.join('\n')}
    </div>
  );
}
