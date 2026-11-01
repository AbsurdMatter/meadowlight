import { useEffect, useState, type CSSProperties } from 'react';
import { usePlacementStore } from '../render/placementStore';
import { beeDebug } from '../render/BeeSwarm';
import { solitaryBeeDebug, rareBeeDebug } from '../render/SolitaryBees';
import { theme, headingStyle } from './theme';
import { useLocale } from '../engine/locale';

/**
 * #18 postcard stats strip: gentle nature facts, never scores.
 *
 * Organized as one fact per line (PR review: not a wall of text) — each line
 * has a bold label (nature planted / bee care put up / bees about /
 * seasons passed) and a warm value. Reads the LIVE store (the same data
 * the placement/bee systems use); the same four facts also appear on the
 * composed postcard image (composePostcard).
 * Styled from the theme module only.
 */
interface StatLine {
  key: string;
  label: string;
  value: string;
}

function statLines(t: import('../data/i18n').UiCopy): StatLine[] {
  const s = usePlacementStore.getState();
  const bees = beeDebug.count + solitaryBeeDebug.count + rareBeeDebug.count;
  return [
    {
      key: 'nature',
      label: t.statNaturePlanted,
      value:
        s.items.length === 1
          ? 'one flower — every meadow starts here'
          : `${s.items.length} flowers`,
    },
    {
      key: 'beecare',
      label: t.statBeeCarePutUp,
      value:
        s.structures.length === 0
          ? 'none yet — the meadow manages on its own'
          : `${s.structures.length} piece${s.structures.length === 1 ? '' : 's'}`,
    },
    {
      key: 'bees',
      label: t.statBeesAbout,
      value: bees === 0 ? 'quiet skies — bees come with blooms' : `${bees}`,
    },
    {
      key: 'seasons',
      label: t.statSeasonsPassed,
      value: (s.wildSeasons?.length ?? 0) === 0 ? 'the dial has not turned yet' : `${s.wildSeasons.length}`,
    },
    {
      key: 'honey',
      label: t.statJarsOfHoney,
      value:
        (s.honeyJars ?? 0) === 0
          ? 'the comb is still filling'
          : `${s.honeyJars}`,
    },
  ];
}

const labelStyle: CSSProperties = {
  ...headingStyle(theme.font.smallSize),
  color: theme.color.textSoft,
  marginRight: 6,
};

export function PostcardStats() {
  const t = useLocale((s) => s.t());
  const [lines, setLines] = useState<StatLine[]>(() => statLines(t));
  useEffect(() => {
    const timer = setInterval(() => setLines(statLines(t)), 800);
    return () => clearInterval(timer);
  }, [t]);
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
        maxWidth: 320,
        pointerEvents: 'auto',
      }}
    >
      {lines.map((l, i) => (
        <div
          key={l.key}
          data-postcard-stat-line={l.key}
          style={{ display: 'flex', gap: 6, marginTop: i === 0 ? 0 : 4 }}
        >
          <span style={labelStyle}>{l.label} —</span>
          <span>{l.value}</span>
        </div>
      ))}
    </div>
  );
}

/** The same four facts, for the composed postcard image (canvas 2D). */
export function postcardStatText(): StatLine[] {
  const t = useLocale((s) => s.t());
  return statLines(t);
}
