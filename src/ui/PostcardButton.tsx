import { useState } from 'react';
import { capturePostcardPng, downloadPostcard } from '../engine/postcard';

/**
 * Postcard button: one click saves the meadow as a PNG.
 * Plain DOM UI — never intercepts canvas pointer events (one-input-path rule).
 */
export function PostcardButton() {
  const [saved, setSaved] = useState(false);
  const onClick = () => {
    try {
      const ok = downloadPostcard(capturePostcardPng());
      setSaved(ok);
      if (ok) setTimeout(() => setSaved(false), 2500);
    } catch {
      // capture failure must never break play; the button just stays quiet
    }
  };
  return (
    <button
      onClick={onClick}
      data-postcard-button
      title="Save a postcard of your meadow"
      style={{
        padding: '8px 12px',
        borderRadius: 10,
        border: '2px solid #d9b36a',
        background: saved ? '#dcedc2' : '#fff4dc',
        color: '#5a4322',
        fontFamily: 'inherit',
        fontSize: 13,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(122, 90, 43, 0.15)',
      }}
    >
      {saved ? 'saved \u2713' : '\u{1F4F7} Postcard'}
    </button>
  );
}
