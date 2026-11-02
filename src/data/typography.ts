/**
 * Typography as data — the ONE source for the two UI font roles (round 5,
 * PR #49 comment #6560170382: user picked B-for-body / A-for-headings).
 *
 *   - BODY (panels, facts, buttons, toasts): Nunito 400/500/700 — rounded
 *     sans, strongest small-size legibility (the reason Pixelify is no
 *     longer body: its metrics shift panel heights across font rasterizers,
 *     the round-2/3 gate failures).
 *   - HEADINGS (titles, section labels, fact titles): Jersey 25 (session 10
 *     font pick, user decision after the ?font-preview=1 round; single-weight
 *     family, registered with a 400-700 range so 700 headings synthesize).
 *     Self-hosted latin + latin-ext (dual-subset, full č š ž coverage —
 *     verified in the woff2 cmaps), so Slovenian headings render in-face.
 *
 * Both self-hosted OFL woff2 in public/fonts with @font-face in index.html
 * (families 'Nunito' and 'Jersey 25') — the embed never fetches fonts at
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
  /** titles / section labels / fact titles — Jersey 25 (session 10 pick) */
  heading: {
    family: "'Jersey 25', 'Nunito', ui-rounded, system-ui, sans-serif",
    weights: { label: 400, heading: 700 } as const,
  },
} as const;
