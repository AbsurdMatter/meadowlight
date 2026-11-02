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
  /**
   * #59 (session 10 fix round): the reset button is anchored DIRECTLY under
   * the time controls (top 56, bottom 94 at 700-1280 / 80 at 360-480) — its
   * lane top is the time row's measured bottom + gap, same discipline as the
   * help lane. The toast stack (season notices) flows BELOW the reset button;
   * the share popover gets its own measured lane below the toasts.
   */
  resetLaneTop: 102,
  /**
   * the toast lane's top — directly below the reset button's lane. The stack
   * grows UPWARD (column-reverse) from its lane and is capped at the lane
   * height, so it can never reach the reset button above it.
   */
  toastLaneTop: 138,
  /**
   * the share popover's lane top — below the toast lane. The popover is
   * measured against every live toast card (chrome gate) and must never
   * overlap a notice.
   */
  shareLaneTop: 240,
  /** the gap between the toast lane's bottom and the share lane */
  shareLaneGap: 6,
  /** the hint panel's width (one key + action pair per line fits) */
  helpPanelWidth: 280,
  /**
   * Round-6 (PR #49 comment #6561476001): every px value that claimed to
   * describe RENDERED TEXT is GONE from here — headless FreeType and
   * Windows ClearType render the same woff2 ~42px apart at the hint
   * panel's height, so no fixed maxHeight, derived constant, or per-em
   * fallback can survive both platforms. The panel's height is now
   * min(content, lane), both live-measured from the DOM at open/re-measure
   * (see KeyboardShortcuts.tsx): content = the panel's own unclamped
   * rendered extent (last-child bottom readback), lane = toast ceiling ->
   * cornerControls/cornerRow top (or viewport bottom). Ample lane ->
   * sizes to content, never scrolls; short lane -> caps at the lane and
   * scrolls inside. What remains in CHROME_TUNING is platform-independent
   * only: gaps, lane offsets, min-widths.
   */
  /** each hint-panel row's min-height in em — a LAYOUT floor in em (not a
   *  px claim about any font): keeps rows from collapsing when a rasterizer
   *  reports very short line boxes; the panel's total height is still
   *  measured, never derived from this */
  helpRowMinHeightEm: 1.9,
} as const;
