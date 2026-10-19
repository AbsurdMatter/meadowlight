/**
 * Postcard compose (#18 / PR #32 review): turn the bare meadow capture into a
 * real postcard before export — themed chunky border, a Pixelify Sans title
 * "Greetings from Meadowlight", and the four stat lines in the same
 * organized form as the hover strip.
 *
 * Canvas 2D does NOT inherit @font-face — the font must be explicitly
 * loaded (document.fonts.load) and awaited before fillText, or the title
 * silently renders in a fallback font on the PNG while the DOM looks fine.
 */
import { theme } from '../ui/theme';

export interface PostcardStat {
  label: string;
  value: string;
}

const FONT_FAMILY = "'Pixelify Sans', monospace";

/** Await the self-hosted faces so fillText uses them, not a fallback.
 *  Race with a timeout: a hung load (offline edge case) must never stall the
 *  export — the card composes with whatever face is available. */
async function ensureFontsLoaded(): Promise<boolean> {
  const load = Promise.all([
    document.fonts.load(`700 48px ${FONT_FAMILY}`),
    document.fonts.load(`500 20px ${FONT_FAMILY}`),
    document.fonts.load(`400 20px ${FONT_FAMILY}`),
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
 * Compose the card. capturePng is a data URL from renderer.domElement
 * (postcard capture path, composer-aware). Returns a new PNG data URL.
 */
export async function composePostcard(
  capturePng: string,
  stats: PostcardStat[],
): Promise<string | null> {
  const img = await loadImage(capturePng);
  if (!img) return null;
  const fontsOk = await ensureFontsLoaded();

  // card geometry: border frame + capture + caption band
  const border = 24;
  const captionH = 170;
  const w = img.width + border * 2;
  const h = img.height + border * 2 + captionH;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // parchment card base + honey chunky border (the theme's panel language)
  ctx.fillStyle = theme.color.panelSolid;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = theme.color.honey;
  ctx.lineWidth = theme.border.chunky;
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);

  // meadow capture
  ctx.drawImage(img, border, border);

  // thin inner frame around the capture, echoing the panel border
  ctx.strokeStyle = theme.color.honeyDark;
  ctx.lineWidth = theme.border.chunk;
  ctx.strokeRect(border - 4, border - 4, img.width + 8, img.height + 8);

  // title
  ctx.fillStyle = theme.color.text;
  ctx.font = `700 44px ${FONT_FAMILY}`;
  ctx.textBaseline = 'top';
  const title = 'Greetings from Meadowlight';
  const titleX = border;
  const titleY = border + img.height + 28;
  ctx.fillText(title, titleX, titleY);

  // stat lines, one per line: bold label + warm value (like the strip)
  const lineH = 30;
  const startY = titleY + 62;
  ctx.font = `700 20px ${FONT_FAMILY}`;
  const labelW = Math.max(
    ...stats.map((s) => (fontsOk ? ctx.measureText(s.label + ' —').width : 110)),
  );
  stats.forEach((s, i) => {
    const y = startY + i * lineH;
    ctx.fillStyle = theme.color.textSoft;
    ctx.font = `700 20px ${FONT_FAMILY}`;
    ctx.fillText(`${s.label} —`, border, y);
    ctx.fillStyle = theme.color.text;
    ctx.font = `400 20px ${FONT_FAMILY}`;
    ctx.fillText(s.value, border + labelW + 10, y);
  });

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
