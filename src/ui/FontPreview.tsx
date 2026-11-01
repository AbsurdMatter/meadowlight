import { useEffect, useState } from 'react';
import { SHORTCUT_HINT } from '../engine/keyboardShortcuts';
import { theme, headingStyle } from './theme';

/**
 * Round 4 (session 9, PR #49 comment #6558805747): FONT CANDIDATE PREVIEW —
 * opened ONLY with ?font-preview=1 in the URL. Renders the SAME panel text
 * the app uses (the real SHORTCUT_HINT groups + a notebook-style fact line)
 * four times, once per candidate body font, each self-hosted woff2 (the
 * @font-face declarations live in index.html under the "Cand " families).
 *
 * This overlay is NOT part of the game UI — it exists so the user can pick
 * the body font with their own eyeballs on their own machine. The app font
 * (theme.font.family) is untouched until the user picks; the swap is one
 * commit. Candidates: Pixelify Sans (current), Cand Silkscreen (pixel,
 * designed for small sizes), Cand Nunito (rounded, text-legible), Cand
 * Varela Round (single-weight rounded).
 */

interface Cand {
  id: string;
  /** the @font-face family declared in index.html */
  family: string;
  note: string;
  weights: string;
  /** the woff2 urls to register imperatively (see FONT_FACE_BYTES) */
  faces: { url: string; weight: string }[];
  /** the probe family name used for the imperative FontFace registration */
  probe: string;
}

/**
 * The headless-shell quirk: CSS @font-face faces from the dev server land in
 * status "error" in this sandbox (the files themselves serve 200 with valid
 * wOF2 headers — verified byte-level; the same file loads fine through the
 * FontFace API). On the USER's real browser the @font-face path works, so the
 * overlay keeps the CSS families AND, as a belt-and-braces for any
 * environment with the same quirk, registers the same bytes imperatively
 * under suffixed probe families and renders with those. The visual result is
 * identical either way — the same woff2 bytes.
 */
const FONT_FACE_BYTES: Record<string, { url: string; weight: string }[]> = {
  pixelify: [
    { url: '/fonts/pixelify-sans-latin-400-normal.woff2', weight: '400' },
    { url: '/fonts/pixelify-sans-latin-500-normal.woff2', weight: '500' },
    { url: '/fonts/pixelify-sans-latin-700-normal.woff2', weight: '700' },
  ],
  silkscreen: [
    { url: '/fonts/silkscreen-v6-latin-regular.woff2', weight: '400' },
    { url: '/fonts/silkscreen-v6-latin-700.woff2', weight: '700' },
  ],
  nunito: [
    { url: '/fonts/nunito-v32-latin-regular.woff2', weight: '400' },
    { url: '/fonts/nunito-v32-latin-500.woff2', weight: '500' },
    { url: '/fonts/nunito-v32-latin-700.woff2', weight: '700' },
  ],
  varela: [{ url: '/fonts/varela-round-v21-latin-regular.woff2', weight: '400' }],
};

const CANDIDATES: Cand[] = [
  {
    id: 'pixelify',
    family: "'Pixelify Sans', ui-rounded, system-ui, sans-serif",
    note: 'current — pixel identity, 400/500/700',
    weights: '400/500/700',
    faces: FONT_FACE_BYTES.pixelify,
    probe: 'Pixelify Web',
  },
  {
    id: 'silkscreen',
    family: "'Cand Silkscreen', 'Pixelify Sans', monospace",
    note: 'candidate A — pixel, built for small web sizes',
    weights: '400/700',
    faces: FONT_FACE_BYTES.silkscreen,
    probe: 'Cand Silkscreen Web',
  },
  {
    id: 'nunito',
    family: "'Cand Nunito', 'Pixelify Sans', ui-rounded, sans-serif",
    note: 'candidate B — rounded sans, strongest body-text legibility',
    weights: '400/500/700',
    faces: FONT_FACE_BYTES.nunito,
    probe: 'Cand Nunito Web',
  },
  {
    id: 'varela',
    family: "'Cand Varela Round', 'Pixelify Sans', ui-rounded, sans-serif",
    note: 'candidate C — soft rounded, single weight 400',
    weights: '400 only',
    faces: FONT_FACE_BYTES.varela,
    probe: 'Cand Varela Round Web',
  },
];

/** one panel-text sample per candidate: the help panel's real content +
 * a fact line in body size, so small-size readability is visible */
function Sample({ family }: { family: string }) {
  return (
    <div
      style={{
        fontFamily: family,
        padding: theme.spacing.panelPadding,
        borderRadius: theme.border.radiusPanel,
        background: theme.color.panel,
        border: `${theme.border.chunk}px solid ${theme.color.honey}`,
        boxShadow: theme.border.shadowPanel,
        color: theme.color.text,
        width: 320,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ ...headingStyle(theme.font.titleSize), fontFamily: family, fontWeight: 700 }}>
        {SHORTCUT_HINT.title}
      </div>
      {SHORTCUT_HINT.groups.map((g) => (
        <div key={g.heading} style={{ marginTop: 8 }}>
          <div style={{ ...headingStyle(13), fontFamily: family, fontWeight: 700 }}>{g.heading}</div>
          {g.rows.map((r) => (
            <div
              key={r.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: theme.font.bodySize,
                minHeight: '1.9em',
              }}
            >
              <span
                style={{
                  width: 64,
                  flexShrink: 0,
                  textAlign: 'center',
                  fontWeight: 500,
                  border: `${theme.border.chunk}px solid ${theme.color.honeyDark}`,
                  borderRadius: theme.border.radius,
                  background: theme.color.parchmentDeep,
                  fontFamily: family,
                }}
              >
                {r.key}
              </span>
              <span style={{ fontFamily: family }}>{r.action}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 10, fontSize: theme.font.bodySize, lineHeight: 1.5, opacity: 0.9 }}>
        ✦ Lavender at peak bloom can feed dozens of bumblebees in a single day — plant drifts of one
        species and they will queue up at dawn.
      </div>
      <div style={{ marginTop: 6, fontSize: theme.font.smallSize, opacity: 0.7 }}>
        smallSize 12px sample — the notebook's quiet lines
      </div>
    </div>
  );
}

/** the stack a sample renders with: the imperatively-registered probe
 *  family first (works in every environment, same woff2 bytes), then the
 *  CSS @font-face family (the path the real app uses) as fallback */
function probeStack(c: Cand): string {
  return `'${c.probe}', ${c.family}`;
}

export function FontPreview() {
  // register the candidate bytes imperatively (see FONT_FACE_BYTES): on a
  // healthy browser the CSS @font-face already loaded them and this is a
  // no-op re-add; in quirky environments (headless shell) it makes the
  // overlay render the REAL faces instead of fallback
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const c of CANDIDATES) {
        for (const f of c.faces) {
          try {
            const buf = await (await fetch(f.url)).arrayBuffer();
            if (cancelled) return;
            const ff = new FontFace(c.probe, buf, { weight: f.weight });
            await ff.load();
            document.fonts.add(ff);
          } catch {
            /* CSS @font-face path remains as fallback */
          }
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div
      data-font-preview
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        background: theme.color.scrim,
        zIndex: 100,
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ color: '#fff4dc', fontFamily: theme.font.family, marginBottom: 12, fontSize: 15 }}>
        Font candidates (?font-preview=1) — same panel text in each body font. Pick one; the swap is a
        single commit. Currently active app font: Pixelify Sans.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {CANDIDATES.map((c) => (
          <div key={c.id} data-font-candidate={c.id}>
            <div
              style={{
                color: '#fff4dc',
                fontFamily: theme.font.family,
                fontSize: 13,
                marginBottom: 6,
                fontWeight: 700,
              }}
            >
              {c.note}
            </div>
            <Sample family={ready ? probeStack(c) : c.family} />
            <div style={{ color: '#fff4dc', fontSize: 11, marginTop: 4, opacity: 0.8 }}>
              weights: {c.weights}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
