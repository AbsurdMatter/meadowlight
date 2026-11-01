/**
 * Typography as data — the ONE source for the two UI font roles (round 5,
 * PR #49 comment #6560170382: user picked B-for-body / A-for-headings).
 *
 *   - BODY (panels, facts, buttons, toasts): Nunito 400/500/700 — rounded
 *     sans, strongest small-size legibility (the reason Pixelify is no
 *     longer body: its metrics shift panel heights across font rasterizers,
 *     the round-2/3 gate failures).
 *   - HEADINGS (titles, section labels, fact titles): Silkscreen 400/700 —
 *     keeps the pixel identity where it reads best (short labels), and its
 *     blocky letterforms survive small sizes.
 *
 * Both self-hosted OFL woff2 in public/fonts with @font-face in index.html
 * (families 'Nunito' and 'Silkscreen') — the embed never fetches fonts at
 * runtime. theme.ts reads these stacks; nothing in src/ui names a font
 * family directly. The postcard compositor (engine/postcardCompose.ts) uses
 * the heading stack for its title so the PNG matches the DOM hierarchy.
 */
export const TYPOGRAPHY = {
  /** body copy / controls / facts — Nunito */
  body: {
    family: "'Nunito', ui-rounded, 'SF Pro Rounded', system-ui, sans-serif",
    weights: { body: 400, emphasis: 500, heading: 700 } as const,
  },
  /** titles / section labels / fact titles — Silkscreen (pixel identity) */
  heading: {
    family: "'Silkscreen', 'Nunito', ui-rounded, system-ui, sans-serif",
    weights: { label: 400, heading: 700 } as const,
  },
} as const;
