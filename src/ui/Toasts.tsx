import { useEffect, useState } from 'react';
import { usePlacementStore } from '../render/placementStore';
import { theme, headingStyle } from './theme';
import { CHROME_TUNING } from '../data/chrome';
import { useLocale } from '../engine/locale';

const TOAST_MS = 7000;

function Toast({ id, title, body }: { id: number; title: string; body: string }) {
  const t = useLocale((s) => s.t());
  const dismiss = usePlacementStore((s) => s.dismissToast);
  useEffect(() => {
    const t = setTimeout(() => dismiss(id), TOAST_MS);
    return () => clearTimeout(t);
  }, [id, dismiss]);
  return (
    <div
      data-toast
      style={{
        padding: theme.spacing.panelPadding,
        borderRadius: theme.border.radiusPanel,
        background: theme.color.panel,
        border: `${theme.border.chunk}px solid ${theme.color.honey}`,
        boxShadow: theme.border.shadowPanel,
        color: theme.color.text,
        fontFamily: theme.font.family,
        maxWidth: 300,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ ...headingStyle(theme.font.bodySize), marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: theme.font.smallSize, lineHeight: 1.4 }}>{body}</div>
      <button
        onClick={() => dismiss(id)}
        style={{
          marginTop: 6,
          padding: '2px 10px',
          borderRadius: theme.border.radius,
          border: `${theme.border.chunk}px solid ${theme.color.honeyDark}`,
          background: theme.color.parchment,
          color: theme.color.text,
          fontFamily: theme.font.family,
          fontSize: theme.font.smallSize,
          cursor: 'pointer',
        }}
      >
        {t.toastLovely}
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = usePlacementStore((s) => s.toasts);
  // #76 (class fix): the stack container's height derives from LIVE-MEASURED
  // geometry — the lane from toastLaneTop down to the corner row's live top
  // minus the gap, re-measured whenever the corner box moves (ResizeObserver)
  // or the viewport resizes. The old cap (shareLaneTop - toastLaneTop - gap
  // = a constant 96px claim) with overflow:hidden CLIPPED any card taller
  // than the claim — the jar-of-honey (hive collect) and season popups lost
  // their button / bottom border exactly when content exceeded the fixed
  // number. Content now sizes the stack; only a live lane shorter than the
  // content clips (the hard floor at the corner row).
  const [laneCap, setLaneCap] = useState<number | null>(null);
  useEffect(() => {
    const cornerEl = () =>
      document.querySelector('[data-corner-controls]') ?? document.querySelector('[data-corner-row]');
    const measure = () => {
      const corner = cornerEl();
      const floorTop = corner ? corner.getBoundingClientRect().top : window.innerHeight;
      setLaneCap(Math.max(0, floorTop - CHROME_TUNING.shareLaneGap - CHROME_TUNING.toastLaneTop));
    };
    measure();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      const corner = cornerEl();
      if (corner) {
        ro = new ResizeObserver(measure);
        ro.observe(corner);
      }
    }
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, []);
  return (
    <div
      data-toast-stack
      style={{
        position: 'absolute',
        // round-1 finding 2: the toast lane sits BELOW the help button
        // (which owns the lane above it) — measured clear of the help
        // button's bottom (130) + gap; the lane's ORDER is unchanged.
        // round-2 finding 4 rework: the stack is a COLUMN anchored at the
        // BOTTOM of its lane (cards grow UPWARD from the corner-row side),
        // so a growing stack never runs down into the help panel's lane —
        // the panel's ceiling is the lane's top, not each card's bottom.
        // #59 + #76: the stack is capped at its lane's height so it never
        // grows down into the corner row — but the cap is now the LIVE
        // measured lane (see the ResizeObserver above), not the fixed
        // shareLaneTop constant. overflow:hidden remains only as the
        // hard-floor guard: it clips solely when the live lane is shorter
        // than the content, never because a constant claimed 96px.
        top: CHROME_TUNING.toastLaneTop,
        maxHeight: laneCap === null ? undefined : laneCap,
        overflow: 'hidden',
        right: 12,
        display: 'flex',
        flexDirection: 'column-reverse',
        justifyContent: 'flex-end',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <Toast key={t.id} {...t} />
      ))}
    </div>
  );
}
