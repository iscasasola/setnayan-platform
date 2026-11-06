/**
 * plan3d-control — the 3D Plan's FACTS, PURE.
 *
 * ♻ RESTORED 2026-10-29 (owner, on the Guests audit's 3D Plan facts panel: *"put it behind (i)"*). R4 (a01284796b)
 * folded the 3D Plan control centre (`/plan3d`) into Guests › Seats and deleted this file with the page; its four
 * facts — Status · Seated · Made an avatar · Days to go — went with it. They come back here VERBATIM (only the facts and
 * what they need; the page's next-step and built-from rows stayed retired with the page) and are drawn behind an ⓘ in
 * the Seats menu (`seat-plan-facts.tsx`). Showing guests their seats early stays the switch it already is.
 *
 * The couple's control room FOR the 3D Plan (owner 2026-09-05, Fable spec of
 * the same day; `SERVICE_CONTROL_CENTERS_DESIGN_2026-08-28.md` § 2 — the seven
 * slots). Its job in one sentence: show the couple the room their guests will
 * walk — built from three things they already made — and give them the one
 * switch that opens it, the few settings that live nowhere else, and the facts.
 *
 * It does NOT re-edit the guest list, the seat plan or the mood board. Those
 * have their own screens and feed the room live; the rows here are doors.
 *
 * ── UNREAD IS NOT EMPTY ─────────────────────────────────────────────────────
 * Every read carries `measured`. A refused floor-plan read must not render as
 * "Draft — only you can see this" to a couple whose room is live, and a refused
 * guest read must not print "0 seated" to a couple with 180 names. `null`
 * values and `known:false` facts are how the refusal reaches the pixel
 * (`lib/event-hub-control.ts` is the precedent and `HubFact` is reused as-is).
 *
 * ── SEATING IS NEVER FINAL — OWNER, 2026-09-06 ──────────────────────────────
 * "seating can always change in the last minute and even during the event."
 * So there is NO finalize gate on Publish, and no "wait" step either (a first
 * draft had one — it told the couple to hold the room until the list settled,
 * which is the opposite of the rule). The guest-list edit deadline still shows
 * on its row because it is a true fact about the LIST (counts, pricing); it
 * says nothing about the room. Auto-seating (Smart Seat-Plan Phase 5) is what
 * makes late changes safe: a guest added on the morning still gets a seat.
 *
 * What "the room follows" honestly means today: the guest walk fetches the
 * scene PER REQUEST (`/[slug]/venue` is force-dynamic; the only live channel is
 * presence), so a seat change appears the next time a guest opens or refreshes
 * the room — not mid-walk. The copy says "always opens the latest", never
 * "updates live". A live seat-map subscription is its own build.
 */

import { NOT_SHARED, type HubFact } from './event-hub-control';

export type Plan3dEventRead = {
  measured: boolean;
  slug: string | null;
  eventDate: string | null;
  timezone: string | null;
};

export type Plan3dPlanRead = {
  /** The `event_floor_plan.published_at` read itself succeeded. */
  measured: boolean;
  published: boolean;
  publishedAt: string | null;
  tables: number;
  seated: number;
};

export type Plan3dGuestRead = {
  /** The host shared the guest list with this viewer. FALSE is a third state —
   *  a delegate without the `guest_list` area — and is NOT a refused read: the
   *  facts say "Not shared with you", never "—" and never 0. */
  shared: boolean;
  measured: boolean;
  total: number;
  /** Guests who made an avatar — `null` when that one count was not read (restored 2026-10-29: in Seats the list is
   *  already in hand, so only this count can be unread on its own; it says "—" while "Seated" still counts). */
  withAvatar: number | null;
};

export type Plan3dState = 'draft' | 'live' | 'after';
export type Plan3dStanding = { state: Plan3dState | null; measured: boolean };

/** Today at the venue, ISO date — Vercel runs in UTC and a wedding in Manila is
 *  up to eight hours ahead of it (the `venueTodayISO` precedent). */
export function plan3dTodayISO(timezone: string | null | undefined, nowMs?: number): string {
  const now = nowMs === undefined ? new Date() : new Date(nowMs);
  return now.toLocaleDateString('en-CA', { timeZone: timezone ?? 'Asia/Manila' });
}

function daysBetweenISO(fromISO: string, toISO: string): number {
  const a = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10));
  const b = Date.UTC(+toISO.slice(0, 4), +toISO.slice(5, 7) - 1, +toISO.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "28 Nov" — built by hand, not by `toLocaleDateString`: the ICU data behind
 *  `en-PH` differs between Node builds (the CI runner says "28 Nov", this Mac
 *  says "Nov 28"), and a fact that renders two ways is not a fact. UTC on
 *  purpose for ISO dates (they carry no zone). */
export function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function resolvePlan3dStanding(
  event: Plan3dEventRead,
  plan: Plan3dPlanRead,
  nowMs?: number,
): Plan3dStanding {
  if (!plan.measured) return { state: null, measured: false };
  if (!plan.published) return { state: 'draft', measured: true };
  if (event.measured && event.eventDate) {
    const today = plan3dTodayISO(event.timezone, nowMs);
    if (daysBetweenISO(today, event.eventDate) < 0) return { state: 'after', measured: true };
  }
  return { state: 'live', measured: true };
}

export function resolvePlan3dFacts(
  event: Plan3dEventRead,
  plan: Plan3dPlanRead,
  guests: Plan3dGuestRead,
  nowMs?: number,
): HubFact[] {
  const standing = resolvePlan3dStanding(event, plan, nowMs);
  const status: HubFact = {
    label: 'Status',
    known: standing.measured,
    value: !standing.measured
      ? null
      : standing.state === 'draft'
        ? 'Opens on the day'
        : `Live${plan.publishedAt ? ` · since ${shortDate(plan.publishedAt)}` : ''}`,
  };
  const seated: HubFact = !guests.shared
    ? { label: 'Seated', known: true, value: NOT_SHARED }
    : {
        label: 'Seated',
        known: plan.measured && guests.measured,
        value:
          plan.measured && guests.measured
            ? `${plan.seated} of ${guests.total} · ${plan.tables} table${plan.tables === 1 ? '' : 's'}`
            : null,
      };
  const avatars: HubFact = !guests.shared
    ? { label: 'Made an avatar', known: true, value: NOT_SHARED }
    : {
        label: 'Made an avatar',
        known: guests.measured && guests.withAvatar !== null,
        value: guests.measured && guests.withAvatar !== null
          ? `${guests.withAvatar} guest${guests.withAvatar === 1 ? '' : 's'}${event.slug ? ` · at setnayan.com/${event.slug}/avatar` : ''}`
          : null,
      };
  let days: HubFact;
  if (!event.measured) days = { label: 'Days to go', known: false, value: null };
  else if (!event.eventDate) days = { label: 'Days to go', known: true, value: 'No date yet' };
  else {
    const n = daysBetweenISO(plan3dTodayISO(event.timezone, nowMs), event.eventDate);
    days = {
      label: 'Days to go',
      known: true,
      value: n === 0 ? 'Today' : n > 0 ? `${n} · ${shortDate(event.eventDate)}` : `Was ${-n} day${-n === 1 ? '' : 's'} ago`,
    };
  }
  return [status, seated, avatars, days];
}
