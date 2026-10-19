/**
 * #16 Voxel chrome theme — the ONE module every panel reads.
 *
 * Nothing in src/ui may hardcode a font, size, color, border, radius, or
 * shadow anymore: all chrome visuals come from here, so the whole UI is
 * restyled (or re-themed) by editing this file alone.
 *
 * Design language ("everything voxel, including the chrome"):
 *   - Pixelify Sans (self-hosted woff2 in public/fonts — the embed never
 *     fetches anything at runtime; @font-face is declared here)
 *   - chunky borders (2-3px), small radii (voxels have none, but 4-6px keeps
 *     buttons friendly), hard offset shadows instead of soft blurs
 *   - the meadow's own palette: parchment, honey, sage, soil
 */

export const theme = {
  font: {
    /** UI stack; Pixelify Sans is bundled, so it works offline/file:// */
    family:
      "'Pixelify Sans', ui-rounded, 'SF Pro Rounded', system-ui, sans-serif",
    /** facts/body copy stay highly readable at Pixelify's small sizes */
    bodySize: 14,
    smallSize: 12,
    titleSize: 17,
    headerSize: 13,
    lineHeight: 1.5,
  },
  color: {
    text: '#5a4322',
    textSoft: '#7a5a2b',
    textFaint: '#9a7a45',
    parchment: '#fff4dc',
    parchmentDeep: '#f7ecd0',
    parchmentLight: '#fff8e8',
    panel: 'rgba(255, 246, 224, 0.94)',
    panelSolid: '#fff6e0',
    honey: '#d9b36a',
    honeyDark: '#b0a58c',
    honeyActive: '#ffe9b8',
    sage: '#7a9d54',
    sageLight: '#dcedc2',
    clay: '#c9584a',
    clayDark: '#a04a3a',
    clayText: '#8a4a3a',
    ink: '#4a3522',
    scrim: 'rgba(74, 53, 34, 0.45)',
  },
  border: {
    /** chunky voxel border widths */
    chunk: 2,
    chunky: 3,
    radius: 6,
    radiusPanel: 10,
    /** hard offset shadow — a pixel shadow, not a blur */
    shadow: '3px 3px 0 rgba(90, 67, 34, 0.25)',
    shadowPanel: '4px 4px 0 rgba(90, 67, 34, 0.28)',
    color: '#b0a58c',
    colorActive: '#7a9d54',
    colorStrong: '#d9b36a',
  },
  spacing: {
    panelPadding: '12px 16px',
    dialogPadding: '18px 22px',
    controlPadding: '6px 14px',
    gap: 8,
  },
} as const;

/** Standard panel chrome (notebook, toasts, popovers, strips). */
export const panelStyle: React.CSSProperties = {
  background: theme.color.panel,
  color: theme.color.text,
  fontFamily: theme.font.family,
  border: `${theme.border.chunk}px solid ${theme.color.honey}`,
  borderRadius: theme.border.radiusPanel,
  boxShadow: theme.border.shadowPanel,
};

/** Standard control (buttons): chunky border, hard shadow, pressed feel. */
export const controlStyle = (active = false, variant: 'default' | 'clay' | 'sage' = 'default'): React.CSSProperties => ({
  fontFamily: theme.font.family,
  fontSize: theme.font.bodySize,
  color: variant === 'clay' ? '#fff6ec' : theme.color.text,
  padding: theme.spacing.controlPadding,
  border: `${theme.border.chunk}px solid ${active ? theme.color.sage : variant === 'clay' ? theme.color.clayDark : theme.color.honeyDark}`,
  borderRadius: theme.border.radius,
  background: variant === 'clay' ? theme.color.clay : active ? theme.color.honeyActive : theme.color.parchment,
  boxShadow: theme.border.shadow,
  cursor: 'pointer',
});
