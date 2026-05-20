/**
 * SETNAYAN watermark utility.
 *
 * Per owner directive 2026-05-21: every photo posted to the app gets an auto
 * SETNAYAN watermark EXCEPT event photos (Papic captures, Panood recordings,
 * host's wedding photos — those belong to the host). Vendor marketplace
 * photos MUST have watermarks (default-on for IP protection against scraping).
 *
 * V1 approach: client-side Canvas watermarking before upload. Simpler than
 * server-side (no sharp/node-canvas dependency), and fine for V1 since the
 * watermark is a deterrent, not anti-tamper security. Upgrade to server-side
 * sharp.js compositing in V1.x if takedown evasion becomes a real problem.
 */

export type WatermarkOptions = {
  /** Text to render (default 'SETNAYAN') */
  text?: string;
  /** Where to anchor the watermark on the image */
  position?: 'bottom-right' | 'bottom-center' | 'tile';
  /** 0–1 opacity (default 0.45) */
  opacity?: number;
  /** Margin from edges in pixels at the image's native resolution (default 24) */
  margin?: number;
};

const DEFAULT_OPTIONS: Required<WatermarkOptions> = {
  text: 'SETNAYAN',
  position: 'bottom-right',
  opacity: 0.45,
  margin: 24,
};

/**
 * Apply the SETNAYAN watermark to an image file and return a new File ready
 * to upload. Runs entirely client-side via Canvas. Preserves the original
 * format (PNG / JPEG / WebP); falls back to PNG for unknown types.
 */
export async function watermarkFile(file: File, opts: WatermarkOptions = {}): Promise<File> {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  // Original image first
  ctx.drawImage(img, 0, 0);

  // Watermark text
  const fontSize = Math.max(18, Math.round(Math.min(canvas.width, canvas.height) * 0.04));
  ctx.font = `600 ${fontSize}px ui-monospace, "SF Mono", Menlo, monospace`;
  ctx.fillStyle = `rgba(255, 255, 255, ${options.opacity})`;
  ctx.strokeStyle = `rgba(0, 0, 0, ${options.opacity * 0.75})`;
  ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.08));
  ctx.textBaseline = 'alphabetic';

  const text = options.text;
  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const textH = fontSize;
  const m = options.margin;

  if (options.position === 'tile') {
    // diagonal tile — every diagonal stripe gets a watermark, rotated 30°
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.textAlign = 'center';
    const tile = Math.max(textW * 2.5, 220);
    const halfDiag = Math.ceil(Math.hypot(canvas.width, canvas.height) / 2);
    for (let y = -halfDiag; y <= halfDiag; y += tile * 0.6) {
      for (let x = -halfDiag; x <= halfDiag; x += tile) {
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
      }
    }
    ctx.restore();
  } else if (options.position === 'bottom-center') {
    const x = canvas.width / 2;
    const y = canvas.height - m;
    ctx.textAlign = 'center';
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  } else {
    // bottom-right (default)
    const x = canvas.width - m;
    const y = canvas.height - m;
    ctx.textAlign = 'right';
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  const mimeType = preserveMime(file.type);
  const blob = await canvasToBlob(canvas, mimeType);
  const filename = renameForMime(file.name, mimeType);
  return new File([blob], filename, { type: mimeType });
}

// ---- helpers ----

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load image'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('canvas toBlob returned null'));
      },
      mime,
      mime === 'image/jpeg' ? 0.92 : undefined,
    );
  });
}

function preserveMime(originalMime: string): string {
  // Prefer the original mime if it's a known image type we can re-encode
  const supported = ['image/jpeg', 'image/png', 'image/webp'];
  if (supported.includes(originalMime)) return originalMime;
  // AVIF + others fall back to PNG so we don't silently lose quality + format
  return 'image/png';
}

function renameForMime(name: string, mime: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
  return `${base}.${ext}`;
}
