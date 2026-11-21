/**
 * /dev/booking-ask-lab — the SUPPLIER'S half of "Book" / "Book this build"
 * (pair P2) on fixture data, with no sign-in and no database. DEV-ONLY:
 * production builds 404 this route (`the-lab-never-ships.test.ts`).
 *
 * The couple's half is `/dev/suppliers-lab?tab=build&build=answers&answer=…`;
 * this lab draws what the supplier's customer card shows for the SAME row,
 * with the real panel (`clients/[eventId]/_components/booking-ask-panel.tsx`):
 *
 *   ?s=requested    the ask is open — Agree · Turn it down, in place
 *   ?s=agreed       …pressed Agree: the sentence the card says after it
 *   ?s=refused      …pressed Agree and was refused (other couples first)
 *   ?s=on_hold      …pressed Agree on an ask for a service that is on PLAN hold (owner 2026-11-06, SERVICES
 *                   LIFE CYCLE): the sentence names it, "Pick which stay on" takes Agree's place; the ask stays open
 *   ?s=declined     the ask closed: you said no (with your words)
 *   ?s=expired      …you did not answer in 48 hours
 *   ?s=cancelled    …they took it back
 *   &fee=unverified|ticket|platform|import   the 20 Nov fee notice above Agree (default: a verified shop, billed)
 *
 *   &gift=stock|empty|sent  the Agree step's gift (#7823): in stock · none left ("0 left · Buy more ›") · a store
 *                   payment sent, waiting for approval. &gift=needed draws an AGREED booking whose gift was cleared.
 *                   SAMPLE prices — fixtures for the drawing, never the catalogue.
 *
 * The forms post the REAL actions; pressing them here needs a supplier's
 * session (the lab draws, it does not book). Names are samples: nobody real.
 */
import { notFound } from 'next/navigation';
import {
  BookingAskOutcomeLine,
  LockAnswerLine,
  LockRequestAnswer,
} from '@/app/vendor-dashboard/clients/[eventId]/_components/booking-ask-panel';
import { vendorAgreeToLock, vendorDeclineLock, vendorWaitlistTheAsk } from '@/app/vendor-dashboard/clients/[eventId]/actions';
import { parseDayCheck, type DayCheckRead } from '@/lib/day-check';
import { supplierAskOutcomeOf } from '@/lib/booking-ask-words';
import { BOOKING_FEE } from '@/lib/booking-fee';
import { bookingFeeForecast, type BookingFeeStanding } from '@/lib/booking-fee-disclosure';
import { lockAgreeNotice } from '@/lib/lock-answer-notice';
import type { AgreeGiftBasis } from '@/lib/agree-gifts';
import type { ShopGiftPack } from '@/lib/shop-gifts';
import { GiftNeededRow } from '@/app/vendor-dashboard/clients/[eventId]/_components/gift-needed-row';

/** SAMPLE packs for the drawing only (#7823) — the real ones are read from the catalogue. */
const LAB_PACKS: ShopGiftPack[] = [
  { code: 'PAPIC_GUEST_150', title: 'Papic 150', kind: 'papic', credits: 150, srpCentavos: 9_900 },
  { code: 'PAPIC_GUEST_1K', title: 'Papic 1000', kind: 'papic', credits: 1_000, srpCentavos: 49_900 },
  { code: 'PAPIC_GUEST', title: 'Papic 3000', kind: 'papic', credits: 3_000, srpCentavos: 99_900 },
  { code: 'EVENT_PLUS', title: 'Event Plus', kind: 'event_plus', credits: 1, srpCentavos: 299_000 },
];
function labGift(key: string | undefined): AgreeGiftBasis | null {
  if (!key) return null;
  const none = { papic: 0, event_plus: 0, event_pro: 0, event_ultra: 0, packs: {} as Record<string, number> };
  const base = { packs: LAB_PACKS, feeCentavos: 571_000, billCentavos: 0, limitPct: 40, eventHas: 'none' as const };
  if (key === 'stock') return { ...base, free: { ...none, papic: 1150, packs: { PAPIC_GUEST_150: 1, PAPIC_GUEST_1K: 1 } }, sent: {} };
  if (key === 'sent') return { ...base, free: none, sent: { PAPIC_GUEST_150: 1 } };
  return { ...base, free: none, sent: {} };
}

const LAB_EVENT = '00000000-0000-4000-8000-000000000000';
const LAB_EVENT_VENDOR = '00000000-0000-4000-8000-0000000000bb';
/** The asked-for service on plan hold in `?s=on_hold` (a sample name). */
const LAB_HELD_SERVICE = 'Same-Day Edit';
/** The lab's "now" — the fuse reads against it, so every picture says the same. */
const NOW = new Date('2026-10-12T04:00:00Z');

/**
 * ⚖ 20 Nov fee states for the notice above Agree (no free first booking any more):
 *   default verified, billable · &fee=unverified (flat 5%, locked) · &fee=ticket (a held ticket pays it) ·
 *   &fee=platform (Setnayan's every-Nth fee, free) · &fee=import (a couple you brought — no fee).
 */
function feeStandingFor(sp: Record<string, string | string[] | undefined>): BookingFeeStanding {
  const base = { kind: 'billable', ordinal: 3, ordinalIsFrozen: false, schedule: BOOKING_FEE } as const;
  switch (sp.fee) {
    case 'unverified':
      return { ...base, unverified: true };
    case 'ticket':
      return { ...base, badgeReward: 'this' };
    case 'platform':
      return { ...base, platformFree: 100_000 };
    case 'import':
      return { kind: 'not_sourced' };
    default:
      return base;
  }
}

const ENDED = {
  declined: {
    status: 'considering',
    lock_request_state: 'declined',
    lock_declined_at: '2026-10-11T09:30:00Z',
    lock_decline_reason: 'We are fully booked that weekend.',
  },
  expired: { status: 'considering', lock_request_state: 'expired', lock_request_expires_at: '2026-10-11T02:00:00Z' },
  cancelled: { status: 'considering', lock_request_state: 'cancelled', lock_request_cancelled_at: '2026-10-11T12:15:00Z' },
} as const;

/**
 * THE DAY, BEFORE THE YES (owner 2026-11-04) — `?day=open|full|failed`. The RPC's own jsonb shape, read through the
 * real `parseDayCheck`, so the lab draws exactly what `vendor_day_check` would hand the panel (the prototype's two
 * events: an open Dec 19, a full Feb 14).
 */
const LAB_DAY: Record<string, unknown> = {
  open: {
    status: 'ok', date: '2026-12-19', verdict: 'open', slot_full: false, daily_full: false, competing: 0,
    services: [{ service_id: 'svc-1', name: 'Same-day edit', mode: 'day', daily_limit: 4, slots: 0, per_slot: null, slot_limit: 0, booked: 0, is_this_ask: true }],
    booked: [{ name: 'Garcia debut', source: 'outside' }],
    asking: [],
    shortlisted: [{ event_id: 'e-9', name: 'Santos & Lim', event_type: 'Wedding' }],
  },
  full: {
    status: 'ok', date: '2027-02-14', verdict: 'daily_limit_reached', slot_full: false, daily_full: true, competing: 0,
    services: [
      { service_id: 'svc-1', name: 'Same-day edit', mode: 'day', daily_limit: 1, slots: 0, per_slot: null, slot_limit: 0, booked: 1, is_this_ask: true },
      { service_id: 'svc-2', name: 'Photo booth', mode: 'slot', daily_limit: null, slots: 3, per_slot: 1, slot_limit: 3, booked: 1, is_this_ask: false },
    ],
    booked: [
      { name: 'Lopez & Pineda', event_type: 'Wedding', service: 'Same-day edit', service_id: 'svc-1', source: 'setnayan' },
      { name: 'Reyes', event_type: 'Debut', service: 'Photo booth', service_id: 'svc-2', source: 'setnayan' },
    ],
    asking: [{ event_id: 'e-4', name: 'Aquino & Diaz', event_type: 'Wedding', thread_id: null }],
    shortlisted: [{ event_id: 'e-5', name: 'Mendoza & Ong', event_type: 'Wedding' }],
  },
};
function labDay(key: string): DayCheckRead | null {
  if (key === 'failed') return { kind: 'failed' };
  const check = parseDayCheck(LAB_DAY[key]);
  return check ? { kind: 'ok', check } : null;
}

export default async function BookingAskLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const s = typeof sp.s === 'string' ? sp.s : 'requested';

  const notice =
    s === 'agreed' ? lockAgreeNotice('ok') : s === 'refused'
        ? lockAgreeNotice('resolve_others_first', { competing: 2 })
        : s === 'on_hold'
          ? lockAgreeNotice('service_on_hold', { heldService: LAB_HELD_SERVICE })
          : null;
  const ended = s === 'declined' || s === 'expired' || s === 'cancelled' ? supplierAskOutcomeOf(ENDED[s], true) : null;
  const open = s === 'requested' || s === 'refused' || s === 'on_hold';

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-32 pt-6" data-lab-booking-ask={s}>
      <p className="text-xs uppercase tracking-[0.14em] text-ink/55">Customer</p>
      <h1 className="font-display text-[22px] font-medium leading-tight text-ink">Ana &amp; Paolo</h1>
      <p className="mt-0.5 text-sm text-ink/55">Dec 12, 2026 · Quezon City</p>
      {notice ? <LockAnswerLine notice={notice} /> : null}
      {sp.gift === 'needed' ? (
        <GiftNeededRow
          eventVendorId={LAB_EVENT_VENDOR}
          basis={labGift('empty')!}
          returnTo={`/vendor-dashboard/clients/${LAB_EVENT}`}
          action={vendorAgreeToLock}
        />
      ) : null}
      {open ? (
        <LockRequestAnswer
          eventVendorId={LAB_EVENT_VENDOR}
          expiresAt="2026-10-13T20:00:00Z"
          payoutReadiness="ready"
          feeForecast={bookingFeeForecast(feeStandingFor(sp), 171_000)}
          returnTo={`/vendor-dashboard/clients/${LAB_EVENT}`}
          agreeLock={vendorAgreeToLock}
          declineLock={vendorDeclineLock}
          dayCheck={typeof sp.day === 'string' ? labDay(sp.day) : null}
          waitlistAsk={vendorWaitlistTheAsk}
          heldService={s === 'on_hold' ? LAB_HELD_SERVICE : null}
          giftBasis={typeof sp.gift === 'string' && sp.gift !== 'needed' ? labGift(sp.gift) : null}
          now={NOW}
        />
      ) : ended ? (
        <BookingAskOutcomeLine outcome={ended} />
      ) : null}
      {/* The card's own stage pill, same three words and colours (`page.tsx` stagePill). */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            s === 'agreed'
              ? 'bg-success-100 text-success-900'
              : open
                ? 'bg-warn-100 text-warn-900'
                : 'bg-terracotta/10 text-terracotta-700'
          }`}
        >
          {s === 'agreed' ? 'Booked' : open ? 'They asked you' : 'In conversation'}
        </span>
      </div>
    </main>
  );
}
