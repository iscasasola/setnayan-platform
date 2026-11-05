/**
 * The Papic "develop" worker — the event look, off the page's thread.
 *
 * Receives one frame's RGBA pixels (transferred, not copied), runs the SAME
 * pass the camera always ran (`applyPapicStylePixels`, lib/papic-photo-styles.ts),
 * and transfers them back. On a phone that pass is long enough to freeze the
 * page; here the camera stays pressable while it runs.
 */
import { applyPapicStylePixels, type PapicStyle } from '@/lib/papic-photo-styles';

type DevelopRequest = { id: number; buffer: ArrayBuffer; w: number; h: number; style: PapicStyle };

self.onmessage = (e: MessageEvent<DevelopRequest>) => {
  const { id, buffer, w, h, style } = e.data;
  try {
    applyPapicStylePixels(new Uint8ClampedArray(buffer), w, h, style);
    (self as unknown as Worker).postMessage({ id, buffer, ok: true }, [buffer]);
  } catch {
    (self as unknown as Worker).postMessage({ id, buffer, ok: false }, [buffer]);
  }
};
