import { useEffect } from 'react';
import { usePlacementStore } from '../render/placementStore';
import { theme, headingStyle } from './theme';

const TOAST_MS = 7000;

function Toast({ id, title, body }: { id: number; title: string; body: string }) {
  const dismiss = usePlacementStore((s) => s.dismissToast);
  useEffect(() => {
    const t = setTimeout(() => dismiss(id), TOAST_MS);
    return () => clearTimeout(t);
  }, [id, dismiss]);
  return (
    <div
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
      style={{
        position: 'absolute',
        top: 64,
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
