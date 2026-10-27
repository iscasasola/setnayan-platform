import { renderUrlQrSvg } from '@/lib/qr';
import { siteOrigin } from '@/lib/site-origin';
import { checkADateUrl } from '@/lib/check-a-date';

/**
 * THE SHOP'S "CHECK A DATE" CODE (owner 2026-10-28, DECISION_LOG "🔳 ALL OF A SHOP'S QR CODES IN ONE PLACE — PLUS A
 * 'CHECK A DATE' CODE" and "✅📅 CHECK A DATE — APPROVED"): one permanent code whose scan opens
 * `https://<site>/v/<slug>/dates`.
 *
 * Drawn with the app's own `qrcode` library through the SAME renderer the shop's Shortlist ("Anyone") code uses
 * (`renderUrlQrSvg` — level H, quiet zone, ink on cream); never a drawn pattern. `check-a-date-qr.test.ts` renders it,
 * rasterises it and scans it back with `jsqr` to the exact address.
 */
export async function checkADateQr(slug: string, origin: string = siteOrigin()): Promise<{ url: string; svg: string | null }> {
  const url = checkADateUrl(origin, slug);
  const svg = await renderUrlQrSvg(url, 220).catch(() => null);
  return { url, svg };
}
