import { useEffect } from 'react';
import { usePlacementStore } from '../render/placementStore';
import { theme, headingStyle } from './theme';
import { CHROME_TUNING } from '../data/chrome';

const TOAST_MS = 7000;

function Toast({ id, title, body }: { id: number; title: string; body: string }) {
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
        lovely
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = usePlacementStore((s) => s.toasts);
  return (
    <div
      data-toast-stack
      style={{
        position: 'absolute',
        // round-1 finding 2: the toast lane sits BELOW the help button
        // (which owns the lane above it) — measured clear of the help
        // button's bottom (130) + gap; the lane's ORDER is unchanged
        top: CHROME_TUNING.toastLaneTop,
        right: 12,
        display: 'flex',
        flexDirection: 'column',
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
