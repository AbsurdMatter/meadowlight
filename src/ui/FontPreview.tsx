import { useEffect, useState } from 'react';
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
  faces: { url: string; weight: string; range?: string }[];
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
const EXT_RANGE = 'U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';
// #64: each candidate registers BOTH subsets under the probe family — the
// latin file first with NO range (so it owns ASCII), the latin-ext file with
// the diacritic range — so every glyph of the test line renders in this one
// face. A single latin-ext-only registration would make ASCII fall through
// to whatever follows the family in the stack = mixed faces.
const FONT_FACE_BYTES: Record<string, { url: string; weight: string; range?: string }[]> = {
  'jersey-25': [{ url: '/fonts/jersey-25-latin-400-normal.woff2', weight: '400' }, { url: '/fonts/jersey-25-latin-ext-400-normal.woff2', weight: '400', range: EXT_RANGE }],
  'pixelify-sans': [
    { url: '/fonts/pixelify-sans-latin-400-normal.woff2', weight: '400' }, { url: '/fonts/pixelify-sans-latin-ext-400-normal.woff2', weight: '400', range: EXT_RANGE },
    { url: '/fonts/pixelify-sans-latin-700-normal.woff2', weight: '700' }, { url: '/fonts/pixelify-sans-latin-ext-700-normal.woff2', weight: '700', range: EXT_RANGE },
  ],
  'press-start-2p': [{ url: '/fonts/press-start-2p-latin-400-normal.woff2', weight: '400' }, { url: '/fonts/press-start-2p-latin-ext-400-normal.woff2', weight: '400', range: EXT_RANGE }],
  'vt323': [{ url: '/fonts/vt323-latin-400-normal.woff2', weight: '400' }, { url: '/fonts/vt323-latin-ext-400-normal.woff2', weight: '400', range: EXT_RANGE }],
  'handjet': [
    { url: '/fonts/handjet-latin-400-normal.woff2', weight: '400' }, { url: '/fonts/handjet-latin-ext-400-normal.woff2', weight: '400', range: EXT_RANGE },
    { url: '/fonts/handjet-latin-700-normal.woff2', weight: '700' }, { url: '/fonts/handjet-latin-ext-700-normal.woff2', weight: '700', range: EXT_RANGE },
  ],
  'dotgothic16': [{ url: '/fonts/dotgothic16-latin-400-normal.woff2', weight: '400' }, { url: '/fonts/dotgothic16-latin-ext-400-normal.woff2', weight: '400', range: EXT_RANGE }],
  'jersey-10': [{ url: '/fonts/jersey-10-latin-400-normal.woff2', weight: '400' }, { url: '/fonts/jersey-10-latin-ext-400-normal.woff2', weight: '400', range: EXT_RANGE }],
  'jersey-15': [{ url: '/fonts/jersey-15-latin-400-normal.woff2', weight: '400' }, { url: '/fonts/jersey-15-latin-ext-400-normal.woff2', weight: '400', range: EXT_RANGE }],
  'jersey-20': [{ url: '/fonts/jersey-20-latin-400-normal.woff2', weight: '400' }, { url: '/fonts/jersey-20-latin-ext-400-normal.woff2', weight: '400', range: EXT_RANGE }],
  'tektur': [
    { url: '/fonts/tektur-latin-400-normal.woff2', weight: '400' }, { url: '/fonts/tektur-latin-ext-400-normal.woff2', weight: '400', range: EXT_RANGE },
    { url: '/fonts/tektur-latin-700-normal.woff2', weight: '700' }, { url: '/fonts/tektur-latin-ext-700-normal.woff2', weight: '700', range: EXT_RANGE },
  ],
  'kode-mono': [
    { url: '/fonts/kode-mono-latin-400-normal.woff2', weight: '400' }, { url: '/fonts/kode-mono-latin-ext-400-normal.woff2', weight: '400', range: EXT_RANGE },
    { url: '/fonts/kode-mono-latin-700-normal.woff2', weight: '700' }, { url: '/fonts/kode-mono-latin-ext-700-normal.woff2', weight: '700', range: EXT_RANGE },
  ],
  'sixtyfour': [{ url: '/fonts/sixtyfour-latin-400-normal.woff2', weight: '400' }, { url: '/fonts/sixtyfour-latin-ext-400-normal.woff2', weight: '400', range: EXT_RANGE }],
};

const CANDIDATES: Cand[] = [
  { id: 'jersey-25', family: "'Cand Jersey 25'", probe: 'Cand Jersey 25', note: 'chunky display pixel — closest spirit to Silkscreen', weights: '400', faces: FONT_FACE_BYTES['jersey-25'] },
  { id: 'pixelify-sans', family: "'Cand Pixelify'", probe: 'Cand Pixelify', note: 'the original body font — always had č', weights: '400/700', faces: FONT_FACE_BYTES['pixelify-sans'] },
  { id: 'press-start-2p', family: "'Cand Press Start 2P'", probe: 'Cand Press Start 2P', note: 'wide arcade caps', weights: '400', faces: FONT_FACE_BYTES['press-start-2p'] },
  { id: 'vt323', family: "'Cand VT323'", probe: 'Cand VT323', note: 'CRT terminal', weights: '400', faces: FONT_FACE_BYTES['vt323'] },
  { id: 'handjet', family: "'Cand Handjet'", probe: 'Cand Handjet', note: 'dot-matrix, huge script coverage', weights: '400/700', faces: FONT_FACE_BYTES['handjet'] },
  { id: 'dotgothic16', family: "'Cand DotGothic16'", probe: 'Cand DotGothic16', note: 'dot gothic (note: latin-ext lacks č — shown for contrast)', weights: '400', faces: FONT_FACE_BYTES['dotgothic16'] },
  { id: 'jersey-10', family: "'Cand Jersey 10'", probe: 'Cand Jersey 10', note: 'Jersey 10', weights: '400', faces: FONT_FACE_BYTES['jersey-10'] },
  { id: 'jersey-15', family: "'Cand Jersey 15'", probe: 'Cand Jersey 15', note: 'Jersey 15', weights: '400', faces: FONT_FACE_BYTES['jersey-15'] },
  { id: 'jersey-20', family: "'Cand Jersey 20'", probe: 'Cand Jersey 20', note: 'Jersey 20', weights: '400', faces: FONT_FACE_BYTES['jersey-20'] },
  { id: 'tektur', family: "'Cand Tektur'", probe: 'Cand Tektur', note: 'Tektur', weights: '400/700', faces: FONT_FACE_BYTES['tektur'] },
  { id: 'kode-mono', family: "'Cand Kode Mono'", probe: 'Cand Kode Mono', note: 'Kode Mono', weights: '400/700', faces: FONT_FACE_BYTES['kode-mono'] },
  { id: 'sixtyfour', family: "'Cand Sixtyfour'", probe: 'Cand Sixtyfour', note: 'Sixtyfour CRT (latin-ext partial — no čšž)', weights: '400', faces: FONT_FACE_BYTES['sixtyfour'] },
];

/** one panel-text sample per candidate: the help panel's real content +
 * a fact line in body size, so small-size readability is visible */
function Sample({ family }: { family: string }) {
  const testLine = 'ČEBULA ŠŽIVI — Pomlad, Poletje, Jesen, Zima';
  const hintTitle = 'Terenski dnevnik';
  const hintGroups = [
    { heading: 'Kamera', rows: [{ key: 'W A S D', action: 'premakni kamero' }, { key: 'Q E', action: 'zavrti pogled' }] },
    { heading: 'Orodja', rows: [{ key: 'I', action: 'povečevalno steklo' }, { key: 'J', action: 'dnevnik' }, { key: 'R', action: 'začni znova (vpraša najprej)' }] },
    { heading: 'Prekliči', rows: [{ key: 'Esc', action: 'zapre, kar je odprto' }] },
  ];
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
        width: 340,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ ...headingStyle(theme.font.titleSize), fontFamily: family, fontWeight: 700 }}>
        {testLine}
      </div>
      <div style={{ marginTop: 8, ...headingStyle(theme.font.titleSize), fontFamily: family, fontWeight: 700 }}>
        {hintTitle} — {testLine}
      </div>
      {hintGroups.map((g) => (
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
        Čebelji panj brenči — čebele so že odkrile četeljo. {testLine}
      </div>
      <div style={{ marginTop: 6, fontSize: theme.font.smallSize, opacity: 0.7 }}>
        smallSize 12px sample — čudevito
      </div>
    </div>
  );
}

/** the stack a sample renders with: the imperatively-registered probe
 *  family first (works in every environment, same woff2 bytes), then the
 *  CSS @font-face family (the path the real app uses) as fallback */
function probeStack(c: Cand): string {
  // #64: the stack is the candidate family ONLY (+ generic sans fallback) —
  // never the app's own faces — so a mixed sample line cannot be misread as
  // the candidate's look.
  return `'${c.probe}', ${c.family}, sans-serif`;
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
            const ff = new FontFace(c.probe, buf, { weight: f.weight, unicodeRange: f.range });
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
