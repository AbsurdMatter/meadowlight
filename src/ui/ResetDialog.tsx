import { Component, useState, type ReactNode } from 'react';
import { usePlacementStore } from '../render/placementStore';

class DialogBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[reset] dialog crashed and was contained:', error);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function ResetDialogInner() {
  const resetWorld = usePlacementStore((s) => s.resetWorld);
  const [open, setOpen] = useState(false);
  const onReset = () => {
    resetWorld();
    setOpen(false);
  };
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '4px 12px',
          borderRadius: 10,
          border: '2px solid #b0a58c',
          background: '#f0ead9',
          color: '#8a4a3a',
          fontFamily: 'inherit',
          fontSize: 12,
          cursor: 'pointer',
        }}
        title="Start the meadow over"
      >
        Reset meadow
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(74, 53, 34, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            pointerEvents: 'auto',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              padding: '20px 24px',
              borderRadius: 16,
              background: 'rgba(255, 250, 235, 0.98)',
              boxShadow: '0 8px 32px rgba(122, 90, 43, 0.35)',
              color: '#5a4322',
              fontFamily: 'inherit',
              maxWidth: 380,
            }}
          >
            <strong style={{ fontSize: 16 }}>Reset your meadow?</strong>
            <p style={{ fontSize: 14, lineHeight: 1.5, margin: '10px 0 18px' }}>
              All placed flowers, structures, progress and milestones will be deleted.
              This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 10,
                  border: '2px solid #b0a58c',
                  background: '#f0ead9',
                  color: '#5a4322',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={onReset}
                style={{
                  padding: '6px 16px',
                  borderRadius: 10,
                  border: '2px solid #a04a3a',
                  background: '#c9584a',
                  color: '#fff6ec',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Reset button + confirmation dialog, wrapped in an error boundary so a bug
 *  here can never blank the app (dev-UI hygiene). */
export function ResetDialog() {
  return (
    <DialogBoundary>
      <ResetDialogInner />
    </DialogBoundary>
  );
}
