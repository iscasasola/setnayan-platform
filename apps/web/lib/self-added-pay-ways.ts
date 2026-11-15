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
 * 🏦 THE SUPPLIER'S OWN SHAPE (owner 2026-11-13: *"the payment method information. either QR or account type, account
 * name and account number or both"*). A way now carries the SAME fields, under the SAME names, as a supplier's own
 * published destination (`vendor_payment_methods`, Your details › How clients pay you): `provider` (the account type,
 * from the supplier's own `PAYMENT_PROVIDERS` list), `account_name`, `account_number`, and the QR. So on the claim door
 * the supplier confirms these and they are saved, unchanged in shape, through the shipped `addPaymentMethod`. The old
 * free-text `details` is still read (ways saved before this), never written by the add sheet.
 *
 * PURE.
 */
import { PAYMENT_PROVIDERS, type CoupleFacingMethod } from './vendor-payment-methods';

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

/** The supplier's own account-type list (`vendor_payment_methods.provider`) — BDO · GCash · Maya · BPI · … · Other. */
export const PAY_WAY_PROVIDERS = PAYMENT_PROVIDERS;
export const PAY_WAY_ACCOUNT_NAME_MAX = 96;
export const PAY_WAY_ACCOUNT_NUMBER_MAX = 64;

/**
 * One way as stored. `qr` is the private `r2://` ref, or null. `provider` · `account_name` · `account_number` are the
 * supplier's own field names (`vendor_payment_methods`); a way saved before them has only `details`.
 */
export type StoredPayWay = {
  method: PayWayMethod;
  details: string | null;
  qr: string | null;
  provider?: string | null;
  account_name?: string | null;
  account_number?: string | null;
};

/** The way's method, from the account type picked (the record's older Method ▾ keys, so every reader still reads it). */
export function methodForProvider(provider: string | null | undefined, hasQr: boolean): PayWayMethod {
  if (provider === 'GCash') return 'gcash';
  if (provider === 'Maya') return 'maya';
  if (provider === 'Other') return 'other';
  if (provider) return 'bank';
  return hasQr ? 'qrph' : 'other';
}

/** What a way is called on screen — its account type, else its older method word. */
export function payWayName(w: Pick<StoredPayWay, 'method' | 'provider'>): string {
  return w.provider && PAY_WAY_PROVIDERS.includes(w.provider) ? w.provider : payWayLabel(w.method);
}

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
    const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    const account_number = text(w.account_number, PAY_WAY_ACCOUNT_NUMBER_MAX);
    const account_name = text(w.account_name, PAY_WAY_ACCOUNT_NAME_MAX);
    const provider = typeof w.provider === 'string' && PAY_WAY_PROVIDERS.includes(w.provider) ? w.provider : null;
    if (!details && !qr && !account_number) return [];
    return [{ method: w.method, details, qr, ...(account_number ? { provider, account_name, account_number } : {}) }];
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
  const providers = fd.getAll('pay_way_provider');
  const names = fd.getAll('pay_way_account_name');
  const numbers = fd.getAll('pay_way_account_number');
  const at = (list: unknown[], i: number) => (typeof list[i] === 'string' ? (list[i] as string).trim() : '');
  const ways: StoredPayWay[] = [];
  for (let i = 0; i < methods.length; i += 1) {
    const m = methods[i];
    const d = at(details, i);
    const q = at(qrs, i);
    const prov = at(providers, i);
    const accName = at(names, i);
    const accNumber = at(numbers, i);
    if (!d && !q && !accNumber && !accName) continue;
    if (!isMethod(m)) return { ok: false, message: 'Pick how they are paid for every way you added.' };
    if (d.length > PAY_WAY_DETAILS_MAX) return { ok: false, message: `Keep each way's details under ${PAY_WAY_DETAILS_MAX} characters.` };
    if (q && !qrAllowed(q)) return { ok: false, message: 'Their QR picture did not upload properly — add it again.' };
    if (accName && !accNumber && !q && !d) return { ok: false, message: 'Add the account number — or their QR — for each way you added.' };
    if (accName.length > PAY_WAY_ACCOUNT_NAME_MAX || accNumber.length > PAY_WAY_ACCOUNT_NUMBER_MAX)
      return { ok: false, message: 'That account name or number is too long.' };
    const provider = accNumber && PAY_WAY_PROVIDERS.includes(prov) ? prov : null;
    ways.push({
      method: m,
      details: d || null,
      qr: q || null,
      ...(accNumber ? { provider, account_name: accName || null, account_number: accNumber } : {}),
    });
  }
  if (ways.length > PAY_WAYS_MAX) return { ok: false, message: `A record can hold at most ${PAY_WAYS_MAX} ways to pay.` };
  return { ok: true, ways };
}

/** The closed fold's one line — "GCash · Bank transfer", or null when none is added. */
export function payWaysSummary(ways: ReadonlyArray<{ method: string; provider?: string | null }>): string | null {
  return ways.length ? ways.map((w) => (w.provider && PAY_WAY_PROVIDERS.includes(w.provider) ? w.provider : payWayLabel(w.method))).join(' · ') : null;
}

/**
 * A plan with payments needs somewhere to send them (owner 2026-11-13: at least one way only if a payment plan exists;
 * otherwise optional). The sentence the sheet and the save both say.
 */
export const PAY_WAY_NEEDED_WORDS = 'Add how to pay them — their QR, or the account details — since you set a payment plan.';
/**
 * Does the posted plan carry a payment? The SAME rule `addManualSupplier` uses: a named line with an amount or a day.
 * Two named, empty starter lines are no plan.
 */
export function planPostsPayments(fd: { getAll(name: string): unknown[] }): boolean {
  const labels = fd.getAll('plan_label');
  const filled = (k: string, i: number) => {
    const v = fd.getAll(k)[i];
    return typeof v === 'string' && v.trim().length > 0;
  };
  return labels.some((l, i) => typeof l === 'string' && l.trim().length > 0 && (filled('plan_value', i) || filled('plan_anchor', i)));
}

export function payWaysNeeded(planHasPayments: boolean, ways: ReadonlyArray<unknown>): boolean {
  return planHasPayments && ways.length === 0;
}

/**
 * The couple's ways in the SUPPLIER'S couple-facing shape (`CoupleFacingMethod`), so the record card shows them in the
 * shipped VendorDirectPay sheet — its look and its always-on disclosure — never a second drawing. A way with both an
 * account and a QR is the two destinations the supplier would publish: a Bank / e-wallet row and a QR row.
 */
export function payWaysAsDirectPay(ways: ReadonlyArray<PayWayView>): CoupleFacingMethod[] {
  const out: CoupleFacingMethod[] = [];
  ways.forEach((w, i) => {
    const base = {
      label: payWayName(w),
      provider: w.provider ?? null,
      account_name: null as string | null,
      account_number: null as string | null,
      decoded_destination: null,
      link_url: null,
      link_domain: null,
      note: null as string | null,
      is_primary: i === 0,
      qr_display_url: null as string | null,
    };
    if (w.account_number || (!w.qr && w.details)) {
      out.push({
        ...base,
        payment_method_id: `own-${i}-bank`,
        method_type: 'bank',
        account_name: w.account_name ?? null,
        account_number: w.account_number ?? null,
        note: w.account_number ? null : w.details,
      });
    }
    if (w.qr && w.qrUrl) {
      out.push({ ...base, payment_method_id: `own-${i}-qr`, method_type: 'qr', is_primary: i === 0 && !w.account_number, qr_display_url: w.qrUrl, note: w.account_number ? null : w.details });
    }
  });
  return out;
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
