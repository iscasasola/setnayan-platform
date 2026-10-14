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
 *   ?s=declined     the ask closed: you said no (with your words)
 *   ?s=expired      …you did not answer in 48 hours
 *   ?s=cancelled    …they took it back
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
import { vendorAgreeToLock, vendorDeclineLock } from '@/app/vendor-dashboard/clients/[eventId]/actions';
import { supplierAskOutcomeOf } from '@/lib/booking-ask-words';
import { BOOKING_FEE } from '@/lib/booking-fee';
import { bookingFeeForecast } from '@/lib/booking-fee-disclosure';
import { lockAgreeNotice } from '@/lib/lock-answer-notice';

const LAB_EVENT = '00000000-0000-4000-8000-000000000000';
const LAB_EVENT_VENDOR = '00000000-0000-4000-8000-0000000000bb';
/** The lab's "now" — the fuse reads against it, so every picture says the same. */
const NOW = new Date('2026-10-12T04:00:00Z');

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

export default async function BookingAskLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const s = typeof sp.s === 'string' ? sp.s : 'requested';

  const notice =
    s === 'agreed' ? lockAgreeNotice('ok') : s === 'refused' ? lockAgreeNotice('resolve_others_first', { competing: 2 }) : null;
  const ended = s === 'declined' || s === 'expired' || s === 'cancelled' ? supplierAskOutcomeOf(ENDED[s], true) : null;
  const open = s === 'requested' || s === 'refused';

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-32 pt-6" data-lab-booking-ask={s}>
      <p className="text-xs uppercase tracking-[0.14em] text-ink/55">Customer</p>
      <h1 className="font-display text-[22px] font-medium leading-tight text-ink">Ana &amp; Paolo</h1>
      <p className="mt-0.5 text-sm text-ink/55">Dec 12, 2026 · Quezon City</p>
      {notice ? <LockAnswerLine notice={notice} /> : null}
      {open ? (
        <LockRequestAnswer
          eventVendorId={LAB_EVENT_VENDOR}
          expiresAt="2026-10-13T20:00:00Z"
          payoutReadiness="ready"
          feeForecast={bookingFeeForecast({ kind: 'free', ordinal: 2, ordinalIsFrozen: false, schedule: BOOKING_FEE }, 171_000)}
          returnTo={`/vendor-dashboard/clients/${LAB_EVENT}`}
          agreeLock={vendorAgreeToLock}
          declineLock={vendorDeclineLock}
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
