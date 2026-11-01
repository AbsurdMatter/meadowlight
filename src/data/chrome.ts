/**
 * UI chrome tuning — the dock/corner/onboarding geometry values live here,
 * never hardcoded in components (#6384003544 made the geometry one-spot;
 * this keeps the VALUES one-spot too).
 */
export const CHROME_TUNING = {
  /** the corner-controls lane width reserved on the right of the dock
   *  (five 36px controls + gaps + the dock's right padding). O4: at narrow
   *  frames the corner ROW wraps to two rows, so the reserved lane is the
   *  row height, not the row width — the dock bounds itself instead. */
  cornerLane: 460,
  /**
   * O4 (v4, #42): NARROW-FRAME corner row — below this viewport width the
   * corner controls WRAP to two rows (flexWrap wrap, right-anchored), so
   * the dock's reserved lane is the wrapped row's HEIGHT and the dock may
   * use the full width minus the dock's own inset.
   */
  cornerWrapBelow: 700,
  /** the wrapped corner row's height (two 36px rows + gap + bottom inset) */
  cornerWrapHeight: 96,
  /**
   * O4: the narrow dock's bottom offset — the dock is bottom-anchored
   * ABOVE the wrapped corner rows (the corner lane at narrow widths is the
   * wrapped row's height, so the dock sits on top of it, never beside it).
   */
  narrowDockBottom: 120,
  /** below this width the corner row wraps to three rows (dock lifts higher) */
  cornerWrap3Below: 480,
  /** the three-row corner lane height (three 36px rows + gaps + inset) */
  cornerWrap3Height: 140,
  /** the dock's own horizontal padding (left edge inset + right inset) */
  dockInset: 16,
  /** the dock's max width at wide viewports: the lane minus both insets */
  dockMaxWidthExtra: 32,
  /**
   * O4 (v4, #42): the onboarding hint's bottom offset — above the dock's
   * full top edge (the dock's tab column + scrollable body at narrow
   * frames, the dock bar at wide frames). The hint never overlaps the
   * dock or the corner controls at any width. At narrow frames the dock is
   * bottom-anchored ABOVE the wrapped corner rows, so its top edge is
   * higher — this offset clears the tallest case.
   */
  onboardingHintBottom: 360,
  /** the narrow dock's scrollable body height */
  narrowBodyHeight: 110,
  /**
   * O4 (v4, #42): NARROW-FRAME rule — below this viewport width the dock
   * collapses to its TAB COLUMN ONLY (the tab body scrolls horizontally
   * inside the dock's own box, which keeps its width bounded by the
   * viewport minus the corner lane). The dock never wraps, never overlaps
   * the corner controls, at any width — the mobile pattern is the dock
   * itself (one unwrapped row, reserved lanes).
   */
  narrowDockBelow: 700,
  /** the tab-column-only dock width at narrow frames (tabs + padding) */
  narrowDockWidth: 96,
  /**
   * Round-1 finding 2: the TOP-RIGHT stack's lanes (right: 12), measured
   * from the real rendered boxes. The season dial owns top 12 (bottom 48
   * at 360-480 wide, 62 at 700-1280); the time controls own top 56
   * (bottom 80 at 360-480, 94 at 700-1280). The keyboard-help "?" button
   * used to sit at top 12 — ON the dial — so it now owns the next lane
   * down, clear of the time row's tallest rendered bottom (94) plus this
   * gap. Toasts + the reset button own the lane below the help button
   * (measured clear of the help button's bottom, 130, plus this gap);
   * the ORDER is unchanged — toasts/reset were always the lowest lane.
   */
  helpLaneTop: 102,
  /** the toast/reset lane's top (below the help button's bottom + gap) */
  toastLaneTop: 138,
  /** the hint panel's width (one key + action pair per line fits) */
  helpPanelWidth: 280,
  /**
   * Round-2 finding 4 rework: the hint panel's MAXIMUM border-box height
   * when the lane is ample — derived from MEASURED content (3 group
   * headings + 6 rows at the panel's font size, plus title + padding),
   * NOT from an assumed row height. Headless Chromium without a font
   * rasterizer measures rows at 19.5px; real Pixelify Sans rows measure
   * ~24.7px (1.9em of 13px). The cap uses the REAL-font metrics with a
   * generous per-em margin so the panel never needs internal scroll at an
   * ample viewport: title (11px + 8 margin) + 3 headings (11px + 3 margin
   * each) + 6 rows (1.9em of 13px = 24.7px each) + 2 group gaps (10px) +
   * padding 24px + border 4px ~= 262px; 280px gives headroom. When the
   * lane is SHORTER than the content, the panel clamps to the band and
   * scrolls (never relocates into the toast lane or corner row). NOTE:
   * the panel has no box-sizing reset, so a CSS maxHeight applies to the
   * CONTENT box — the component subtracts padding+border before applying.
   * Round-3 finding 4: +8px headroom over the ~262px measured content so
   * fractional real-font rows (24.69px each) never trigger a sub-pixel
   * scrollbar at an ample viewport — the solver ceils the measured
   * extent, and this cap carries the same headroom.
   */
  helpPanelMaxHeight: 288,
  /** each hint-panel row's min-height in em (tall-font fallback, see above) */
  helpRowMinHeightEm: 1.9,
} as const;
