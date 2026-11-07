/**
 * Pure postcard caption layout (#18/PR #32 blocker): compute the caption band
 * and every baseline from MEASURED font metrics — never a fixed assumption.
 *
 * The first shipped compose used a fixed 170px caption band; on real hardware
 * Pixelify Sans (700 weight) runs taller than assumed, so the fourth stat
 * line's value fell outside the canvas. This module is pure (no DOM) so the
 * layout math is unit-testable: compose measures real metrics via
 * measureText() (or applies generous per-em fallbacks when a browser does
 * not report font bounding boxes) and passes them here.
 */

export interface CaptionMetrics {
  /** measured title font ascent (px above baseline) */
  titleAscent: number;
  /** measured title font descent (px below baseline) */
  titleDescent: number;
  /** measured stat-line font ascent */
  lineAscent: number;
  /** measured stat-line font descent */
  lineDescent: number;
  /** extra breathing room between stat lines (px) */
  lineGap: number;
}

export interface CaptionLayout {
  /** total caption band height, including bottom padding */
  captionH: number;
  /** title baseline y, relative to the caption band's top edge */
  titleBaseline: number;
  /** each stat line's baseline y, relative to the caption band's top edge */
  statBaselines: number[];
  /** true when every line's ink (baseline + descent) fits with padding */
  fits: boolean;
  /** bottom padding actually left below the last line's ink */
  bottomPadding: number;
  /**
   * #67: the seed stamp's box, relative to the caption band's top edge and
   * the card's right edge (right-aligned): { right, top, width, height,
   * labelBaseline, codeBaseline }. Null when no seed stamp is drawn.
   */
  seedStamp: {
    right: number;
    top: number;
    width: number;
    height: number;
    labelBaseline: number;
    codeBaseline: number;
  } | null;
}

/** Fallback metrics when a browser reports no font bounding boxes:
 *  generous multipliers of the font size — enough that even unusually tall
 *  pixel faces fit (the layout still self-verifies via `fits`). */
export function fallbackMetrics(titleSize: number, lineSize: number): CaptionMetrics {
  return {
    titleAscent: titleSize * 1.15,
    titleDescent: titleSize * 0.45,
    lineAscent: lineSize * 1.15,
    lineDescent: lineSize * 0.45,
    lineGap: 10,
  };
}

/**
 * Layout the caption band. Padding is generous and fixed relative to the
 * metrics: top pad before the title, gap between title and stats, and a
 * bottom pad AFTER the last line's lowest ink — the thing that was clipped.
 */
export function computeCaptionLayout(
  metrics: CaptionMetrics,
  statCount: number,
  options?: {
    topPad?: number;
    titleGap?: number;
    bottomPad?: number;
    /** #67: seed stamp metrics — measured stamp-label ascent/descent + code
     *  ascent/descent, the stamp's horizontal padding, and the card's total
     *  width (to right-align the stamp against the border). When omitted the
     *  stamp is not drawn (seedStamp: null). */
    stamp?: {
      cardWidth: number;
      border: number;
      padX: number;
      padTop: number;
      padBottom: number;
      labelAscent: number;
      labelDescent: number;
      gap: number;
      codeAscent: number;
      codeDescent: number;
      stampWidth: number;
    };
  },
): CaptionLayout {
  const topPad = options?.topPad ?? 28;
  const titleGap = options?.titleGap ?? 24;
  const bottomPad = options?.bottomPad ?? 26;

  const titleBaseline = topPad + metrics.titleAscent;
  const statsTop = titleBaseline + metrics.titleDescent + titleGap;
  const lineStride = metrics.lineAscent + metrics.lineDescent + metrics.lineGap;
  const statBaselines: number[] = [];
  for (let i = 0; i < statCount; i++) {
    statBaselines.push(statsTop + i * lineStride + metrics.lineAscent);
  }
  const lowestInk = statBaselines[statBaselines.length - 1] + metrics.lineDescent;
  const baseCaptionH = lowestInk + bottomPad;

  let seedStamp = null;
  let captionH = baseCaptionH;
  if (options?.stamp) {
    const st = options.stamp;
    const height = st.padTop + st.labelAscent + st.labelDescent + st.gap + st.codeAscent + st.codeDescent + st.padBottom;
    // #67 close-out: the stamp is a CONTAINED BOTTOM-RIGHT corner section of
    // the caption band (the postmark reading) — bottom-aligned above the
    // band's bottom pad, right-aligned with a real padX margin from the
    // frame. Never the full-width bottom edge, never flush to the border.
    const top = Math.max(topPad, baseCaptionH - bottomPad - height);
    // the band extends if the stamp is taller than it — the stamp never clips
    captionH = Math.max(baseCaptionH, top + height + bottomPad);
    seedStamp = {
      right: st.cardWidth - st.border - st.padX, // stamp box right edge, padX inside the frame
      top,
      width: st.stampWidth,
      height,
      labelBaseline: top + st.padTop + st.labelAscent,
      codeBaseline: top + st.padTop + st.labelAscent + st.labelDescent + st.gap + st.codeAscent,
    };
  }
  const bottomPadding = captionH - lowestInk;
  return {
    captionH,
    titleBaseline,
    statBaselines,
    fits: bottomPadding >= bottomPad * 0.5,
    bottomPadding,
    seedStamp,
  };
}
