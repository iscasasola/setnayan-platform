/**
 * THE LAUNCH OFFER — the pure half. No database, no `server-only`.
 *
 * ⚖ OWNER, 2026-10-08 (DECISION_LOG, three rows): the first 2,000 platform
 * bookings are fee-free; Pro is free until then and *"will end on the end of
 * that week. since our subscription is a 4 week cycle"*; 50 free Papic credits
 * per booked event; ONE admin page, admin-editable, never hard-coded.
 * ⚖ OWNER, 2026-10-12 ("APPROVE ALL: THE BOOKING-FEE QUESTIONS (14)") #3–#6:
 * the 2,000 counts Setnayan-sourced bookings at fee creation; launch bookings do
 * not use up a supplier's free five; free Pro ends at the end of the 28-day
 * cycle running when the 2,000th booking happens (one platform-wide date, shown
 * in admin); 50 Papic credits once per launch-waived charge, at creation.
 *
 * 🔑 THE RULE LIVES IN SQL (`booking_fee_open_lock_charge` →
 * `booking_fee_launch_offer_take`, migration 20271268832636). This file holds
 * only what the app must SAY and SHOW about it, plus the one piece of
 * arithmetic both halves need — free Pro's end date — whose SQL twin
 * (`booking_fee_launch_offer_pro_end`) is pinned to this one by the db test.
 *
 * Every number comes from `platform_settings`; nothing here is a literal.
 */

const DAY_MS = 86_400_000;

/** The offer as `platform_settings` holds it, plus the live count. */
export type LaunchOfferSettings = {
  enabled: boolean;
  /** The owner's 2,000 — `launch_offer_booking_cap`. Null when unset. */
  cap: number | null;
  /** The owner's 50 — `launch_offer_papic_credits`. */
  papicCredits: number | null;
  /** The owner's 4-week cycle — `launch_offer_cycle_days`. */
  cycleDays: number | null;
  startedAt: string | null;
  closedAt: string | null;
  proEndsAt: string | null;
  /** How many bookings have taken a place (ledger rows with `launch_offer`). */
  used: number;
};

/**
 * FREE PRO'S ONE END DATE — the end of the `cycleDays` cycle running at `at`,
 * cycles counted from `startedAt` (owner #5). The SQL twin is
 * `public.booking_fee_launch_offer_pro_end`; `LAUNCH_PRO_END_CASES` drives both.
 *
 * Null when it cannot be worked out (no cycle length) — never a guessed date.
 */
export function launchProEndsAt(
  startedAt: string | null,
  at: string | null,
  cycleDays: number | null,
): string | null {
  if (!at || cycleDays == null || !Number.isFinite(cycleDays) || cycleDays <= 0) return null;
  const atMs = Date.parse(at);
  if (Number.isNaN(atMs)) return null;
  const startMs = startedAt ? Date.parse(startedAt) : atMs;
  if (Number.isNaN(startMs)) return null;
  const cycleMs = cycleDays * DAY_MS;
  const elapsed = Math.max(atMs - startMs, 0);
  const cycles = Math.floor(elapsed / cycleMs) + 1;
  return new Date(startMs + cycles * cycleMs).toISOString();
}

/** One table of cases, asked of the TS rule here and of SQL in the db test. */
export const LAUNCH_PRO_END_CASES: ReadonlyArray<{
  name: string;
  startedAt: string | null;
  at: string;
  cycleDays: number;
  expect: string;
}> = [
  {
    name: 'closes in the first cycle → the end of cycle 1',
    startedAt: '2026-10-15T00:00:00.000Z',
    at: '2026-10-20T08:00:00.000Z',
    cycleDays: 28,
    expect: '2026-11-12T00:00:00.000Z',
  },
  {
    name: 'closes on day 30 → the end of cycle 2',
    startedAt: '2026-10-15T00:00:00.000Z',
    at: '2026-11-14T00:00:00.000Z',
    cycleDays: 28,
    expect: '2026-12-10T00:00:00.000Z',
  },
  {
    name: 'closes exactly on a boundary → the cycle that just began',
    startedAt: '2026-10-15T00:00:00.000Z',
    at: '2026-11-12T00:00:00.000Z',
    cycleDays: 28,
    expect: '2026-12-10T00:00:00.000Z',
  },
  {
    name: 'no start recorded → one cycle from the close',
    startedAt: null,
    at: '2026-10-20T00:00:00.000Z',
    cycleDays: 28,
    expect: '2026-11-17T00:00:00.000Z',
  },
  {
    name: 'a different cycle length is honoured',
    startedAt: '2026-10-01T00:00:00.000Z',
    at: '2026-10-09T00:00:00.000Z',
    cycleDays: 7,
    expect: '2026-10-15T00:00:00.000Z',
  },
];

/** Is the offer taking bookings at `nowMs`? The same five tests as SQL `booking_fee_launch_offer_open`. */
export function launchOfferIsOpen(s: LaunchOfferSettings, nowMs: number): boolean {
  if (!s.enabled || s.closedAt) return false;
  if (s.cap == null || s.cap <= 0) return false;
  if (s.startedAt && nowMs < Date.parse(s.startedAt)) return false;
  return s.used < s.cap;
}

/**
 * The date free Pro ends, as the admin page and the supplier are shown it:
 * the stamped one once the offer closed, else the end of the cycle running now
 * (it rolls forward while the offer is open). Null when the offer is off.
 */
export function launchProEndsAtNow(s: LaunchOfferSettings, nowMs: number): string | null {
  if (s.closedAt) return s.proEndsAt;
  if (!s.enabled) return null;
  return launchProEndsAt(s.startedAt, new Date(nowMs).toISOString(), s.cycleDays);
}

/** "2,000" — the cap as a supplier reads it. */
export function formatLaunchCap(cap: number): string {
  return new Intl.NumberFormat('en-PH').format(cap);
}

/** "12 November 2026", in Manila. */
export function formatLaunchDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(d);
}

/**
 * A `datetime-local` value typed on the admin page ("2026-10-15T09:00"), read
 * as MANILA time — the owner's clock — and returned as an ISO instant. Manila
 * keeps UTC+8 all year, so the offset is fixed. Null when it cannot be read.
 */
export function manilaLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const t = Date.parse(`${local}:00+08:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** The reverse, for the input's value: an instant as Manila `YYYY-MM-DDTHH:mm`, or ''. */
export function isoToManilaLocal(iso: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t + 8 * 3_600_000).toISOString().slice(0, 16);
}
