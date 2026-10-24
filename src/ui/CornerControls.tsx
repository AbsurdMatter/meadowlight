import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AudioToggle } from './AudioToggle';
import { PostcardButton } from './PostcardButton';
import { NotebookHub } from './NotebookHub';
import { theme } from './theme';
import { usePlacementStore } from '../render/placementStore';

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
        borderRadius: theme.border.radiusPanel,
        background: theme.color.panelSolid,
        border: `${theme.border.chunk}px solid ${theme.color.honey}`,
        boxShadow: theme.border.shadowPanel,
        color: theme.color.text,
        fontSize: theme.font.smallSize,
        lineHeight: 1.7,
        whiteSpace: 'pre-line',
        fontFamily: theme.font.family,
        maxWidth: 320,
      }}
    >
      {CONTROLS_TEXT}
    </div>
  );
}

export function CornerControls() {
  const [helpOpen, setHelpOpen] = useState(false);
  // UI verdict (#6383659472): the magnifying glass lives HERE, beside the
  // journal and postcard — it is an inspect TOOL, not a placement item,
  // and grouping it with placeable things was the confusion
  const magnifierOn = usePlacementStore((s) => s.magnifierOn);
  const toggleMagnifier = usePlacementStore((s) => s.toggleMagnifier);
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
        <button
          onClick={toggleMagnifier}
          data-corner-tool="magnifier"
          title="Magnifying glass — hover a flower or a visitor for a close read"
          aria-pressed={magnifierOn}
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.border.radius,
            border: `${theme.border.chunk}px solid ${magnifierOn ? theme.color.sage : theme.color.honey}`,
            background: magnifierOn ? theme.color.sageLight : theme.color.parchment,
            color: theme.color.text,
            fontFamily: theme.font.family,
            fontSize: 16,
            cursor: 'pointer',
            boxShadow: theme.border.shadow,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span role="img" aria-label="magnifying glass">{'🔍'}</span>
        </button>
        <PostcardButton />
        <button
          onClick={() => setHelpOpen((o) => !o)}
          data-controls-help
          title="How to play"
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.border.radius,
            border: `${theme.border.chunk}px solid ${theme.color.honey}`,
            background: theme.color.parchment,
            color: theme.color.text,
            fontFamily: theme.font.family,
            fontSize: 16,
            cursor: 'pointer',
            boxShadow: theme.border.shadow,
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
