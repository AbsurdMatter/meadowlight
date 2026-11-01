import { useState } from 'react';
import { capturePostcardPng, downloadPostcard } from '../engine/postcard';
import { composePostcard } from '../engine/postcardCompose';
import { theme, headingStyle } from './theme';
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
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState(false);
  const [seedShown, setSeedShown] = useState(false);
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
          data-seed-share-popover
          style={{
            position: 'absolute',
            bottom: 44,
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
          <div style={{ ...headingStyle(theme.font.bodySize), marginBottom: 6 }}>{t.seedShareHeading}</div>
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
