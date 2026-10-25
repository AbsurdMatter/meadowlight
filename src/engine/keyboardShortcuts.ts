/**
 * O5 (v4, #43): the keyboard grammar — PURE input translation onto the
 * existing stores. No new clocks, no new state: keys drive the SAME
 * stores the pointer drives (I toggles magnifierOn — inheriting the
 * session-8 glass grammar including refusal semantics; J the hub open
 * state; ESC cancels anything open).
 *
 * The ESC semantics table lives in ONE place (ESC_SEMANTICS below) — every
 * openable surface is named there and ESC walks it in order.
 */
import type { Season } from '../data/seasons';

/** which movement keys are held (held-repeat drives the camera) */
export interface KeyState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
}

export function emptyKeyState(): KeyState {
  return { forward: false, back: false, left: false, right: false, rotateLeft: false, rotateRight: false };
}

/** is this key event one the shortcut layer consumes? (typing is never
 *  consumed — inputs, textareas, selects, contentEditable) */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
}

/** the movement/rotation keys and their key-state slots (held-repeat) */
const HELD_KEYS: Record<string, keyof KeyState> = {
  w: 'forward',
  W: 'forward',
  s: 'back',
  S: 'back',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
  q: 'rotateLeft',
  Q: 'rotateLeft',
  e: 'rotateRight',
  E: 'rotateRight',
};

/** translate a keydown/keyup into a key-state update. Pure. */
export function applyKey(
  state: KeyState,
  key: string,
  down: boolean,
): { state: KeyState; consumed: boolean } {
  const slot = HELD_KEYS[key];
  if (!slot) return { state, consumed: false };
  if (state[slot] === down) return { state, consumed: true };
  return { state: { ...state, [slot]: down }, consumed: true };
}

/** the single-fire toggle keys (never held-repeat) */
export type ToggleAction = 'inspector' | 'journal' | 'reset' | 'cancel';

export function toggleForKey(key: string): ToggleAction | null {
  if (key === 'i' || key === 'I') return 'inspector';
  if (key === 'j' || key === 'J') return 'journal';
  if (key === 'r' || key === 'R') return 'reset';
  if (key === 'Escape') return 'cancel';
  return null;
}

/**
 * THE ESC SEMANTICS TABLE — one place. ESC cancels, in this order, the
 * first surface that is open: the reset-confirm modal, the field-notebook
 * card, the journal hub, the hive popup, the armed glass (disarm — the
 * glass's own dismiss-then-disarm grammar applies on pointer; ESC is the
 * keyboard's single cancel). Returns the action to perform, or null when
 * nothing is open (ESC then does nothing — never a surprise).
 */
export interface EscSurfaces {
  modalOpen: boolean;
  notebookOpen: boolean;
  hubOpen: boolean;
  hivePopupOpen: boolean;
  glassArmed: boolean;
}

export type EscAction = 'close-modal' | 'close-notebook' | 'close-hub' | 'close-hive-popup' | 'disarm-glass';

export function escActionFor(s: EscSurfaces): EscAction | null {
  if (s.modalOpen) return 'close-modal';
  if (s.notebookOpen) return 'close-notebook';
  if (s.hubOpen) return 'close-hub';
  if (s.hivePopupOpen) return 'close-hive-popup';
  if (s.glassArmed) return 'disarm-glass';
  return null;
}

/** the "?" discoverability hint copy (composes with O1's nudge system) */
export const SHORTCUT_HINT = {
  title: 'Keyboard',
  lines: [
    'WASD — move the camera · Q E — turn the view',
    'R — start over (asks first) · I — magnifying glass · J — journal',
    'Esc — close whatever is open',
  ],
} as const;

/** unused-import guard for Season (the table is season-agnostic; the type
 *  is named here so future season-aware shortcuts have one home) */
export type { Season };
