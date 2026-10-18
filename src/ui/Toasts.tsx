import { useEffect } from 'react';
import { usePlacementStore } from '../render/placementStore';

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
        padding: '10px 16px',
        borderRadius: 14,
        background: 'rgba(255, 244, 220, 0.95)',
        boxShadow: '0 4px 16px rgba(122, 90, 43, 0.22)',
        color: '#5a4322',
        fontFamily: 'inherit',
        maxWidth: 300,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.4 }}>{body}</div>
      <button
        onClick={() => dismiss(id)}
        style={{
          marginTop: 6,
          padding: '2px 10px',
          borderRadius: 8,
          border: '1px solid #b0a58c',
          background: '#f0ead9',
          color: '#5a4322',
          fontFamily: 'inherit',
          fontSize: 12,
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
