import { Component, type ReactNode, useState } from 'react';
import { usePlacementStore } from '../render/placementStore';
import { theme, headingStyle } from './theme';
import { useLocale } from '../engine/locale';

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
  const t = useLocale((s) => s.t());
  const resetWorld = usePlacementStore((s) => s.resetWorld);
  const startFromSeedCode = usePlacementStore((s) => s.startFromSeedCode);
  const setModalOpen = usePlacementStore((s) => s.setModalOpen);
  // O5 (v4, #43): the confirm modal's open state is the store's modalOpen
  // — the R key opens the SAME modal (one input path); Esc dismisses it
  // through the ESC semantics table (engine/keyboardShortcuts).
  const open = usePlacementStore((s) => s.modalOpen);
  const [seedInput, setSeedInput] = useState('');
  const [seedError, setSeedError] = useState(false);
  const show = (v: boolean) => {
    setModalOpen(v);
    if (!v) { setSeedInput(''); setSeedError(false); }
  };
  const onReset = () => {
    resetWorld();
    show(false);
  };
  // P3 (v4 seed codes): "start from a friend's seed" lives ONLY inside this
  // confirmation modal — never a one-click destructive path. An
  // unknown/corrupt code changes nothing and says so gently (no fail
  // state); the current save is preserved to the backup slot either way.
  const onSeedStart = () => {
    if (startFromSeedCode(seedInput)) {
      show(false);
    } else {
      setSeedError(true);
    }
  };
  return (
    <>
      <button
        onClick={() => show(true)}
        data-reset-button
        style={{
          padding: '4px 12px',
          borderRadius: theme.border.radius,
          border: `${theme.border.chunk}px solid ${theme.color.honeyDark}`,
          background: theme.color.parchment,
          color: theme.color.clayText,
          fontFamily: theme.font.family,
          fontSize: theme.font.smallSize,
          cursor: 'pointer',
          boxShadow: theme.border.shadow,
        }}
        title={t.resetButtonTitle}
      >
        Reset meadow
      </button>
      {open && (
        <div
          style={{
            // fixed to the viewport, not the button's corner wrapper — the
            // backdrop must cover and center over the whole window
            position: 'fixed',
            inset: 0,
            background: theme.color.scrim,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            pointerEvents: 'auto',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) show(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              padding: theme.spacing.dialogPadding,
              borderRadius: theme.border.radiusPanel,
              background: theme.color.panelSolid,
              border: `${theme.border.chunky}px solid ${theme.color.honey}`,
              boxShadow: theme.border.shadowPanel,
              color: theme.color.text,
              fontFamily: theme.font.family,
              maxWidth: 380,
            }}
          >
            <strong style={headingStyle(theme.font.titleSize)}>{t.resetDialogTitle}</strong>
            <p style={{ fontSize: theme.font.bodySize, lineHeight: theme.font.lineHeight, margin: '10px 0 18px' }}>
              {t.resetDialogBody}
            </p>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: theme.font.smallSize, marginBottom: 6, opacity: 0.85 }}>
                {t.resetOrSeedHeading}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  data-seed-input
                  value={seedInput}
                  onChange={(e) => { setSeedInput(e.target.value); setSeedError(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') onSeedStart(); }}
                  placeholder={t.resetSeedPlaceholder}
                  aria-label={t.resetOrSeedHeading}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: theme.border.radius,
                    border: `${theme.border.chunk}px solid ${seedError ? theme.color.clayDark : theme.color.honeyDark}`,
                    background: theme.color.parchment,
                    color: theme.color.text,
                    fontFamily: theme.font.family,
                    fontSize: theme.font.smallSize,
                  }}
                />
                <button
                  onClick={onSeedStart}
                  data-seed-start-button
                  style={{
                    padding: '6px 16px',
                    borderRadius: theme.border.radius,
                    border: `${theme.border.chunk}px solid ${theme.color.honeyDark}`,
                    background: theme.color.parchment,
                    color: theme.color.text,
                    fontFamily: theme.font.family,
                    cursor: 'pointer',
                    boxShadow: theme.border.shadow,
                  }}
                >
                  {t.resetSeedStart}
                </button>
              </div>
              {seedError && (
                <div style={{ fontSize: theme.font.smallSize, color: theme.color.clayDark, marginTop: 6 }}>
                  {t.resetSeedError}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => show(false)}
                style={{
                  padding: '6px 16px',
                  borderRadius: theme.border.radius,
                  border: `${theme.border.chunk}px solid ${theme.color.honeyDark}`,
                  background: theme.color.parchment,
                  color: theme.color.text,
                  fontFamily: theme.font.family,
                  cursor: 'pointer',
                  boxShadow: theme.border.shadow,
                }}
              >
                {t.resetCancel}
              </button>
              <button
                onClick={onReset}
                style={{
                  padding: '6px 16px',
                  borderRadius: theme.border.radius,
                  border: `${theme.border.chunk}px solid ${theme.color.clayDark}`,
                  background: theme.color.clay,
                  color: '#fff6ec',
                  fontFamily: theme.font.family,
                  cursor: 'pointer',
                  boxShadow: theme.border.shadow,
                }}
              >
                {t.resetConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Reset button + confirmation dialog, wrapped in an error boundary so a bug
 * here can never blank the app (dev-UI hygiene). */
export function ResetDialog() {
  return (
    <DialogBoundary>
      <ResetDialogInner />
    </DialogBoundary>
  );
}
