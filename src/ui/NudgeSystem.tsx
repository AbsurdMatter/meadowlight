import { useEffect, useRef } from 'react';
import { usePlacementStore } from '../render/placementStore';
import { scaledElapsed } from '../engine/scaledTime';
import { ONBOARDING_TUNING } from '../data/onboarding';
import { theme } from './theme';

/**
 * O1 (v4, #39): timed notebook nudges, in-fiction — the notebook
 * "notices" things; never a modal wall of text.
 *
 * TRIGGER-FIRST: each nudge fires on a REAL condition (elapsed world time,
 * a season crossing, an inspection) — never a fake timer alone. The nudge
 * writes the SAME state the player's own actions write (openNotebook — one
 * input path), so a nudge IS the notebook opening on a gentle note. Each
 * nudge fires once per world (nudgesShown, persisted v9 additive).
 *
 * The nudge renders ABOVE the palette dock (the session-8 anchor: the
 * dock's top edge), never overlapping the dock or the corner controls —
 * same geometry discipline as the onboarding hint.
 */

interface Nudge {
  id: string;
  /** minimum world-seconds before this nudge may fire */
  afterSeconds: number;
  /** the notebook entry the nudge opens (the same store write a click makes) */
  entry: { kind: 'meadow'; id: string };
  title: string;
  body: string;
}

const NUDGES: Nudge[] = [
  {
    id: 'welcome-meadow',
    afterSeconds: ONBOARDING_TUNING.nudges.firstAfterSeconds,
    entry: { kind: 'meadow', id: 'welcome' },
    title: 'Your meadow is already alive',
    body: 'A hive hums and the flowers are open — the bees found them on their own. Plant more from the palette below whenever you like.',
  },
  {
    id: 'meet-the-glass',
    afterSeconds: ONBOARDING_TUNING.nudges.firstAfterSeconds + ONBOARDING_TUNING.nudges.gapSeconds,
    entry: { kind: 'meadow', id: 'glass' },
    title: 'Try the magnifying glass',
    body: 'The glass in the corner zooms in on anything living — hover a flower or a bee with it armed for a close read.',
  },
  {
    id: 'watch-the-seasons',
    afterSeconds: ONBOARDING_TUNING.nudges.firstAfterSeconds + ONBOARDING_TUNING.nudges.gapSeconds * 2,
    entry: { kind: 'meadow', id: 'seasons' },
    title: 'The seasons turn on their own',
    body: 'Turn the dial in the corner to visit another season — what blooms changes, and the meadow remembers what you have seen.',
  },
];

export function NudgeSystem() {
  const markNudgeShown = usePlacementStore((s) => s.markNudgeShown);
  const openNotebook = usePlacementStore((s) => s.openNotebook);
  const onboardingDismissed = usePlacementStore((s) => s.onboardingDismissed);
  // display-only: which nudge is currently speaking (never persisted —
  // a nudge speaks once, the record is nudgesShown)
  const speaking = useRef<string | null>(null);
  const spokenAt = useRef(0);

  useEffect(() => {
    if (onboardingDismissed) return;
    const tick = () => {
      const s = usePlacementStore.getState();
      if (s.modalOpen || s.notebook) return; // never interrupt an open surface
      const t = scaledElapsed();
      for (const n of NUDGES) {
        if (s.nudgesShown.includes(n.id)) continue;
        if (t < n.afterSeconds) continue;
        // TRIGGER: the quiet has elapsed — the notebook notices. One input
        // path: the same openNotebook the player's own click writes.
        markNudgeShown(n.id);
        openNotebook(n.entry);
        speaking.current = n.id;
        spokenAt.current = t;
        s.save();
        return;
      }
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [onboardingDismissed, markNudgeShown, openNotebook]);

  // the speaking nudge renders as a gentle line above the dock (the
  // notebook card itself carries the content — this is only the herald)
  const active = NUDGES.find((n) => n.id === speaking.current);
  if (!active || onboardingDismissed) return null;
  return (
    <div
      data-onboarding-nudge={active.id}
      style={{
        // #6384003544 geometry: ABOVE the palette dock (bottom:120, the
        // dock's top edge zone), never overlapping the dock or corners
        position: 'absolute',
        bottom: 120,
        right: 16,
        maxWidth: 280,
        padding: '6px 12px',
        borderRadius: theme.border.radiusPanel,
        background: theme.color.panel,
        border: `${theme.border.chunk}px solid ${theme.color.sage}`,
        boxShadow: theme.border.shadowPanel,
        color: theme.color.textFaint,
        fontFamily: theme.font.family,
        fontSize: theme.font.smallSize,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      the notebook notices — {active.title.toLowerCase()}
    </div>
  );
}
