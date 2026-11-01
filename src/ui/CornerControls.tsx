import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AudioToggle } from './AudioToggle';
import { PostcardButton } from './PostcardButton';
import { NotebookHub } from './NotebookHub';
import { theme } from './theme';
import { usePlacementStore } from '../render/placementStore';
import { CHROME_TUNING } from '../data/chrome';

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

/** UI round 3 (#6383867199): ONE row, ONE control style — every corner
 *  button shares this style (equal height enforced by the row's
 *  align-items: stretch; glass, postcard, audio, help all in sequence).
 *  The armed (sage) styling is applied by the caller when armed.
 */
const controlButtonStyle = (armed: boolean): React.CSSProperties => ({
  height: 36,
  padding: '0 10px',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: theme.border.radius,
  border: `${theme.border.chunk}px solid ${armed ? theme.color.sage : theme.color.honey}`,
  background: armed ? theme.color.sageLight : theme.color.parchment,
  color: theme.color.text,
  fontFamily: theme.font.family,
  fontSize: 14,
  lineHeight: 1,
  cursor: 'pointer',
  boxShadow: theme.border.shadow,
});

export function CornerControls() {
  const [helpOpen, setHelpOpen] = useState(false);
  // O4 (v4, #42): at narrow frames the corner row WRAPS to two rows
  // (right-anchored) instead of running under the dock — the reserved lane
  // becomes the wrapped row's height, never an overlap
  const [wrapped, setWrapped] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < CHROME_TUNING.cornerWrapBelow : false,
  );
  useEffect(() => {
    const onResize = () => setWrapped(window.innerWidth < CHROME_TUNING.cornerWrapBelow);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // UI verdict (#6383659472): the magnifying glass lives HERE, beside the
  // journal and postcard — it is an inspect TOOL, not a placement item,
  // and grouping it with placeable things was the confusion
  const magnifierOn = usePlacementStore((s) => s.magnifierOn);
  const toggleMagnifier = usePlacementStore((s) => s.toggleMagnifier);
  return (
    <div
      data-corner-controls
      style={{
        position: 'absolute',
        bottom: 16,
        right: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        // O4: the wrapped row needs the viewport's width to wrap in
        maxWidth: wrapped ? 'calc(100vw - 24px)' : undefined,
      }}
    >
      {/* UI round 3 (#6383867199): ONE flex row, align-items stretch —
          every control the same height on the same baseline, equal gaps,
          glass in sequence between audio and postcard. No hand-positioned
          offsets; the armed sage styling stays on the glass. */}
      {/* #6384003544: ONE unwrapped row (flexWrap nowrap) — the journal
          button JOINED the row (it used to sit alone in the outer column,
          which read as a wrapped second line). All five controls share the
          36px baseline; the dock yields the space, the controls never
          yield alignment. */}
      <div
        data-corner-row
        style={{
          position: 'relative',
          display: 'flex',
          // O4: nowrap at wide frames (one row, the session-8 geometry);
          // wrap at narrow frames (right-anchored rows). The row's WIDTH
          // at narrow frames is the viewport minus insets, so five 36px
          // controls + gaps wrap to two rows instead of running off-screen
          // or under the dock.
          flexWrap: wrapped ? 'wrap' : 'nowrap',
          justifyContent: wrapped ? 'flex-end' : undefined,
          width: wrapped ? '100%' : undefined,
          gap: 8,
          alignItems: 'stretch',
        }}
      >
        <ControlsPopover open={helpOpen} onClose={() => setHelpOpen(false)} />
        <AudioToggle />
        <button
          onClick={toggleMagnifier}
          data-corner-tool="magnifier"
          title="Magnifying glass — hover a flower or a visitor for a close read"
          aria-pressed={magnifierOn}
          style={controlButtonStyle(magnifierOn)}
        >
          <span role="img" aria-label="magnifying glass">{'🔍'}</span>
        </button>
        <NotebookHub />
        <PostcardButton />
        <button
          onClick={() => setHelpOpen((o) => !o)}
          data-controls-help
          title="How to play"
          style={controlButtonStyle(false)}
        >
          ?
        </button>
      </div>
    </div>
  );
}

export type { ReactNode };
