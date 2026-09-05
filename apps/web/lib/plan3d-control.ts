/**
 * plan3d-control — the 3D Plan control centre's decisions, PURE.
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
import { guestListDeadlineEndMs, guestListIsClosed } from './guest-list-closed';

export type Plan3dEventRead = {
  measured: boolean;
  slug: string | null;
  eventDate: string | null;
  timezone: string | null;
  guestListEditDeadline: string | null;
  guestListLockedAt: string | null;
};

export type Plan3dPlanRead = {
  /** The `event_floor_plan.published_at` read itself succeeded. */
  measured: boolean;
  published: boolean;
  publishedAt: string | null;
  tables: number;
  seated: number;
  boothCount: number;
  brandedBooths: number;
  photoVisibility: 'table' | 'all' | 'none';
  /** `events.seating_autoplace_enabled` — the guest-reactive seat plan (Smart
   *  Seat-Plan Phase 5, 2026-07-08). ON (the default): a new guest gets a
   *  provisional seat, role/group changes re-seat them, a decline frees the
   *  seat. So a guest with no seat means NOT ENOUGH TABLES, and the act is
   *  "add a table" — never "seat them by hand". OFF: the couple seats manually. */
  autoplace: boolean;
};

export type Plan3dGuestRead = {
  /** The host shared the guest list with this viewer. FALSE is a third state —
   *  a delegate without the `guest_list` area — and is NOT a refused read: the
   *  facts say "Not shared with you", never "—" and never 0. */
  shared: boolean;
  measured: boolean;
  total: number;
  withAvatar: number;
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

/** The guest list's finalization, as one sentence fragment for a row. */
export function resolveGuestListFinalize(
  event: Plan3dEventRead,
  nowMs?: number,
): { closed: boolean; endMs: number | null; label: string } {
  if (!event.measured) return { closed: false, endMs: null, label: 'Couldn’t read it just now' };
  const closed = guestListIsClosed({
    lockedAt: event.guestListLockedAt,
    editDeadline: event.guestListEditDeadline,
    eventDate: event.eventDate,
    nowMs,
  });
  const endMs = guestListDeadlineEndMs(event.guestListEditDeadline, event.eventDate);
  if (closed) return { closed, endMs, label: 'finalized' };
  if (endMs == null) return { closed, endMs, label: 'no finalize date' };
  return { closed, endMs, label: `finalizes ${shortDate(new Date(endMs).toISOString()) ?? ''}`.trim() };
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
        ? 'Draft'
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
        known: guests.measured,
        value: guests.measured
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

export type Plan3dNextStep = {
  headline: string;
  blurb: string;
  /** A door, or null when the act is the switch on this page. */
  href: string | null;
  cta: string | null;
  tone: 'act' | 'quiet' | 'failed';
};

export function resolvePlan3dNextStep(
  event: Plan3dEventRead,
  plan: Plan3dPlanRead,
  guests: Plan3dGuestRead,
  base: string,
  nowMs?: number,
): Plan3dNextStep {
  if (!plan.measured) {
    return {
      headline: 'We couldn’t read your room just now',
      blurb: 'So we are not going to guess what your guests would see. Nothing has been lost.',
      href: `${base}/plan3d`,
      cta: 'Try again',
      tone: 'failed',
    };
  }
  const standing = resolvePlan3dStanding(event, plan, nowMs);
  if (plan.tables === 0) {
    return {
      headline: 'Place your first table',
      blurb: 'The room draws itself from your seat plan. One table and it has a shape.',
      href: `${base}/seating/lab`,
      cta: 'Open the seat plan',
      tone: 'act',
    };
  }
  const unseated = guests.shared && guests.measured ? Math.max(0, guests.total - plan.seated) : 0;
  if (standing.state === 'after') {
    return {
      headline: 'Nothing to do',
      blurb: 'It stays up until you take it down.',
      href: null,
      cta: null,
      tone: 'quiet',
    };
  }
  if (unseated > 0) {
    return plan.autoplace
      ? {
          headline: `${unseated} guest${unseated === 1 ? ' has' : 's have'} no seat yet`,
          blurb: 'Auto-seating is on — seats fill themselves as you add tables. Add one and the room follows.',
          href: `${base}/seating`,
          cta: 'Add a table',
          tone: 'act',
        }
      : {
          headline: `${unseated} guest${unseated === 1 ? ' has' : 's have'} no seat`,
          blurb: 'Auto-seating is off, so these are yours to place. They will be told to ask at the door until then.',
          href: `${base}/seating`,
          cta: 'Seat them',
          tone: 'act',
        };
  }
  if (standing.state === 'draft') {
    return {
      headline: 'Publish — your guests can walk the room',
      blurb: plan.autoplace
        ? 'Seats can change right up to and during the day — a guest added late still gets one, and your guests always open the latest version.'
        : 'Seats can change right up to and during the day; your guests always open the latest version.',
      href: null,
      cta: null,
      tone: 'act',
    };
  }
  return {
    headline: 'Print your table signs',
    blurb: 'Each sign carries its table’s QR — a guest scans it and lands on their seat.',
    href: `${base}/seating/print`,
    cta: 'Open the print pack',
    tone: 'act',
  };
}

export type Plan3dSourceRow = {
  key: 'guests' | 'seatplan' | 'moodboard';
  label: string;
  value: string | null;
  known: boolean;
  href: string;
};

export function resolvePlan3dSources(
  event: Plan3dEventRead,
  plan: Plan3dPlanRead,
  guests: Plan3dGuestRead,
  base: string,
  nowMs?: number,
): Plan3dSourceRow[] {
  const fin = resolveGuestListFinalize(event, nowMs);
  const unseated = guests.shared && guests.measured && plan.measured ? Math.max(0, guests.total - plan.seated) : null;
  return [
    {
      key: 'guests',
      label: 'Guest list',
      known: !guests.shared || guests.measured,
      value: !guests.shared
        ? NOT_SHARED
        : guests.measured
          ? `${guests.total} guest${guests.total === 1 ? '' : 's'} · ${fin.label}`
          : null,
      href: `${base}/guests`,
    },
    {
      key: 'seatplan',
      label: 'Seat plan',
      known: plan.measured,
      value: plan.measured
        ? `${plan.tables} table${plan.tables === 1 ? '' : 's'} · ${
            unseated == null ? `${plan.seated} seated` : unseated === 0 ? 'everyone seated' : `${unseated} with no seat`
          }${plan.boothCount > 0 ? ` · ${plan.boothCount} supplier booth${plan.boothCount === 1 ? '' : 's'}${plan.brandedBooths > 0 ? ` (${plan.brandedBooths} branded)` : ''}` : ''} · auto-seating ${plan.autoplace ? 'on' : 'off'}`
        : null,
      href: `${base}/seating`,
    },
    {
      key: 'moodboard',
      label: 'Mood board',
      known: true,
      value: 'Palette and reception design — the room re-tints when you change it',
      href: `${base}/studio/mood-board`,
    },
  ];
}

export const PHOTO_VISIBILITY_LABEL: Record<Plan3dPlanRead['photoVisibility'], string> = {
  table: 'Own table only',
  all: 'All guests',
  none: 'No photos',
};
