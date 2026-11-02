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
  const onClick = async () => {
    try {
      const capture = capturePostcardPng();
      if (!capture) return;
      // the user-facing button produces the COMPOSED card (plain capture
      // stays available to the P harness via capturePostcardPng)
      const stats = postcardStatText().map((l) => ({ label: l.label, value: l.value }));
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
            // #59: the share popover owns the lane below the toast lane,
            // measured (chrome gate asserts it never intersects a notice)
            top: CHROME_TUNING.shareLaneTop - 190,
            right: 0,
            zIndex: 60,
            padding: theme.spacing.panelPadding,
            borderRadius: theme.border.radiusPanel,
            background: theme.color.panel,
            border: `${theme.border.chunk}px solid ${theme.color.honey}`,
            boxShadow: theme.border.shadowPanel,
            color: theme.color.text,
            fontFamily: theme.font.family,
            fontSize: theme.font.smallSize,
            maxWidth: 260,
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
            style={{
              padding: '4px 8px',
              borderRadius: theme.border.radius,
              background: theme.color.parchment,
              wordBreak: 'break-all',
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
