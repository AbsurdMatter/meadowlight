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

  return (
    <>
      <button
        onClick={() => setHintOpen((o) => !o)}
        data-shortcut-hint
        title="Keyboard shortcuts"
        aria-pressed={hintOpen}
        style={{
          position: 'absolute',
          top: 12,
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
          data-shortcut-hint-panel
          style={{
            position: 'absolute',
            top: 46,
            right: 12,
            width: 280,
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
          <div style={{ fontSize: theme.font.smallSize - 1, letterSpacing: 0.6, textTransform: 'uppercase', color: theme.color.textFaint, marginBottom: 6 }}>
            {SHORTCUT_HINT.title}
          </div>
          {SHORTCUT_HINT.lines.map((line) => (
            <div key={line} style={{ fontSize: theme.font.smallSize + 1, lineHeight: theme.font.lineHeight }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
