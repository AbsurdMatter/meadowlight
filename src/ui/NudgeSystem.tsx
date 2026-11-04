import { useEffect, useRef } from 'react';
import { usePlacementStore } from '../render/placementStore';
import { useLocale } from '../engine/locale';
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

function nudgesFor(t: import('../data/i18n').UiCopy): Nudge[] {
  return [
    {
      id: 'welcome-meadow',
      afterSeconds: ONBOARDING_TUNING.nudges.firstAfterSeconds,
      entry: { kind: 'meadow', id: 'welcome' },
      title: t.nudgeAliveTitle,
      body: t.nudgeAliveBody,
    },
    {
      id: 'meet-the-glass',
      afterSeconds: ONBOARDING_TUNING.nudges.firstAfterSeconds + ONBOARDING_TUNING.nudges.gapSeconds,
      entry: { kind: 'meadow', id: 'glass' },
      title: t.nudgeGlassTitle,
      body: t.nudgeGlassBody,
    },
    {
      id: 'watch-the-seasons',
      afterSeconds: ONBOARDING_TUNING.nudges.firstAfterSeconds + ONBOARDING_TUNING.nudges.gapSeconds * 2,
      entry: { kind: 'meadow', id: 'seasons' },
      title: t.nudgeSeasonsTitle,
      body: t.nudgeSeasonsBody,
    },
  ];
}

export function NudgeSystem() {
  const t = useLocale((s) => s.t());
  const NUDGES = nudgesFor(t);
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
      // never interrupt an open surface — the guard covers EVERY open
      // surface, not just modal/notebook (#86: a nudge landing mid-sequence
      // opened the notebook card over the open hub; the card outranks the
      // hub in the ESC order and ate the hub's own Esc)
      if (
        s.modalOpen ||
        s.notebook ||
        s.hubOpen ||
        s.sharePanelOpen ||
        s.hintOpen ||
        s.hivePopup
      ) return;
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
