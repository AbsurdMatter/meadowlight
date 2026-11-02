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
  type KeyState,
} from '../engine/keyboardShortcuts';
import { theme, headingStyle } from './theme';
import { CHROME_TUNING } from '../data/chrome';
import { useLocale } from '../engine/locale';
import { isPaused, setPaused } from '../engine/timeControl';

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
function hintGroups(t: import('../data/i18n').UiCopy): { heading: string; rows: { key: string; action: string }[] }[] {
  return [
    { heading: t.shortcutsGroupCamera, rows: [
      { key: 'W A S D', action: t.shortcutsMoveCamera },
      { key: 'Q E', action: t.shortcutsTurnView },
    ] },
    { heading: t.shortcutsGroupTools, rows: [
      { key: 'I', action: t.shortcutsGlass },
      { key: 'J', action: t.shortcutsJournal },
      { key: 'R', action: t.shortcutsStartOver },
    ] },
    { heading: t.shortcutsGroupCancel, rows: [
      { key: 'Esc', action: t.shortcutsCloseOpen },
      { key: 'Space', action: t.shortcutsPause },
    ] },
  ];
}

export function KeyboardShortcuts() {
  const t = useLocale((s) => s.t());
  const keys = useRef<KeyState>(emptyKeyState());
  const hintOpen = usePlacementStore((s) => s.hintOpen);
  const setHintOpen = usePlacementStore((s) => s.setHintOpen);
  const hintOpenRef = useRef(false);
  useEffect(() => { hintOpenRef.current = hintOpen; }, [hintOpen]);

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
        if (e.key === '?') { const h = usePlacementStore.getState().hintOpen; usePlacementStore.getState().setHintOpen(!h); }
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
      if (action === 'pause') {
        // #71: Space toggles pause through the SAME timeControl the pause
        // button uses — one input path, one store, no button-first focus
        // requirement (the old gap: Space was never bound, so only the
        // mouse-clicked button path worked)
        setPaused(!isPaused());
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
          sharePanelOpen: s.sharePanelOpen,
          hintPanelOpen: hintOpenRef.current,
        });
        if (esc === 'close-modal') s.setModalOpen(false);
        else if (esc === 'close-notebook') s.closeNotebook();
        else if (esc === 'close-hub') usePlacementStore.setState({ hubOpen: false });
        else if (esc === 'close-hive-popup') s.closeHivePopup();
        else if (esc === 'disarm-glass') usePlacementStore.setState({ magnifierOn: false, magnifierEntry: null });
        else if (esc === 'close-share-panel') s.setSharePanelOpen(false);
        else if (esc === 'close-hint-panel') setHintOpen(false);
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
  // round 7: the panel's horizontal chrome (padding+border) in border-box px,
  // mirrored from the solver's live measurement so the style's maxWidth
  // (border-box) and the solver's content-box maxWidth share one conversion
  const chromeXRef = useRef(36);
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
      // edge. Two cases, both live-measured:
      //   wide frames: the dock is bottom-anchored and does NOT reach the
      //     help lane at all — no horizontal constraint (the old code
      //     compared against the dock's right edge unconditionally, which
      //     shrank the panel to 164px at 360 wide because the narrow dock
      //     spans nearly the full width at the BOTTOM while the panel lives
      //     at the TOP — different lanes, no real conflict).
      //   genuinely narrow+short frames where the dock's box could reach
      //     the panel's vertical band: shrink so the panel's left edge
      //     clears the dock's right edge + gap.
      // border-box (round 7): width includes the panel's padding+border.
      const panelCs = getComputedStyle(panel);
      const chromeX = (parseFloat(panelCs.paddingLeft) || 0) +
        (parseFloat(panelCs.paddingRight) || 0) +
        (parseFloat(panelCs.borderLeftWidth) || 0) +
        (parseFloat(panelCs.borderRightWidth) || 0);
      const dock = document.querySelector('[data-palette-dock]');
      const dockBox = dock ? dock.getBoundingClientRect() : null;
      // does the dock's box HORIZONTALLY overlap the panel's natural box?
      // That is the only conflict that exists — the panel is top-right,
      // the dock bottom-anchored; at narrow widths both can share the
      // right side only when the dock's box actually reaches the panel's
      // horizontal span. (The old code compared against the dock's right
      // edge unconditionally, which shrank the panel to 164px at 360 wide
      // even though the dock at 360x800 spans 408-644 vertically while the
      // panel sits at 136-440 — different vertical lanes, no real overlap.)
      const naturalLeft = panelRight - (CHROME_TUNING.helpPanelWidth + chromeX);
      // horizontal overlap = the panel's natural left edge would sit LEFT
      // of the dock's right edge (both measured live). Only then shrink.
      const dockRight = dockBox ? dockBox.right : 0;
      const horizontallyOverlaps = naturalLeft < dockRight;
      const cssMaxWidth = horizontallyOverlaps ? panelRight - dockRight - 8 - chromeX : null;
      chromeXRef.current = chromeX;
      if (cssMaxWidth !== panelMaxWidth) {
        setPanelMaxWidth(cssMaxWidth);
        return; // re-measure after the width applies (it changes the height)
      }
      // Round-2 finding 4 rework: the placement solver treats every
      // measured surface as a HARD constraint in BOTH directions.
      //   ceiling: the lowest live toast card's bottom + gap (toasts are
      //     a ceiling, not just a floor — the panel must never start
      //     inside the toast lane)
      //   floor: the corner row's top - gap, or the viewport bottom
      //   minTop: just under the help button
      // The panel occupies [top, top+height]. Conflicts resolve by
      // SHRINK+SCROLL (maxHeight clamp), never by relocating into an
      // occupied lane: if the free band [max(minTop, ceiling), floor]
      // is shorter than the content, the panel is pinned to the TOP of
      // the band (top = max(minTop, ceiling)) and its height is clamped
      // to the band — it scrolls internally. It never moves DOWN into
      // the floor (corner row) and never UP into the ceiling (toasts).
      const cards = [...document.querySelectorAll('[data-toast]')];
      const cardsBottom = cards.reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), 0);
      const minTop = CHROME_TUNING.toastLaneTop + 6; // panel opens below the toast lane
      const ceiling = cardsBottom > 0 ? cardsBottom + 6 : minTop;
      // Round-3 finding 4: EVERY constraint is measured LIVE per viewport.
      // The floor is the corner CONTROLS' live box (the outer wrapper), not
      // the inner row — at narrow widths the row WRAPS (flexWrap wrap at
      // < cornerWrapBelow) and the wrapper grows taller than the row, so a
      // row-derived floor would let the panel overlap the wrapped second
      // row. Wrap heights are never width-derived; the live box is the only
      // truth. Fall back to the viewport bottom when no controls render.
      const corner = document.querySelector('[data-corner-controls]');
      const cornerRow = document.querySelector('[data-corner-row]');
      const cornerBox = corner ? corner.getBoundingClientRect() : cornerRow ? cornerRow.getBoundingClientRect() : null;
      const floorY = (cornerBox ? cornerBox.top : window.innerHeight) - 8;
      // #65 round-6: the solver's conflict branch must actually FIRE at short
      // viewports. top = max(minTop, ceiling) can exceed floorY (ceiling above
      // the floor) — then band clamps to 0 and the panel renders at `top`
      // with unclamped height, overlapping the corner row (panel bottom
      // 378.39 vs cornerRow top 368 at 360x500). Pin top to the floor and
      // let the height clamp do the shrinking: top = min(max(minTop, ceiling),
      // floorY) when the band would be negative.
      const topRaw = Math.max(minTop, ceiling); // never above the ceiling
      const top = topRaw <= floorY ? topRaw : Math.max(minTop, floorY);
      // free vertical band below the ceiling, measured in BORDER-box px:
      // the panel's getBoundingClientRect().height is border-box, so the
      // band the panel may occupy is floorY - top (both viewport coords).
      const band = Math.max(0, floorY - top);
      // Round-6/7 (PR #49 comments #6561476001, #6562013898): NO pixel
      // derivation survives cross-platform fonts (headless FreeType vs
      // Windows ClearType render the same woff2 ~42px apart at this
      // panel's height), so the height rule is purely:
      //     height = min(content, lane), BOTH live-measured on THIS
      //     platform at open/re-measure.
      //   content = the panel's own unclamped rendered BORDER-box extent,
      //     measured via the last child's bottom edge relative to the
      //     panel's border-box top (stable even while a clamp is applied,
      //     unlike scrollHeight, which reports the clamped height).
      //     Round-7 fix: the panel is now box-sizing: border-box (see the
      //     style below), so maxHeight IS the border-box height and the
      //     content readback adds the FULL border-box chrome (padding +
      //     border) — the old content-box math let scrollHeight exceed
      //     clientHeight by paddingBottom + borderBottom on platforms
      //     with fractional text heights (the Windows 246px sub-pixel
      //     class). Ceiled so fractional rasterizer rows never cause a
      //     sub-pixel scrollbar.
      //   lane = floorY - top (toast ceiling -> cornerControls/cornerRow
      //     top, or viewport bottom), also ceiled — border-box px on both
      //     sides now.
      // Ample lane -> panel sizes to content, needsScroll=false on every
      // platform. Short lane -> cap at the lane, scroll inside
      // (shrink+scroll unchanged). No fixed max, no derived constant, no
      // assumed row heights — only numbers the DOM just gave us.
      const rect = panel.getBoundingClientRect();
      const cs = getComputedStyle(panel);
      const padTop = parseFloat(cs.paddingTop) || 0;
      const padBottom = parseFloat(cs.paddingBottom) || 0;
      const borderY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
      const lastChild = panel.lastElementChild as HTMLElement | null;
      // unclamped content extent in CONTENT-box px (what scrollHeight
      // would report with no clamp): last child's bottom minus the
      // content-box top
      const contentTop = rect.top + (parseFloat(cs.borderTopWidth) || 0) + padTop;
      const unclampedContent = lastChild
        ? Math.max(panel.scrollHeight, lastChild.getBoundingClientRect().bottom - contentTop)
        : panel.scrollHeight;
      // border-box natural height = unclamped content + all chrome
      const naturalHeight = Math.ceil(unclampedContent + padTop + padBottom + borderY);
      const laneCeil = Math.ceil(band);
      // border-box element: css maxHeight == border-box max, no subtraction
      const cssMaxHeight = naturalHeight > laneCeil ? laneCeil : null;
      if (top !== panelTop || cssMaxHeight !== panelMaxHeight) {
        setPanelTop(top);
        setPanelMaxHeight(cssMaxHeight);
      }
    };
    // measure after paint, on every toast-stack change, on resize, on
    // font load (document.fonts.ready — a late-arriving woff2 reflows the
    // content and the readback must track it, the round-7 stale-readback
    // suspect), and on any content resize (ResizeObserver on the panel —
    // covers row wraps at width changes the rAF pass can miss)
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => place());
      const panel = panelRef.current;
      if (panel) ro.observe(panel);
    }
    let fontsHooked = false;
    const hookFonts = () => {
      if (fontsHooked) return;
      fontsHooked = true;
      document.fonts?.ready.then(() => place()).catch(() => {});
    };
    hookFonts();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      ro?.disconnect();
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
      {hintOpen && (
        <div
          ref={panelRef}
          data-shortcut-hint-panel
          style={{
            position: 'absolute',
            top: panelTop ?? CHROME_TUNING.toastLaneTop + 6,
            right: 12,
            width: CHROME_TUNING.helpPanelWidth,
            // round 7: border-box so maxHeight is the BORDER-box height and
            // the content readback + clamp share one unit system — kills the
            // scrollHeight-vs-clientHeight padding/border sub-pixel class
            // on fractional-text platforms (Windows ClearType)
            boxSizing: 'border-box',
            // round 7: max-width in border-box px too (width is border-box
            // now), so the dock-clearance shrink and the measured rect share
            // one unit system
            maxWidth: panelMaxWidth !== null ? panelMaxWidth + chromeXRef.current : undefined,
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
          <div style={{ ...headingStyle(theme.font.smallSize - 1), textTransform: 'uppercase', color: theme.color.textFaint, marginBottom: 8 }}>
            {t.shortcutsTitle}
          </div>
          {/* Round-1 finding 4: the content is a GROUPED LIST, not one
              joined block — groups by area (Camera / Tools / Cancel), one
              key + action pair per row. The key column is fixed-width so
              the actions align; the layout is measured (the panel's own
              placement was finding 2), not assumed. */}
          {hintGroups(t).map((group, gi) => (
            <div key={group.heading} data-shortcut-group={group.heading} style={{ marginBottom: gi < hintGroups(t).length - 1 ? 10 : 0 }}>
              <div style={{ ...headingStyle(theme.font.smallSize - 1), textTransform: 'uppercase', color: theme.color.textFaint, marginBottom: 3 }}>
                {group.heading}
              </div>
              {group.rows.map((row) => (
                <div
                  key={row.key}
                  data-shortcut-row
                  // Round-2 finding 4 rework: rows get an explicit min-height
                  // in em (CHROME_TUNING.helpRowMinHeightEm of the row's font
                  // size) so a font with tall metrics (real Pixelify Sans)
                  // never clips or crowds the key chip. 13px * 1.9em = 24.7px —
                  // above the 19.5px that a unitless line-height yields
                  // headless with a fallback font, and above Pixelify's real
                  // ~22px line box.
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: theme.font.smallSize + 1,
                    lineHeight: theme.font.lineHeight,
                    minHeight: CHROME_TUNING.helpRowMinHeightEm + 'em',
                  }}
                >
                  <span
                    data-shortcut-key
                    style={{
                      flex: '0 0 64px',
                      fontWeight: theme.font.weightEmphasis,
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
