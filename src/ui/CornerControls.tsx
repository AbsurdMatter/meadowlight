import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AudioToggle } from './AudioToggle';
import { PostcardButton } from './PostcardButton';
import { NotebookHub } from './NotebookHub';

/**
 * One shared bottom-right container: Sound, Postcard, the notebook hub, and
 * a "?" button that reveals the controls text on demand (the always-on
 * header hint is retired). Plain DOM UI with pointer events only on itself —
 * the canvas never loses a click to this corner (one-input-path rule).
 */

const CONTROLS_TEXT = `left-click — place the selected flower / structure
right-click — deselect first; with no tool, remove
R — rotate \u00b7 F — natural placement on/off
right-drag — orbit \u00b7 left-drag — zoom \u00b7 middle-drag — pan`;

function ControlsPopover({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      data-controls-popover
      style={{
        position: 'absolute',
        bottom: '100%',
        right: 0,
        marginBottom: 8,
        padding: '10px 14px',
        borderRadius: 12,
        background: 'rgba(255, 244, 220, 0.96)',
        boxShadow: '0 4px 16px rgba(122, 90, 43, 0.22)',
        color: '#5a4322',
        fontSize: 13,
        lineHeight: 1.7,
        whiteSpace: 'pre-line',
        fontFamily: 'inherit',
        maxWidth: 320,
      }}
    >
      {CONTROLS_TEXT}
    </div>
  );
}

export function CornerControls() {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        right: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
      }}
    >
      <div style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'center' }}>
        <ControlsPopover open={helpOpen} onClose={() => setHelpOpen(false)} />
        <AudioToggle />
        <PostcardButton />
        <button
          onClick={() => setHelpOpen((o) => !o)}
          data-controls-help
          title="How to play"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: '2px solid #d9b36a',
            background: '#fff4dc',
            color: '#5a4322',
            fontFamily: 'inherit',
            fontSize: 16,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(122, 90, 43, 0.15)',
          }}
        >
          ?
        </button>
      </div>
      <NotebookHub />
    </div>
  );
}

export type { ReactNode };
