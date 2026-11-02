/**
 * Postcard compose (#18 / PR #32 review + blocker fix): turn the bare meadow
 * capture into a real postcard before export — themed chunky border, a
 * heading-role (Silkscreen, round 5) title "Greetings from Meadowlight",
 * and the four stat lines in the same organized form as the hover strip.
 *
 * Canvas 2D does NOT inherit @font-face — the font must be explicitly
 * loaded (document.fonts.load) and awaited before fillText, or the title
 * silently renders in a fallback font on the PNG while the DOM looks fine.
 *
 * BLOCKER FIX (PR #32 review): the caption band height is now COMPUTED from
 * real font metrics (measureText actualBoundingBoxAscent/Descent, generous
 * per-em fallback when a browser reports none) via the pure
 * postcardLayout module — the old fixed 170px band clipped the fourth stat
 * line's value on real-GPU exports (the pixel font runs taller than
 * assumed). Layout is measured, never assumed.
 */
import { theme } from '../ui/theme';
import { TYPOGRAPHY } from '../data/typography';
import { useLocale } from './locale';
import { encodeSeedCode } from './seedCode';
import { usePlacementStore } from '../render/placementStore';
import {
  computeCaptionLayout,
  fallbackMetrics,
  type CaptionMetrics,
} from './postcardLayout';

export interface PostcardStat {
  label: string;
  value: string;
}

/** #67: the seed stamp — microcopy label + the share code, in the heading role */
export interface PostcardSeed {
  label: string;
  code: string;
}

// the postcard follows the app's typography roles — title in the
// HEADING role (Jersey 25, session-10 pick), stat lines in the BODY role (Nunito) —
// one source (data/typography.ts), so the PNG matches the DOM hierarchy
const FONT_FAMILY = TYPOGRAPHY.body.family + ', monospace';
const TITLE_FAMILY = TYPOGRAPHY.heading.family + ', monospace';
const TITLE_SIZE = 44;
const LINE_SIZE = 20;
const STAMP_LABEL_SIZE = 13;
const STAMP_CODE_SIZE = 15;

/** Await the self-hosted faces so fillText uses them, not a fallback.
 *  Race with a timeout: a hung load (offline edge case) must never stall the
 *  export — the card composes with whatever face is available. */
async function ensureFontsLoaded(): Promise<boolean> {
  const load = Promise.all([
    document.fonts.load(`700 ${TITLE_SIZE}px ${TITLE_FAMILY}`),
    document.fonts.load(`500 ${LINE_SIZE}px ${FONT_FAMILY}`),
    document.fonts.load(`400 ${LINE_SIZE}px ${FONT_FAMILY}`),
    document.fonts.load(`700 ${STAMP_LABEL_SIZE}px ${FONT_FAMILY}`),
    document.fonts.load(`700 ${STAMP_CODE_SIZE}px ${TITLE_FAMILY}`),
  ]).then(() => true);
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000));
  try {
    return await Promise.race([load, timeout]);
  } catch {
    // fonts API unavailable: fillText falls back — the card still composes
    return false;
  }
}

/**
 * Measure the real ascent/descent of the two caption fonts as rendered by
 * THIS canvas. Falls back to generous per-em values when the browser does
 * not report actualBoundingBox metrics (headless shells, older engines).
 */
function measureMetrics(ctx: CanvasRenderingContext2D): CaptionMetrics {
  const measured = (font: string, text: string) => {
    ctx.font = font;
    const m = ctx.measureText(text);
    const ascent = (m as TextMetrics).actualBoundingBoxAscent;
    const descent = (m as TextMetrics).actualBoundingBoxDescent;
    return { ascent, descent };
  };
  const title = measured(`700 ${TITLE_SIZE}px ${TITLE_FAMILY}`, 'Greetings from Meadowlight');
  const line = measured(`700 ${LINE_SIZE}px ${FONT_FAMILY}`, 'Nature planted —');
  const fb = fallbackMetrics(TITLE_SIZE, LINE_SIZE);
  const num = (v: number | undefined, fbv: number) =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fbv;
  return {
    titleAscent: num(title.ascent, fb.titleAscent),
    titleDescent: num(title.descent, fb.titleDescent),
    lineAscent: num(line.ascent, fb.lineAscent),
    lineDescent: num(line.descent, fb.lineDescent),
    lineGap: fb.lineGap,
  };
}

/**
 * Compose the card. capturePng is a data URL from renderer.domElement
 * (postcard capture path, composer-aware). Returns a new PNG data URL.
 */
export async function composePostcard(
  capturePng: string,
  stats: PostcardStat[],
  seed?: PostcardSeed,
): Promise<string | null> {
  const img = await loadImage(capturePng);
  if (!img) return null;
  await ensureFontsLoaded();

  // card geometry: border frame + capture + caption band (computed, not fixed)
  const border = 24;
  const canvas = document.createElement('canvas');
  canvas.width = img.width + border * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const metrics = measureMetrics(ctx);
  // #67: measure the stamp's own fonts and width, pass to the layout so the
  // stamp box is computed from real metrics, never assumed
  let stampOpts: Parameters<typeof computeCaptionLayout>[2] extends infer O ? O : never;
  if (seed) {
    ctx.font = `700 ${STAMP_LABEL_SIZE}px ${FONT_FAMILY}`;
    const labelW = ctx.measureText(seed.label.toUpperCase()).width;
    ctx.font = `700 ${STAMP_CODE_SIZE}px ${TITLE_FAMILY}`;
    const codeW = ctx.measureText(seed.code).width;
    const mLabel = ctx.measureText(seed.label.toUpperCase());
    const mCode = ctx.measureText(seed.code);
    const fb = fallbackMetrics(STAMP_LABEL_SIZE, STAMP_CODE_SIZE);
    const num = (v: number | undefined, fbv: number) =>
      typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fbv;
    stampOpts = {
      stamp: {
        cardWidth: canvas.width,
        border,
        padX: 10,
        padTop: 8,
        padBottom: 8,
        labelAscent: num((mLabel as TextMetrics).actualBoundingBoxAscent, fb.titleAscent),
        labelDescent: num((mLabel as TextMetrics).actualBoundingBoxDescent, fb.titleDescent),
        gap: 4,
        codeAscent: num((mCode as TextMetrics).actualBoundingBoxAscent, fb.lineAscent),
        codeDescent: num((mCode as TextMetrics).actualBoundingBoxDescent, fb.lineDescent),
        stampWidth: Math.max(labelW, codeW) + 20,
      },
    };
  }
  const layout = computeCaptionLayout(metrics, stats.length, stampOpts);
  canvas.height = img.height + border * 2 + layout.captionH;

  // parchment card base + honey chunky border (the theme's panel language)
  ctx.fillStyle = theme.color.panelSolid;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = theme.color.honey;
  ctx.lineWidth = theme.border.chunky;
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, canvas.width - ctx.lineWidth, canvas.height - ctx.lineWidth);

  // meadow capture
  ctx.drawImage(img, border, border);

  // thin inner frame around the capture, echoing the panel border
  ctx.strokeStyle = theme.color.honeyDark;
  ctx.lineWidth = theme.border.chunk;
  ctx.strokeRect(border - 4, border - 4, img.width + 8, img.height + 8);

  // caption band: everything positioned relative to the band's top edge
  const bandTop = border + img.height;
  const captionX = border;

  // title (700 face, measured baseline)
  ctx.fillStyle = theme.color.text;
  ctx.font = `700 ${TITLE_SIZE}px ${TITLE_FAMILY}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Greetings from Meadowlight', captionX, bandTop + layout.titleBaseline);

  // stat lines: bold label + value, one per line, measured baselines
  ctx.font = `700 ${LINE_SIZE}px ${FONT_FAMILY}`;
  const labelW = Math.max(...stats.map((s) => ctx.measureText(`${s.label} —`).width));
  stats.forEach((s, i) => {
    const y = bandTop + layout.statBaselines[i];
    ctx.fillStyle = theme.color.textSoft;
    ctx.font = `700 ${LINE_SIZE}px ${FONT_FAMILY}`;
    ctx.fillText(`${s.label} —`, captionX, y);
    ctx.fillStyle = theme.color.text;
    ctx.font = `400 ${LINE_SIZE}px ${FONT_FAMILY}`;
    ctx.fillText(s.value, captionX + labelW + 10, y);
  });

  // #67: the seed stamp — a designed signature in the caption band's top-right
  // corner (postmark/stamp reading, not a debug string): a rotated dashed
  // frame, the microcopy label in the body role, the share code in the
  // HEADING role (Jersey 25), both measured and placed by the layout
  if (seed && layout.seedStamp) {
    const st = layout.seedStamp;
    const stampX = canvas.width - border - st.width;
    const stampY = bandTop + st.top;
    ctx.save();
    ctx.translate(stampX + st.width / 2, stampY + st.height / 2);
    ctx.rotate(-0.06); // a gentle postmark tilt
    ctx.translate(-(stampX + st.width / 2), -(stampY + st.height / 2));
    // dashed stamp frame
    ctx.strokeStyle = theme.color.honeyDark;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(stampX, stampY, st.width, st.height);
    ctx.setLineDash([]);
    // microcopy label (body role, letterspaced caps)
    ctx.fillStyle = theme.color.textSoft;
    ctx.font = `700 ${STAMP_LABEL_SIZE}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(seed.label.toUpperCase(), stampX + 10, bandTop + st.labelBaseline);
    // the share code (heading role)
    ctx.fillStyle = theme.color.text;
    ctx.font = `700 ${STAMP_CODE_SIZE}px ${TITLE_FAMILY}`;
    ctx.fillText(seed.code, stampX + 10, bandTop + st.codeBaseline);
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}

/** #67: the seed stamp content for the composed card — locale-aware label +
 * the live share code, read from the stores (never a hook — this runs in the
 * click-handler path, same rule as #60). */
export function postcardSeedText(): PostcardSeed {
  const s = usePlacementStore.getState();
  const t = useLocale.getState().t();
  return { label: t.postcardSeedStamp, code: encodeSeedCode(s.worldSeed, s.items) };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
