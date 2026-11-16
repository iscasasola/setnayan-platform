/**
 * lib/photo-mark-qr.ts — THE PHOTO-MARK QR, AS A MODULE GRID (owner 2026-11-15: "the photo-mark QR goes on every
 * shop's photos, verified or not"). It encodes https://www.setnayan.com/{slug}?via=photo at error level M.
 *
 * 🏷 NO ?src TAG (owner 16 Nov, DECISION_LOG b95998b3: "The qr codes on photos will have the no tag. Because this is
 * from setnayan"). A scan off a photo is Setnayan-sourced → shop_page → the booking fee applies. It is the plain
 * `myPageUrl` page + `?via=photo` (DECISION_LOG b8d39503 — which material), NEVER `ownPageUrl`
 * (lib/supplier-qr-codes.ts), even though the shop's logo sits beside it — the shop's own QR, door sticker and Share
 * link stay ?src=own. Held by the photo-mark guard §5b.
 *
 * 🔒 SERVER SIDE ONLY BY USE: it is called from `shopMarkFromRow` (`lib/supplier-mark-spec.server.ts`), which hands
 * the grid to both painters inside the mark's spec. The browser therefore never loads a QR encoder — the bundle
 * (202.3 KB) carries none — and the browser and the server can never draw two different codes.
 */
import QRCode from 'qrcode';
import type { MarkQr } from './photo-mark-geometry';
import { markQrUrl } from './watermark-text';

/** The QR for a shop's address — rows of columns, true = a dark module, no quiet zone (the painters add it). */
export function markQr(slug: string): MarkQr {
  const url = markQrUrl(slug);
  const q = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const n = q.modules.size;
  const modules: boolean[][] = [];
  for (let r = 0; r < n; r += 1) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c += 1) row.push(Boolean(q.modules.get(r, c)));
    modules.push(row);
  }
  return { url, modules };
}
