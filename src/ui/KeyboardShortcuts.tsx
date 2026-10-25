import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { usePlacementStore } from '../render/placementStore';
import { scaledDelta } from '../engine/scaledTime';
import { CAMERA_BOUNDS } from '../data/environment';
import {
  emptyKeyState,
  applyKey,
  toggleForKey,
  escActionFor,
  isTypingTarget,
  SHORTCUT_HINT,
  type KeyState,
} from '../engine/keyboardShortcuts';
import { theme } from './theme';
import { CHROME_TUNING } from '../data/chrome';

/**
 * O5 (v4, #43): the keyboard grammar — PURE input translation onto the
 * existing stores. No new clocks, no new state: keys drive the SAME stores
 * the pointer drives.
 *
 *   WASD — move the camera (held-repeat)   Q E — turn the view (held)
 *   R — start over (opens the inline confirm modal, NEVER instant;
 *       Esc dismisses)                       I — the magnifying glass
 *   J — the field notebook (journal hub)    Esc — cancel-anything
 *
 * Conventions honored here:
 *  - I toggles magnifierOn (the glass's own toggle — the session-8 glass
 *    grammar, including refusal semantics, is inherited untouched).
 *  - J toggles the hub's open state. The hub's open state lives in the
 *    store (hubOpen) so the key and the pointer button write ONE source;
 *    aria-pressed on the hub button syncs both ways (it reads the store).
 *  - keys are ignored while typing (inputs/textareas/contentEditable).
 *  - held-repeat for movement vs single-fire toggles.
 *  - preventDefault on consumed keys.
 *  - the ESC semantics table lives in engine/keyboardShortcuts (ONE place).
 *
 * Camera movement drives the SAME spherical the OrbitControlsLite pointer
 * path drives — one camera source, two input translations, never two
 * cameras. The spherical lives on a shared ref the OrbitControlsLite
 * publishes (window-level module state, set once at mount). This component
 * is DOM-only (the "?" hint + the key handlers); the camera translation
 * reads the published spherical inside Canvas (see SceneKeyboard in
 * App.tsx) so R3F hooks stay inside the Canvas (the session-8 split).
 */

/** the shared camera spherical — published by OrbitControlsLite (inside
 *  Canvas), consumed by the keyboard translation (inside Canvas too). */
export const cameraSpherical: { current: THREE.Spherical | null } = { current: null };

const MOVE_SPEED = 6; // units per second (scaled time)
const TURN_SPEED = 1.6; // radians per second (scaled time)

/** the held-key camera translation — lives INSIDE the Canvas (it reads the
 *  shared spherical and the scaled clock; R3F hooks only inside). It reads
 *  the key state the DOM-side handlers publish on window (one shared ref). */
export function SceneKeyboard() {
  useEffect(() => {
    let raf = 0;
    const move = () => {
      const keys = (window as unknown as { __meadowKeys?: { current: KeyState } }).__meadowKeys;
      const k = keys?.current;
      if (!k) return;
      const sph = cameraSpherical.current;
      if (sph && (k.forward || k.back || k.left || k.right || k.rotateLeft || k.rotateRight)) {
        const dt = Math.min(0.1, scaledDelta());
        if (dt > 0) {
          if (k.forward) sph.radius = THREE.MathUtils.clamp(sph.radius - MOVE_SPEED * dt, CAMERA_BOUNDS.minDistance, CAMERA_BOUNDS.maxDistance);
          if (k.back) sph.radius = THREE.MathUtils.clamp(sph.radius + MOVE_SPEED * dt, CAMERA_BOUNDS.minDistance, CAMERA_BOUNDS.maxDistance);
          if (k.left) sph.theta += TURN_SPEED * dt;
          if (k.right) sph.theta -= TURN_SPEED * dt;
          if (k.rotateLeft) sph.phi = THREE.MathUtils.clamp(sph.phi - TURN_SPEED * dt, CAMERA_BOUNDS.minPolarAngle, CAMERA_BOUNDS.maxPolarAngle);
          if (k.rotateRight) sph.phi = THREE.MathUtils.clamp(sph.phi + TURN_SPEED * dt, CAMERA_BOUNDS.minPolarAngle, CAMERA_BOUNDS.maxPolarAngle);
          sph.makeSafe();
        }
      }
      raf = requestAnimationFrame(move);
    };
    raf = requestAnimationFrame(move);
    return () => cancelAnimationFrame(raf);
  }, []);
  return null;
}

/** the DOM-side key handlers + the "?" hint — OUTSIDE the Canvas (the
 *  resolver-inside-Canvas / card-outside split, session-8 lesson 8). */
export function KeyboardShortcuts() {
  const keys = useRef<KeyState>(emptyKeyState());
  const [hintOpen, setHintOpen] = useState(false);

  useEffect(() => {
    // share the key state with the in-Canvas translation (one ref, two
    // halves — the DOM side writes, the Canvas side reads per frame)
    (window as unknown as { __meadowKeys?: typeof keys }).__meadowKeys = keys;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      const s = usePlacementStore.getState();
      // held movement keys
      const held = applyKey(keys.current, e.key, true);
      if (held.consumed) {
        e.preventDefault();
        keys.current = held.state;
        return;
      }
      // single-fire toggles
      const action = toggleForKey(e.key);
      if (!action) {
        if (e.key === '?') setHintOpen((o) => !o);
        return;
      }
      e.preventDefault();
      if (action === 'inspector') {
        // I toggles the glass — the SAME store the pointer button writes
        s.toggleMagnifier();
        return;
      }
      if (action === 'journal') {
        // J toggles the hub — one store, pointer and key agree
        usePlacementStore.setState({ hubOpen: !s.hubOpen });
        return;
      }
      if (action === 'reset') {
        // R opens the inline confirm modal — NEVER instant
        s.setModalOpen(true);
        return;
      }
      if (action === 'cancel') {
        // ESC cancel-anything — the semantics table, one place
        const esc = escActionFor({
          modalOpen: s.modalOpen,
          notebookOpen: s.notebook !== null,
          hubOpen: s.hubOpen,
          hivePopupOpen: s.hivePopup !== null,
          glassArmed: s.magnifierOn,
        });
        if (esc === 'close-modal') s.setModalOpen(false);
        else if (esc === 'close-notebook') s.closeNotebook();
        else if (esc === 'close-hub') usePlacementStore.setState({ hubOpen: false });
        else if (esc === 'close-hive-popup') s.closeHivePopup();
        else if (esc === 'disarm-glass') usePlacementStore.setState({ magnifierOn: false, magnifierEntry: null });
        return;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      const released = applyKey(keys.current, e.key, false);
      if (released.consumed) {
        e.preventDefault();
        keys.current = released.state;
      }
    };
    // (the held-key camera translation lives in SceneKeyboard, inside the
    // Canvas — it reads this same key ref per frame on the scaled clock)
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Round-1 finding 2: the hint panel MEASURES its placement instead of
  // assuming it — below the live toast cards, clear of the dock and the
  // corner row, inside the viewport. It re-measures whenever the toast
  // stack changes (cards are ephemeral and arrive after the panel opens),
  // so a growing stack can never collide with it.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelTop, setPanelTop] = useState<number | null>(null);
  const [panelMaxWidth, setPanelMaxWidth] = useState<number | null>(null);
  const [panelMaxHeight, setPanelMaxHeight] = useState<number | null>(null);
  const toastCount = usePlacementStore((s) => s.toasts.length);
  // closed: drop the measured placement so a reopen re-measures fresh
  useEffect(() => {
    if (!hintOpen) {
      setPanelTop(null);
      setPanelMaxWidth(null);
      setPanelMaxHeight(null);
    }
  }, [hintOpen]);
  useEffect(() => {
    if (!hintOpen) return;
    const place = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const panelRight = window.innerWidth - 12;
      // horizontal: shrink until the left edge clears the dock's right
      // edge (narrow frames: the dock is left-anchored, the panel
      // right-anchored). Computed from the UNSHRUNK layout (the CSS width
      // excludes padding 2x16 + border 2x2 = 36px) so the value is stable
      // across re-measures.
      const dock = document.querySelector('[data-palette-dock]');
      const dockRight = dock ? dock.getBoundingClientRect().right : 0;
      const naturalLeft = panelRight - (CHROME_TUNING.helpPanelWidth + 36);
      const cssMaxWidth = naturalLeft < dockRight + 8 ? panelRight - dockRight - 8 - 36 : null;
      if (cssMaxWidth !== panelMaxWidth) {
        setPanelMaxWidth(cssMaxWidth);
        return; // re-measure after the width applies (it changes the height)
      }
      // vertical: below the lowest live toast card, never below the lane's
      // floor (the corner row's top minus a gap, or the viewport bottom).
      // The panel's chrome is 36px of padding+border on top of the CSS
      // height (content-box), so a clamp leaves room for that chrome plus
      // a sliver of content; when even that can't fit, the top yields back
      // toward minTop rather than starting a panel the floor would cut.
      const cards = [...document.querySelectorAll('[data-toast]')];
      const cardsBottom = cards.reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), 0);
      const minTop = CHROME_TUNING.helpLaneTop + 28 + 6;
      const cornerRow = document.querySelector('[data-corner-row]');
      const floorY = (cornerRow ? cornerRow.getBoundingClientRect().top : window.innerHeight) - 8;
      const top = Math.min(
        Math.max(minTop, cardsBottom > 0 ? cardsBottom + 6 : minTop),
        Math.max(minTop, floorY - 84),
      );
      const naturalHeight = panel.scrollHeight + 4; // scrollHeight excludes the border
      const cssMaxHeight = top + naturalHeight > floorY ? Math.max(0, floorY - top - 36) : null;
      if (top !== panelTop || cssMaxHeight !== panelMaxHeight) {
        setPanelTop(top);
        setPanelMaxHeight(cssMaxHeight);
      }
    };
    // measure after paint, on every toast-stack change, and on resize
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
    };
  }, [hintOpen, toastCount, panelMaxWidth, panelMaxHeight, panelTop]);

  return (
    <>
      {/* Round-1 finding 2: this button used to sit at top:12 — ON the
          season dial. It now owns the lane below the time controls
          (CHROME_TUNING.helpLaneTop), measured clear of the dial (bottom
          62 at 700-900 wide, 48 at 360-480) and the time row (bottom 94).
          The hint panel measures its own placement (below the toast
          stack, clear of the dock) instead of assuming it. */}
      <button
        onClick={() => setHintOpen((o) => !o)}
        data-shortcut-hint
        title="Keyboard shortcuts"
        aria-pressed={hintOpen}
        style={{
          position: 'absolute',
          top: CHROME_TUNING.helpLaneTop,
          right: 12,
          height: 28,
          padding: '0 10px',
          borderRadius: theme.border.radius,
          border: `${theme.border.chunk}px solid ${theme.color.honey}`,
          background: theme.color.parchment,
          color: theme.color.text,
          fontFamily: theme.font.family,
          fontSize: theme.font.smallSize,
          cursor: 'pointer',
          boxShadow: theme.border.shadow,
          zIndex: 6,
        }}
      >
        ?
      </button>
      {hintOpen && (
        <div
          ref={panelRef}
          data-shortcut-hint-panel
          style={{
            position: 'absolute',
            top: panelTop ?? CHROME_TUNING.helpLaneTop + 28 + 6,
            right: 12,
            width: CHROME_TUNING.helpPanelWidth,
            maxWidth: panelMaxWidth ?? undefined,
            maxHeight: panelMaxHeight ?? undefined,
            overflowY: panelMaxHeight !== null ? 'auto' : undefined,
            padding: theme.spacing.panelPadding,
            borderRadius: theme.border.radiusPanel,
            background: theme.color.panel,
            border: `${theme.border.chunk}px solid ${theme.color.honey}`,
            boxShadow: theme.border.shadowPanel,
            color: theme.color.text,
            fontFamily: theme.font.family,
            zIndex: 6,
          }}
        >
          <div style={{ fontSize: theme.font.smallSize - 1, letterSpacing: 0.6, textTransform: 'uppercase', color: theme.color.textFaint, marginBottom: 8 }}>
            {SHORTCUT_HINT.title}
          </div>
          {/* Round-1 finding 4: the content is a GROUPED LIST, not one
              joined block — groups by area (Camera / Tools / Cancel), one
              key + action pair per row. The key column is fixed-width so
              the actions align; the layout is measured (the panel's own
              placement was finding 2), not assumed. */}
          {SHORTCUT_HINT.groups.map((group, gi) => (
            <div key={group.heading} data-shortcut-group={group.heading} style={{ marginBottom: gi < SHORTCUT_HINT.groups.length - 1 ? 10 : 0 }}>
              <div style={{ fontSize: theme.font.smallSize - 1, letterSpacing: 0.6, textTransform: 'uppercase', color: theme.color.textFaint, marginBottom: 3 }}>
                {group.heading}
              </div>
              {group.rows.map((row) => (
                <div
                  key={row.key}
                  data-shortcut-row
                  style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: theme.font.smallSize + 1, lineHeight: theme.font.lineHeight }}
                >
                  <span
                    data-shortcut-key
                    style={{
                      flex: '0 0 64px',
                      fontWeight: 600,
                      color: theme.color.text,
                      background: theme.color.parchment,
                      border: `${theme.border.chunk}px solid ${theme.color.honeyDark}`,
                      borderRadius: theme.border.radius,
                      padding: '0 6px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.key}
                  </span>
                  <span data-shortcut-action style={{ color: theme.color.textSoft }}>
                    {row.action}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
