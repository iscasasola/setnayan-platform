'use client';

// lib/papic-upload/develop.ts — bake the event look into a frame without
// freezing the page. The pixel pass runs in a Web Worker when the browser has
// one; on the page itself otherwise (exactly what the camera always did).

import { applyPapicStyle, type PapicStyle } from '@/lib/papic-photo-styles';

let worker: Worker | null | undefined;
let seq = 0;
const waiting = new Map<number, (r: { buffer: ArrayBuffer; ok: boolean }) => void>();

function developWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./develop.worker.ts', import.meta.url));
    worker.onmessage = (e: MessageEvent<{ id: number; buffer: ArrayBuffer; ok: boolean }>) => {
      const done = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      done?.({ buffer: e.data.buffer, ok: e.data.ok });
    };
    worker.onerror = () => {
      worker = null;
      for (const [, done] of waiting) done({ buffer: new ArrayBuffer(0), ok: false });
      waiting.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** Apply the look to the canvas in place. Resolves when the pixels are back. */
export async function developCanvas(canvas: HTMLCanvasElement, style: PapicStyle): Promise<void> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const wk = developWorker();
  if (!ctx || !w || !h || !wk) {
    applyPapicStyle(canvas, style);
    return;
  }
  const image = ctx.getImageData(0, 0, w, h);
  const id = ++seq;
  const result = await new Promise<{ buffer: ArrayBuffer; ok: boolean }>((resolve) => {
    waiting.set(id, resolve);
    wk.postMessage({ id, buffer: image.data.buffer, w, h, style }, [image.data.buffer]);
  });
  if (!result.ok || result.buffer.byteLength !== w * h * 4) {
    // The worker failed: the frame's pixels are still on the canvas (getImageData
    // copied them), so do the pass here instead.
    applyPapicStyle(canvas, style);
    return;
  }
  ctx.putImageData(new ImageData(new Uint8ClampedArray(result.buffer), w, h), 0, 0);
}
