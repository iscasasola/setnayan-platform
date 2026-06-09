/**
 * Client-side Canvas palette extractor — lifted verbatim from the onboarding
 * mood-board card (Card 15) so the mood-board add-on inspiration board reuses
 * the exact same 6-color extraction. Returns 6 hex strings; pads with cream
 * tones when the image has fewer distinct colors.
 */

const DEFAULT_COLORS = ['#F8F1E7', '#E2D5C0', '#C9A87C', '#9B7A4F', '#5C3A1E', '#2B1810'];

function pad6(values: string[]): string[] {
  const out: string[] = values.slice(0, 6);
  let i = 0;
  while (out.length < 6) {
    out.push(DEFAULT_COLORS[i % DEFAULT_COLORS.length]!);
    i += 1;
  }
  return out.map((v) => v.toUpperCase());
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export function extractPaletteFromImage(img: HTMLImageElement): string[] {
  const SIZE = 100;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return pad6(DEFAULT_COLORS);
  try {
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
  } catch {
    return pad6(DEFAULT_COLORS);
  }
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  } catch {
    return pad6(DEFAULT_COLORS);
  }

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (a < 128) continue;
    if (r > 240 && g > 240 && b > 240) continue;
    if (r < 20 && g < 20 && b < 20) continue;
    const key = `${(r >> 4) << 4}|${(g >> 4) << 4}|${(b >> 4) << 4}`;
    const prior = buckets.get(key);
    if (prior) {
      prior.count += 1;
      prior.r += r;
      prior.g += g;
      prior.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  const picks: string[] = [];
  for (const bucket of sorted) {
    if (picks.length >= 6) break;
    picks.push(rgbToHex(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count));
  }
  return pad6(picks.length > 0 ? picks : DEFAULT_COLORS);
}

export async function extractPaletteFromFile(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const palette = extractPaletteFromImage(img);
      URL.revokeObjectURL(url);
      resolve(palette);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(pad6(DEFAULT_COLORS));
    };
    img.src = url;
  });
}
