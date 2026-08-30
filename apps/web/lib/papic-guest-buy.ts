import type { PapicOneTier } from './papic-one';
import type { PapicPassTier } from './papic-pass-tiers';

/**
 * apps/web/lib/papic-guest-buy.ts
 *
 * GUESTS CAN BUY PAPIC — the pure half (owner-locked 2026-07-29).
 *
 * Everything in this file is a total function over plain data: no Supabase, no
 * `server-only`, no I/O. The I/O half lives in app/papic/buy/actions.ts. The
 * split is the point — every refusal that matters here (a foreign camera, a
 * rung that is not on sale, a second pending order) is a decision a unit test
 * can pin, rather than something you have to stand up a database to believe.
 *
 * ── WHAT A GUEST MAY BUY ──────────────────────────────────────────────────
 *   • POOL TOP-UP — +3,000 / +6,000 / +10,000 into the event's SHARED pool.
 *     Anyone standing at that event may add to the shared pool; it is the
 *     couple's pool, and topping it up is a gift, not a claim on anything.
 *   • ONE RELOAD  — 50 / 100 shots onto THE CAMERA THEY ARE HOLDING. Never
 *     another camera. See `resolveGuestReloadTarget` for why that is a hard
 *     refusal and not a silent redirect.
 *
 * No new rungs and no new prices: both ladders are READ from the same
 * admin-editable tables the host's own pickers read (`papic_pass_tiers`,
 * `papic_one_tiers`), and the peso figure always comes from
 * `platform_retail_catalog_v2`. This module never contains a price.
 *
 * ── WHAT A GUEST MAY NOT DO ───────────────────────────────────────────────
 * Choose the amount. The client sends a `service_code` — a CHOICE — and the
 * server resolves the points and the price from the catalog. That is the SEC-4
 * invariant ("the browser may choose WHAT; the server decides the peso
 * figure"), and it is the reason `resolveGuestRung` returns points but never
 * touches money.
 */

/** The two shapes a guest purchase can take. Mirrors the DB CHECK. */
export type PapicGuestPurchaseKind = 'pool_topup' | 'one_reload';

/**
 * Who the buyer is. Exactly one of these is resolved server-side per request:
 * a claimed camera seat (the seat-QR surface) or a guest-QR identity (the guest
 * camera). Never both from the client, and never either FROM the client — both
 * are derived from a credential the browser already holds for another purpose.
 */
export type PapicGuestBuyer =
  | { kind: 'seat'; eventId: string; seatId: string }
  | { kind: 'guest'; eventId: string; guestId: string };

/** Minimum length the DB CHECK enforces on `papic_guest_orders.access_token`. */
export const PAPIC_GUEST_ACCESS_TOKEN_MIN_LENGTH = 24;

/** How long a payer name may be before it is a payload rather than a name. */
export const PAPIC_GUEST_PAYER_NAME_MAX = 120;

/**
 * The bearer capability that lets an account-less buyer reach their own order.
 *
 * 32 Crockford-base32 characters from `crypto.getRandomValues` — the same
 * alphabet as `mintPapicReferenceCode`, deliberately FOUR times longer, because
 * the two do opposite jobs. A reference code is a HUMAN-TYPED label that the
 * admin matches against a bank message; it is printed, read aloud and pasted
 * into GCash, so it is short on purpose and must be assumed public. This token
 * is the only thing standing between a stranger and someone else's payment
 * screenshot, so it is never derived from the reference code, the seat token or
 * the event id, and nothing about one order's token says anything about
 * another's.
 */
export function mintPapicGuestAccessToken(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/**
 * PURE. Clean a free-text payer name ("Name for your receipt — optional").
 *
 * Blank → null, and null is a legitimate answer: the whole product promise is
 * that a guest can buy without telling us who they are. Collapsing whitespace
 * and capping the length keeps a receipt line a receipt line; control
 * characters are dropped so a name cannot smuggle a newline into a rendered
 * receipt or an admin table cell.
 */
export function normalisePayerName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    // Control characters go first, so a name cannot smuggle a newline into a
    // rendered receipt or an admin table cell.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PAPIC_GUEST_PAYER_NAME_MAX);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * PURE. Clean a short free-text field the buyer typed (their GCash/BDO
 * reference number). Same cleaning as a payer name — trim, collapse, strip
 * control characters, cap — but named for what it is, because a field called
 * `normalisePayerName` doing double duty is how the wrong cap ends up on the
 * wrong field the next time one of them changes.
 */
export function normaliseShortEntry(raw: unknown): string | null {
  return normalisePayerName(raw);
}

/**
 * The receipt name for an order with no account behind it.
 *
 * Falls back to "Guest of <event>" rather than to the empty string or to
 * "unknown", because a BIR receipt has to say who it was issued to and
 * "someone at the Reyes wedding" is both true and the most specific thing we
 * honestly know. ⚠ Flagged to the accountant for sign-off — documented, not
 * blocked, per the standing interim-payments default.
 */
export function guestReceiptName(
  payerName: string | null,
  eventLabel: string | null,
): string {
  if (payerName && payerName.trim().length > 0) return payerName.trim();
  const label = (eventLabel ?? '').trim();
  return label.length > 0 ? `Guest of ${label}` : 'Guest';
}

// ── the rung ───────────────────────────────────────────────────────────────

export type PapicGuestRung = {
  kind: PapicGuestPurchaseKind;
  serviceCode: string;
  points: number;
};

/**
 * A rung as the buyer sees it: the rung plus its live catalog price and the
 * phrase that describes it.
 *
 * Lives HERE, not in the client component that renders it, because a `'use
 * client'` module must never be the home of shared data or the shapes the
 * server builds — the server component composes these, the client only paints
 * them.
 */
export type PapicGuestOffer = {
  kind: PapicGuestPurchaseKind;
  serviceCode: string;
  points: number;
  pricePhp: number;
  phrase: string;
};

/**
 * PURE. The POOL rungs a guest may buy.
 *
 * `is_topup` rungs are deliberately EXCLUDED. `PAPIC_GUEST_TOPUP` was the
 * repeatable rung from before every rung became repeatable; it is retired, and
 * the threshold this docblock used to cite (`PAPIC_TOPUP_UNLOCK_POINTS`) was an
 * exported constant with ZERO readers, deleted 2026-08-26. The filter stays
 * because the flag still exists and a future rung could set it.
 *
 * The sixteen rungs the owner set (2026-08-26) are exactly the non-topup set,
 * so this reproduces his list WITHOUT hardcoding it — an admin who retires a
 * rung retires it here too, in the same breath, which a literal array would
 * not do.
 */
export function guestPoolRungs(tiers: readonly PapicPassTier[]): PapicGuestRung[] {
  return tiers
    .filter((t) => !t.isTopup && t.points > 0)
    .map((t) => ({ kind: 'pool_topup' as const, serviceCode: t.serviceCode, points: t.points }));
}

/** PURE. The ONE rungs a guest may reload their own camera with. */
export function guestOneRungs(tiers: readonly PapicOneTier[]): PapicGuestRung[] {
  return tiers
    .filter((t) => t.points > 0)
    .map((t) => ({ kind: 'one_reload' as const, serviceCode: t.serviceCode, points: t.points }));
}

export type GuestRungResolution =
  | { ok: true; rung: PapicGuestRung }
  | { ok: false; reason: 'unknown_rung' };

/**
 * PURE. Turn the client's `service_code` CHOICE into a rung, or refuse.
 *
 * The refusal is the interesting half. A code that is not on either live ladder
 * is rejected outright — never defaulted to the cheapest rung, never coerced to
 * the other kind. Defaulting would mean a guest who posted a retired code got
 * charged for something they did not pick; coercing would mean a pool code
 * could be spent as a One reload, quietly moving 3,000 shared shots onto one
 * private camera.
 */
export function resolveGuestRung(
  serviceCode: string,
  poolTiers: readonly PapicPassTier[],
  oneTiers: readonly PapicOneTier[],
): GuestRungResolution {
  const wanted = (serviceCode ?? '').trim();
  if (!wanted) return { ok: false, reason: 'unknown_rung' };
  const all = [...guestPoolRungs(poolTiers), ...guestOneRungs(oneTiers)];
  const rung = all.find((r) => r.serviceCode === wanted);
  return rung ? { ok: true, rung } : { ok: false, reason: 'unknown_rung' };
}

// ── "their own camera only" ────────────────────────────────────────────────

export type GuestReloadTarget =
  | { ok: true; seatId: string }
  | { ok: false; reason: 'not_your_camera' | 'no_camera' };

/**
 * PURE. Which camera a guest's One reload lands on.
 *
 * THE WHOLE SECURITY PROPERTY OF THE ONE RELOAD IS THIS FUNCTION. A guest holds
 * exactly one credential — the seat they claimed by scanning its QR — and the
 * only camera they may top up is that one.
 *
 * `requestedSeatId` therefore is not a lookup key and must never be used as
 * one: it is a CLAIM to be checked against the seat the server already
 * resolved from the credential. When they disagree we refuse, rather than
 * honouring the resolved seat, because a request that names a different camera
 * is not a request we understood — silently charging them for the right camera
 * would be indistinguishable, to the buyer, from us having done what they
 * asked.
 *
 * Absent/blank `requestedSeatId` means "the camera I am holding", which is the
 * only camera on offer, so it resolves to the holder's seat.
 *
 * Note what is NOT delegated here: whether that seat is a Papic One camera at
 * all, and whether it is still live. Both are DB facts the action checks; this
 * function owns only the identity match, so that the identity match has exactly
 * one implementation.
 */
export function resolveGuestReloadTarget(
  requestedSeatId: string | null | undefined,
  holderSeatId: string | null | undefined,
): GuestReloadTarget {
  const holder = (holderSeatId ?? '').trim();
  if (!holder) return { ok: false, reason: 'no_camera' };
  const wanted = (requestedSeatId ?? '').trim();
  if (!wanted) return { ok: true, seatId: holder };
  return wanted === holder
    ? { ok: true, seatId: holder }
    : { ok: false, reason: 'not_your_camera' };
}

// ── "keep them, or give them to the room" (spec § 7b) ──────────────────────

/** What one camera currently holds, and what could still move. */
export type DedicatedShotsStanding = {
  /** Total credits dedicated to this camera (bought + handed out), ever. */
  dedicated: number;
  /** Of those, how many this camera has already shot. Can never come back. */
  spent: number;
  /** dedicated − spent, floored at 0. The only part a release can move. */
  releasable: number;
};

/** PURE. Derive the standing from the two raw numbers a caller reads. */
export function dedicatedShotsStanding(
  dedicated: number,
  spent: number,
): DedicatedShotsStanding {
  const d = Number.isFinite(dedicated) && dedicated > 0 ? Math.floor(dedicated) : 0;
  const s = Number.isFinite(spent) && spent > 0 ? Math.floor(spent) : 0;
  return { dedicated: d, spent: s, releasable: Math.max(0, d - s) };
}

export type GuestReleaseResolution =
  | { ok: true; target: number }
  | { ok: false; reason: 'nothing_to_release' };

/**
 * PURE. Turn "give the unused ones to the room" into the TARGET
 * `papic_dedicate_shots` is called with.
 *
 * There is no amount to type: the whole point of 7b is that what she has
 * already shot stays hers and everything else moves, so the only honest
 * target is her own spend — never a number she chose, which could either
 * strand credits above her spend or (worse) ask the RPC to take back shots
 * that are already gone, which it refuses anyway.
 *
 * `nothing_to_release` when releasable is 0: a camera that is not dedicated,
 * or one that has already spent everything it was ever given, has nothing
 * left to hand over. The caller must not call the RPC in that case — setting
 * an unchanged target is a wasted round trip, not a refusal, but the UI must
 * not offer a button that can only do nothing.
 */
export function resolveGuestRelease(
  standing: DedicatedShotsStanding,
): GuestReleaseResolution {
  return standing.releasable > 0
    ? { ok: true, target: standing.spent }
    : { ok: false, reason: 'nothing_to_release' };
}

// ── one pending order at a time ────────────────────────────────────────────

/**
 * Order statuses that mean "this order is still waiting for money". Mirrors the
 * set `/admin/payments` treats as open. `paid`/`fulfilled`/`cancelled` are
 * settled and must NOT block a fresh purchase — a guest who bought 3,000 shots
 * an hour ago is allowed to buy 3,000 more.
 */
export const PAPIC_GUEST_OPEN_ORDER_STATUSES: readonly string[] = Object.freeze([
  'draft',
  'submitted',
  'awaiting_payment',
]);

/**
 * PURE. Is there already an open order for this buyer at this rung?
 *
 * The anti-flood rule, deliberately the narrowest one that works: ONE open
 * order per (buyer, rung). Narrow, because the alternatives are all worse — a
 * global per-event limit would let one guest lock everybody else out, and a
 * time window would refuse a guest who genuinely mistyped their reference and
 * wants to start over. One-per-rung stops a script minting a thousand rows
 * while leaving every honest sequence (buy 50, then buy 100; buy, abandon, buy
 * the other rung) working.
 */
export function hasOpenGuestOrder(
  rows: readonly { service_code?: string | null; status?: string | null }[],
  serviceCode: string,
): boolean {
  return rows.some(
    (r) =>
      (r.service_code ?? '') === serviceCode &&
      PAPIC_GUEST_OPEN_ORDER_STATUSES.includes(r.status ?? ''),
  );
}

// ── the row + the copy ─────────────────────────────────────────────────────

export type PapicGuestOrderRow = {
  order_id: string;
  event_id: string;
  seat_id: string | null;
  guest_id: string | null;
  purchase_kind: PapicGuestPurchaseKind;
  service_code: string;
  points: number;
  payer_name: string | null;
  access_token: string;
};

/**
 * PURE. The `papic_guest_orders` payload. Mirrors `papicOneOrderRow` in
 * lib/papic-one.ts, and for the same reason: the row an order writes is worth
 * unit-testing without a database, because getting `seat_id` wrong here is how
 * shots land on the wrong camera.
 *
 * Points are SNAPSHOTTED, not looked up later — an admin editing a rung
 * tomorrow must not silently reprice an order already in reconciliation today.
 */
export function papicGuestOrderRow(input: {
  orderId: string;
  buyer: PapicGuestBuyer;
  seatId: string | null;
  kind: PapicGuestPurchaseKind;
  serviceCode: string;
  points: number;
  payerName: string | null;
  accessToken: string;
}): PapicGuestOrderRow {
  return {
    order_id: input.orderId,
    event_id: input.buyer.eventId,
    seat_id: input.seatId,
    guest_id: input.buyer.kind === 'guest' ? input.buyer.guestId : null,
    purchase_kind: input.kind,
    service_code: input.serviceCode,
    points: input.points,
    payer_name: input.payerName,
    access_token: input.accessToken,
  };
}

/**
 * PURE. The order description the admin queue and the buyer both read.
 *
 * Says GUEST out loud. The admin reconciling a ₱1,000 transfer needs to know at
 * a glance that this order has no account behind it — that is why the buyer
 * column is blank, and a description that read like every other Papic order
 * would make the blank look like a bug.
 */
export function guestOrderDescription(rung: PapicGuestRung): string {
  const shots = rung.points.toLocaleString('en-PH');
  return rung.kind === 'pool_topup'
    ? `Papic — guest top-up, ${shots} shots into the event's shared pot`
    : `Papic — guest reload, ${shots} credits for one camera`;
}
