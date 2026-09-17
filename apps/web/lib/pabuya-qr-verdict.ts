import { isQrPhPayload } from '@/lib/emv-qr';
import type { EgiftMethodKind } from '@/lib/egift-kinds';

/**
 * lib/pabuya-qr-verdict.ts — is this image usable as a gift QR? (PURE)
 *
 * ── THE PROBLEM ────────────────────────────────────────────────────────────
 * A couple could upload ANY image as their e-gift QR. Nothing checked that it
 * decoded, let alone that it was a QR Ph code — so the first proof that an
 * upload was unusable would be a guest's GCash saying "invalid QR" at the
 * wedding. The upload is the only moment anybody can still fix it.
 *
 * ⚠ CORRECTION 2026-09-17 — THE EXAMPLE THIS DOCBLOCK CITED WAS FALSE, and it
 * was written by the same session that later disproved it. It said the owner's
 * own event carried `IMG_4424.jpg`, "a phone photo", as if that file were the
 * defect. It is a phone screenshot of a bank app, and it is a **perfectly valid
 * QR Ph code**: decoded with this repo's own tools it passes `verifyCrc` and
 * `isQrPhPayload`, carries `com.p2pqrpay` · `BNORPHMMXXX` · a 12-digit account
 * matching the row's stored handle, tag 53 = 608, tag 01 = 11 (static, correct
 * for a gift). The owner's "invalid QR" in GCash came from scanning a LINK QR
 * that had been generated for him by mistake — not from his own code.
 *
 * 🔑 THE FEATURE IS STILL RIGHT; THE STORY WAS NOT. Nothing validated uploads,
 * and that gap is real whether or not this particular file exercised it. But a
 * docblock that invents a victim is the same disease as a comment that states
 * an unmeasured fact — and this one sat in the file whose entire subject is
 * refusing to trust an image without decoding it.
 *
 * ── WHY THE VERDICT IS PURE AND THE DECODING IS NOT ────────────────────────
 * 🔑 Reading pixels needs `sharp` + `jsqr` and therefore a server module, and a
 * guard over a `server-only` module can only GREP — which passes while the
 * thing it names does nothing. So the half that can be got wrong (which rails
 * are held to the standard, and what each outcome MEANS) lives here, with no
 * I/O, and its test EXECUTES every combination.
 *
 * `lib/qr-decode.ts` is deliberately shared and this verdict deliberately is
 * not — that module's own docblock sets the pattern: the expensive two-scale
 * decode is written once, and what counts as a violation stays with the
 * surface that owns the question. The website guard allows any non-funnel QR;
 * the mood-board gallery rejects every QR; this one demands QR Ph on the rails
 * where QR Ph is the standard. Three verdicts, one decoder.
 */

/**
 * The rails where QR Ph is the interoperable standard, so an image claiming to
 * be a payment QR is checked against it.
 *
 * ⚖ `paypal` and `other` are DELIBERATELY ABSENT, and widening this list is a
 * product decision, not a tidy-up. A PayPal.me QR is a URL QR and is CORRECT
 * for its rail; `other` exists precisely for the destination we did not think
 * of. Holding either to QR Ph would refuse a working code — the same mistake
 * as the account-number ruling, where gating the bank first and the wallet only
 * when asked was the right order.
 */
export const QR_PH_RAILS: readonly EgiftMethodKind[] = ['gcash', 'maya', 'bank'];

export function railExpectsQrPh(kind: EgiftMethodKind): boolean {
  return QR_PH_RAILS.includes(kind);
}

export type PabuyaQrVerdict = { ok: true } | { ok: false; error: string };

const OK: PabuyaQrVerdict = { ok: true };

/**
 * Decide whether an uploaded gift-QR image may be saved.
 *
 * @param kind        the rail the couple chose
 * @param decoded     the payload the decoder read, or null if it read nothing
 * @param decoderRan  whether the decode attempt actually COMPLETED. False means
 *                    we could not fetch or process the bytes at all.
 *
 * ⚠ FAIL-OPEN ON INFRASTRUCTURE, FAIL-CLOSED ON A VERDICT — and the two are
 * not the same fact. `decoded === null` with `decoderRan === true` is a real
 * finding: two scales and both inversions found no QR, so a guest's phone will
 * not find one either. `decoderRan === false` is us failing, not the couple,
 * and it must never block their save — the same posture
 * `vendorQrGuardRejects` documents ("a decode hiccup must never block an
 * honest vendor's save"). Collapsing them would turn an R2 outage into "your
 * QR is broken", which is a lie told to somebody who cannot act on it.
 */
export function pabuyaQrVerdict(args: {
  kind: EgiftMethodKind;
  decoded: string | null;
  decoderRan: boolean;
}): PabuyaQrVerdict {
  const { kind, decoded, decoderRan } = args;

  if (!railExpectsQrPh(kind)) return OK;
  if (!decoderRan) return OK;

  if (decoded === null) {
    return {
      ok: false,
      error:
        'We couldn’t find a QR code in that image. Guests scan this to pay you, ' +
        'so it has to be the QR itself — not a photo of a screen at an angle, ' +
        'and not a screenshot with the code cut off. Save the QR straight from ' +
        'your banking app and upload that. You can also skip the image and just ' +
        'give your account name and number.',
    };
  }

  if (!isQrPhPayload(decoded)) {
    return {
      ok: false,
      error:
        'That image is a QR code, but not a QR Ph payment code — GCash, Maya ' +
        'and the banking apps will refuse it. The one you need comes from your ' +
        'own banking app’s receive/QR screen (in BDO that is BDO Pay). Upload ' +
        'that one, or skip the image and just give your account name and number.',
    };
  }

  return OK;
}
