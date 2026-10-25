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
} as const;
