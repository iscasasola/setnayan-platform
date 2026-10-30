/**
 * self-added-pay-ways — "HOW TO PAY THEM", ON THE RECORD OF A SUPPLIER THE COUPLE ADDED. (2026-10-29)
 *
 * Owner, verbatim (29 Oct, the Booked prototype): *"also manually add payment method/s"* · *"via QR or text details"*.
 * Approved in Booked prototype v4: several ways, each a Method ▾ (GCash · Maya · Bank transfer · InstaPay / QR Ph ·
 * Cash · Check · Other) with a photo of their QR and/or the details as text; the couple's Pay sheet lists them (the QR
 * full size, Copy details).
 *
 * Stored on the contact card the couple already owns — `event_manual_vendors.pay_ways` (JSONB) — beside the
 * `payment_method_note` it supersedes on the record card. The QR photo is a private object in the couple's own event
 * folder of the PRIVATE thread-files bucket (`payment-proof/events/<event>/…`, `budgetPaymentProofPolicy`): a QR Ph
 * code ENCODES the account it stands for, so the picture is the identifier — never the public media bucket.
 *
 * 🔒 INERT, LIKE THE NOTE. A way to pay is words and a picture for the couple to read on the day. It moves no money,
 * creates no payment and no due date; nothing that writes a money table reads it
 * (`the-payment-note-is-inert.test.ts` holds `pay_ways` to the same rule as `payment_method_note`). "I paid ₱X" on
 * the Pay sheet is the couple's own record of a payment, written by the Budget's `logPayment` — a different file
 * that never sees these.
 *
 * PURE.
 */

export const PAY_WAY_METHODS = [
  { key: 'gcash', label: 'GCash' },
  { key: 'maya', label: 'Maya' },
  { key: 'bank', label: 'Bank transfer' },
  { key: 'qrph', label: 'InstaPay / QR Ph' },
  { key: 'cash', label: 'Cash' },
  { key: 'check', label: 'Check' },
  { key: 'other', label: 'Other' },
] as const;

export type PayWayMethod = (typeof PAY_WAY_METHODS)[number]['key'];

export const PAY_WAYS_MAX = 8;
export const PAY_WAY_DETAILS_MAX = 400;

/** The form carried the "How to pay them" editor — so an emptied list is saved as empty, not skipped. */
export const PAY_WAYS_PRESENT_FIELD = 'pay_ways_present';

/** One way as stored. `qr` is the private `r2://` ref, or null. */
export type StoredPayWay = { method: PayWayMethod; details: string | null; qr: string | null };

/** One way as the record card and the Pay sheet draw it — the QR presigned for this viewer. */
export type PayWayView = StoredPayWay & { qrUrl: string | null };

export function payWayLabel(method: string): string {
  return PAY_WAY_METHODS.find((m) => m.key === method)?.label ?? 'Other';
}

function isMethod(v: unknown): v is PayWayMethod {
  return typeof v === 'string' && PAY_WAY_METHODS.some((m) => m.key === v);
}

/** The stored column, read defensively — a malformed entry is left out, never guessed at. */
export function readStoredPayWays(raw: unknown): StoredPayWay[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((e): StoredPayWay[] => {
    if (!e || typeof e !== 'object') return [];
    const w = e as Record<string, unknown>;
    if (!isMethod(w.method)) return [];
    const details = typeof w.details === 'string' && w.details.trim() ? w.details : null;
    const qr = typeof w.qr === 'string' && w.qr.startsWith('r2://') ? w.qr : null;
    if (!details && !qr) return [];
    return [{ method: w.method, details, qr }];
  });
}

export type ParsedPayWays = { ok: true; ways: StoredPayWay[] } | { ok: false; message: string };

/**
 * The ways the record card posted (`pay_way_method` / `pay_way_details` / `pay_way_qr`, one each per way, in order).
 * `qrAllowed` is the caller's check that a QR ref is this event's own private object — a ref that fails it is
 * REFUSED (named), never silently dropped: dropping it would save the way without the picture the couple just added.
 * A way with neither details nor a QR is a row left blank, and is left out.
 */
export function parsePostedPayWays(
  fd: { getAll(name: string): unknown[] },
  qrAllowed: (ref: string) => boolean,
): ParsedPayWays {
  const methods = fd.getAll('pay_way_method');
  const details = fd.getAll('pay_way_details');
  const qrs = fd.getAll('pay_way_qr');
  const ways: StoredPayWay[] = [];
  for (let i = 0; i < methods.length; i += 1) {
    const m = methods[i];
    const d = typeof details[i] === 'string' ? (details[i] as string).trim() : '';
    const q = typeof qrs[i] === 'string' ? (qrs[i] as string).trim() : '';
    if (!d && !q) continue;
    if (!isMethod(m)) return { ok: false, message: 'Pick how they are paid for every way you added.' };
    if (d.length > PAY_WAY_DETAILS_MAX) return { ok: false, message: `Keep each way's details under ${PAY_WAY_DETAILS_MAX} characters.` };
    if (q && !qrAllowed(q)) return { ok: false, message: 'Their QR picture did not upload properly — add it again.' };
    ways.push({ method: m, details: d || null, qr: q || null });
  }
  if (ways.length > PAY_WAYS_MAX) return { ok: false, message: `A record can hold at most ${PAY_WAYS_MAX} ways to pay.` };
  return { ok: true, ways };
}

/** The closed fold's one line — "GCash · Bank transfer", or null when none is added. */
export function payWaysSummary(ways: ReadonlyArray<{ method: string }>): string | null {
  return ways.length ? ways.map((w) => payWayLabel(w.method)).join(' · ') : null;
}

/**
 * The record's ways — and, when there are none yet but the older free-text note exists, that note as ONE "Other" way,
 * so a couple who wrote "GCash 0917 …" in the workspace sees it here instead of an empty list (lose nothing).
 */
export function waysOrNote(ways: StoredPayWay[], note: string | null | undefined): StoredPayWay[] {
  if (ways.length > 0) return ways;
  const n = (note ?? '').trim();
  return n ? [{ method: 'other', details: n.slice(0, PAY_WAY_DETAILS_MAX), qr: null }] : [];
}

/** Where the record card files a supplier's QR — the event's own private payment folder (`budgetPaymentProofPolicy`). */
export function payWayQrPrefix(eventId: string): string {
  return `payment-proof/events/${eventId}/supplier-pay-qr`;
}
