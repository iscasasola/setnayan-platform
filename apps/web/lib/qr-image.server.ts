import 'server-only';
import QRCode from 'qrcode';
import { resolveQrAmount } from './qr-amount-truth';

/**
 * lib/qr-image.server.ts — paint the amount-carrying code ON THE SERVER, so it
 * is in the first byte of HTML rather than arriving later.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🚨 WHY THIS MOVED OFF THE BROWSER. `/pay` rendered the minted code with a
 * dynamic `import('qrcode')`, so `minted` was null on every first render and
 * the page fell back to the STATIC merchant image — a real, scannable code
 * that opens the wallet at ₱0 — until the chunk arrived. Owner, 2026-09-20,
 * paying a real ₱837.50 booking fee: *"the amount is not filled up. it only
 * shows 0."*
 *
 * 🔑 A WINDOW IN WHICH THE WRONG CODE IS SCANNABLE IS NOT A LOADING STATE.
 * There is no amount of placeholder cleverness that beats not having the
 * window. The renderer is already a server dependency in seven other places in
 * this app (`lib/qr.ts`, `lib/seating-pdf.ts`, the seating print route…), so
 * nothing new enters the bundle by doing it here.
 *
 * ⚠ IT IS NOT A DATA-URL FACTORY. Nothing is returned unless `mintOrderQr`
 * both minted it AND its identity tags verified byte-identical against the
 * source — see `verifyMintedAgainstSource`. A caller that gets null shows the
 * static code and, because of `lib/qr-amount-truth.ts`, says so.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type MintedQrImage = {
  /** The PNG, inline. */
  dataUrl: string;
  /** The payload it encodes, so a caller can assert on it. */
  payload: string;
};

/**
 * Render a per-charge code for `amountPhp`, or null.
 *
 * `errorCorrectionLevel: 'M'` and a 520px canvas are the settings the browser
 * path used and the owner's wallets were tested against on 2026-07-31; they
 * are carried over unchanged rather than re-chosen, because a scan that fails
 * on a phone in a venue is not something a test here would ever see.
 */
export async function mintedQrImage(
  sourcePayload: string | null | undefined,
  amountPhp: number,
): Promise<MintedQrImage | null> {
  const verdict = resolveQrAmount(sourcePayload, amountPhp);
  if (!verdict.carriesAmount) return null;
  try {
    const dataUrl = await QRCode.toDataURL(verdict.payload, {
      margin: 1,
      width: 520,
      errorCorrectionLevel: 'M',
    });
    return { dataUrl, payload: verdict.payload };
  } catch (e) {
    // A renderer failure is not a reason to show a code that pays ₱0 while
    // claiming otherwise — the caller falls back and changes its words.
    console.error('[qr-image] could not render a minted code', e);
    return null;
  }
}
