import { useState } from 'react';
import { capturePostcardPng, downloadPostcard } from '../engine/postcard';
import { composePostcard } from '../engine/postcardCompose';
import { theme } from './theme';
import { PostcardStats, postcardStatText } from './PostcardStats';

/**
 * Postcard button: one click saves the meadow as a PNG.
 * Plain DOM UI — never intercepts canvas pointer events (one-input-path rule).
 * Styled from the theme module only (#16).
 */
export function PostcardButton() {
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState(false);
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
        title="Save a postcard of your meadow"
        style={{
        padding: '8px 12px',
        borderRadius: theme.border.radius,
        border: `${theme.border.chunk}px solid ${saved ? theme.color.sage : theme.color.honey}`,
        background: saved ? theme.color.sageLight : theme.color.parchment,
        color: theme.color.text,
        fontFamily: theme.font.family,
        fontSize: theme.font.smallSize,
        cursor: 'pointer',
        boxShadow: theme.border.shadow,
      }}
    >
        {saved ? 'saved ✓' : '📸 Postcard'}
      </button>
      {stats && <PostcardStats />}
    </div>
  );
}
