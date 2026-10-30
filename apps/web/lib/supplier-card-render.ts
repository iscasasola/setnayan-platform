/**
 * lib/supplier-card-render.ts — the supplier's digital card, flattened to the 1080 × 1440 PNG a phone shares.
 *
 * The drawing is `layoutSupplierCard` (lib/supplier-card.ts); the pixels come from `renderPassCardPng`
 * (lib/pass-card-render.ts) — the guest Digital ticket's own flattener, one SVG rasterised by sharp at the density
 * that lands the card on 1080 × 1440, corners transparent. One way a card becomes a picture, not two.
 *
 * The QR is the claim link in black on white with no centre mark: it is not a guest's code (`lib/qr.ts` keeps the
 * Setnayan mark for those), and the prototype's rule is "Code always black on white · so it scans". Level M, like
 * the prototype's.
 *
 * Not `server-only` (sharp and qrcode are dynamic imports) so the Node test runner can render a real card, measure it
 * and decode its QR.
 */
import { renderPassCardPng } from '@/lib/pass-card-render';
import { SUPPLIER_CARD_QR_REF, layoutSupplierCard, type SupplierCardFacts } from '@/lib/supplier-card';

export async function renderSupplierCardPng(facts: SupplierCardFacts, claimUrl: string): Promise<Uint8Array> {
  const QRCode = (await import('qrcode')).default;
  const qr = await QRCode.toBuffer(claimUrl, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 600,
    color: { dark: '#000000', light: '#ffffff' },
  });
  return renderPassCardPng(layoutSupplierCard(facts), {
    [SUPPLIER_CARD_QR_REF]: { bytes: new Uint8Array(qr), mime: 'image/png' },
  });
}
