import { useEffect, useRef, useState } from 'react';
import { capturePostcardPng, downloadPostcard } from '../engine/postcard';
import { composePostcard } from '../engine/postcardCompose';
import { theme, headingStyle } from './theme';
import { CHROME_TUNING } from '../data/chrome';
import { PostcardStats, postcardStatText } from './PostcardStats';
import { usePlacementStore } from '../render/placementStore';
import { encodeSeedCode } from '../engine/seedCode';
import { useLocale } from '../engine/locale';

/**
 * Postcard button: one click saves the meadow as a PNG.
 * Plain DOM UI — never intercepts canvas pointer events (one-input-path rule).
 * Styled from the theme module only (#16).
 *
 * P3 (v4 seed codes): a gentle "share this meadow's seed" affordance sits
 * next to the postcard — click copies the seed code to the clipboard (with
 * a quiet inline fallback showing the code when the clipboard is
 * unavailable). The code captures species + positions only; season, jars,
 * and notebook stay local.
 */
export function PostcardButton() {
  const t = useLocale((s) => s.t());
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  // #61 close grammar: click-outside closes the share panel (same pattern as
  // the help popover); Esc closes it via the ESC semantics table
  useEffect(() => {
    const shown = usePlacementStore.getState().sharePanelOpen;
    if (!shown) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popRef.current && !popRef.current.contains(target) && btnRef.current && !btnRef.current.contains(target)) {
        usePlacementStore.getState().setSharePanelOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  });
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState(false);
  const seedShown = usePlacementStore((s) => s.sharePanelOpen);
  const setSeedShown = usePlacementStore((s) => s.setSharePanelOpen);
  const [seedCopied, setSeedCopied] = useState(false);
  // #65 tail: publish the toast-stack clearance on the popover so its
  // maxHeight shrinks out from under live notices at short viewports
  // (measured from the live [data-toast] cards, re-measured on an interval
  // while open — same live-measure discipline as the hint panel)
  useEffect(() => {
    if (!seedShown) return;
    const el = popRef.current;
    const btn = btnRef.current;
    if (!el || !btn) return;
    const update = () => {
      // #65 round-12: derive the popover's lane from the LIVE toast ceiling,
      // exactly like the hint panel's solver. The popover opens UPWARD from
      // the corner-row button (bottom-anchored), so its bottom anchor is the
      // button's live top minus the lane gap, and its lane is
      // [ceiling, anchorBottom] where ceiling = the lowest live toast card's
      // bottom + gap (toasts are a ceiling, not just a floor — the popover
      // must never rise into the toast lane). maxHeight starts at the whole
      // measured band, CLAMPED UPWARD (never above the ceiling, never past
      // the viewport top), then the loop re-measures the RENDERED rect at
      // every attempt and shrinks by the measured residual until it clears —
      // the rendered rect is the only truth that survives wrap/font timing.
      const anchorBottom = btn.getBoundingClientRect().top - CHROME_TUNING.shareLaneGap;
      const cards = [...document.querySelectorAll('[data-toast]')];
      const cardsBottom = cards.reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), 0);
      const ceiling = cardsBottom > 0 ? cardsBottom + 6 : 8;
      const band = anchorBottom - Math.max(ceiling, 8);
      let maxH = Math.max(8, Math.min(window.innerHeight - 16, band));
      for (let k = 0; k < 16; k++) {
        el.style.setProperty('--share-max-h', maxH.toFixed(1) + 'px');
        const r = el.getBoundingClientRect();
        let worst = Math.max(ceiling - r.top, 8 - r.top); // toast-lane / viewport-top overflow
        for (const c of cards) {
          const b = c.getBoundingClientRect();
          worst = Math.max(worst, b.bottom - r.top); // positive = toast overlap
        }
        if (worst <= 0.5 && r.top >= 0 && r.bottom <= window.innerHeight + 0.5) break;
        maxH = Math.max(8, maxH - worst - 1);
      }
      el.style.setProperty('--share-max-h', Math.min(maxH, window.innerHeight - 16).toFixed(1) + 'px');
    };
    update();
    const t = setInterval(update, 400);
    return () => clearInterval(t);
  }, [seedShown]);
  const onClick = async () => {
    try {
      const capture = capturePostcardPng();
      if (!capture) return;
      // the user-facing button produces the COMPOSED card (plain capture
      // stays available to the P harness via capturePostcardPng)
      const stats = postcardStatText().map((l) => ({ label: l.label, value: l.value }));
      // #94: the postcard carries no seed — compose(capture, stats) only
      const composed = await composePostcard(capture, stats);
      const ok = downloadPostcard(composed ?? capture);
      setSaved(ok);
      if (ok) setTimeout(() => setSaved(false), 2500);
    } catch {
      // capture failure must never break play; the button just stays quiet
    }
  };
  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onPointerEnter={() => setStats(true)}
      onPointerLeave={() => setStats(false)}
    >
      <button
        onClick={onClick}
        data-postcard-button
        title={t.postcardTitle}
        style={{
        // UI round 3 (#6383867199): shares the corner row's 36px baseline
        // (align-self stretch from the row; no hand-positioned offsets)
        height: 36,
        boxSizing: 'border-box',
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.border.radius,
        border: `${theme.border.chunk}px solid ${saved ? theme.color.sage : theme.color.honey}`,
        background: saved ? theme.color.sageLight : theme.color.parchment,
        color: theme.color.text,
        fontFamily: theme.font.family,
        fontSize: theme.font.smallSize,
        lineHeight: 1,
        cursor: 'pointer',
        boxShadow: theme.border.shadow,
      }}
    >
        {saved ? t.postcardSaved : t.postcardButton}
      </button>
      {stats && <PostcardStats />}
      <button
        ref={btnRef}
        onClick={async () => {
          const s = usePlacementStore.getState();
          const code = encodeSeedCode(s.worldSeed, s.items);
          setSeedShown(true);
          setSeedCopied(false);
          try {
            await navigator.clipboard.writeText(code);
            setSeedCopied(true);
            setTimeout(() => setSeedCopied(false), 2500);
          } catch {
            // clipboard unavailable (non-secure context): the code stays
            // visible in the popover for a manual copy — never a fail state
          }
        }}
        data-seed-share-button
        title={t.seedShareTitle}
        style={{
          height: 36,
          boxSizing: 'border-box',
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.border.radius,
          border: `${theme.border.chunk}px solid ${theme.color.honey}`,
          background: seedShown ? theme.color.sageLight : theme.color.parchment,
          color: theme.color.text,
          fontFamily: theme.font.family,
          fontSize: theme.font.smallSize,
          lineHeight: 1,
          cursor: 'pointer',
          boxShadow: theme.border.shadow,
        }}
      >
        {seedCopied ? t.seedCopiedButton : t.seedButton}
      </button>
      {seedShown && (
        <div
          ref={popRef}
          data-seed-share-popover
          style={{
            position: 'absolute',
            // #65: the button lives in the bottom corner row, so the popover
            // opens UPWARD toward available space (bottom-anchored at the
            // row's top) and is clamped to the viewport top — it can never
            // render off-screen below the fold again. The chrome gate still
            // asserts it never intersects a notice/corner box.
            // #65 round-8: upward-open posture (bottom-anchored at the row's
            // top); maxHeight shrinks by the live toast-band overlap so the
            // popover clears the toast stack from ABOVE at short viewports
            // while staying on-screen at tall ones.
            // #65 round-12: border-box, like the hint panel — the lane solver
            // writes a BORDER-box max height into --share-max-h, so with
            // content-box the padding+border chrome sat ON TOP of the cap and
            // the rendered box could never shrink into a short lane
            // (share∩toast#0 at the 500-height viewports: band 22.8px,
            // floor 16 + ~30px chrome = 46px rendered minimum).
            boxSizing: 'border-box',
            bottom: 'calc(100% + ' + CHROME_TUNING.shareLaneGap + 'px)',
            top: 'auto',
            right: 0,
            zIndex: 60,
            maxHeight: 'var(--share-max-h, calc(100vh - 16px))',
            overflowY: 'auto',
            padding: theme.spacing.panelPadding,
            borderRadius: theme.border.radiusPanel,
            background: theme.color.panel,
            border: `${theme.border.chunk}px solid ${theme.color.honey}`,
            boxShadow: theme.border.shadowPanel,
            color: theme.color.text,
            fontFamily: theme.font.family,
            fontSize: theme.font.smallSize,
            maxWidth: 260,
            // #94: never horizontal scroll — the popover itself never overflows
            overflowX: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ ...headingStyle(theme.font.bodySize), marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t.seedShareHeading}</span>
            <button
              data-seed-share-close
              onClick={() => setSeedShown(false)}
              aria-label={t.seedShareHeading}
              style={{ border: 'none', background: 'transparent', color: theme.color.textSoft, fontSize: 16, cursor: 'pointer', fontFamily: theme.font.family }}
            >
              ×
            </button>
          </div>
          <div
            data-seed-code
            // #94 (user scope decision): the code is a machine interface —
            // the visible text is a truncated PREVIEW (ellipsis in a max-width
            // block, never horizontal scroll); the FULL code stays in the DOM
            // (select-all still copies it) and on the clipboard via the copy
            // button, which writes the full encodeSeedCode(...) result.
            title={encodeSeedCode(usePlacementStore.getState().worldSeed, usePlacementStore.getState().items)}
            style={{
              padding: '4px 8px',
              borderRadius: theme.border.radius,
              background: theme.color.parchment,
              maxWidth: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              userSelect: 'all',
            }}
          >
            {encodeSeedCode(usePlacementStore.getState().worldSeed, usePlacementStore.getState().items)}
          </div>
          <div style={{ marginTop: 6, opacity: 0.85 }}>
            {seedCopied ? t.seedShareCopied : t.seedShareHint}
          </div>
        </div>
      )}
    </div>
  );
}
