import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  Check,
  CircleAlert,
  Printer,
  RefreshCw,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  eventPapicSeatsActive,
  fetchPapicSeats,
  papicSeatJoinUrl,
  PAPIC_SEAT_COUNT,
} from '@/lib/papic-seats';
import { renderUrlQrSvg } from '@/lib/qr';
import { provisionPapicSeats, reissuePapicSeat } from '../actions';
import { CopyButton } from './_components/copy-button';
import { SubmitButton } from '@/app/_components/submit-button';

// Papic · Your photo crew (couple-side seat management)
//
// The claim-link roster — every paparazzi_seats row that carries its own claim
// link/QR: the PAPIC_SEATS pack (5 seats, uncapped) and the per-camera Unlimited
// extras (the only off-guest-list shooters, index >= 200, capture gated on
// payment via the record/presign per-camera checks). Guest-list Limited cameras
// use each guest's invite QR and are managed on the main Papic page, not here.
//
// For each seat we show a shareable claim link + QR, its claim status, and a
// reissue control. A friend opens a claim link → /papic/claim/[token] →
// /papic/seat/[token] capture.
//
// Gated: signed-in couple on the event. Force-dynamic — per-request auth + live
// seat state.

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ seat_set?: string; seat_error?: string }>;
};

export default async function PapicCrewPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const { seat_set: seatSet, seat_error: seatError } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    redirect(`/dashboard/${eventId}`);
  }

  const backLink = `/dashboard/${eventId}/studio/papic`;

  // The roster is every claim-link seat — the PAPIC_SEATS pack plus any paid
  // per-camera Unlimited extras. ownsPack tells the zero-state apart: an owner
  // with no seats yet can top them up; a non-owner is pointed back to set Papic up.
  const ownsPack = await eventPapicSeatsActive(supabase, eventId);
  const seats = await fetchPapicSeats(supabase, eventId);

  // ---- Nothing set up yet → point back to the Papic page ----
  if (seats.length === 0 && !ownsPack) {
    return (
      <section className="space-y-6 pb-12">
        <Link
          href={backLink}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Back to Papic
        </Link>
        <div className="rounded-2xl border border-ink/10 bg-surface p-7 text-center">
          <UserPlus aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">No crew cameras yet</h1>
          <p className="mx-auto mt-2 max-w-prose text-sm text-ink/65">
            Crew claim links come from the Papic photo-crew pack or from adding an
            Unlimited extra camera for someone off your guest list. Set those up on
            the Papic page.
          </p>
          <Link
            href={backLink}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600"
          >
            <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
            Go to Papic
          </Link>
        </div>
      </section>
    );
  }

  const h = await headers();
  const host = h.get('host') ?? 'www.setnayan.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const appUrl = `${proto}://${host}`;

  const seatViews = await Promise.all(
    seats.map(async (s) => {
      // Hybrid join link: native app opens directly when installed, otherwise
      // forwards to the existing /papic/claim flow. Legacy /papic/claim links
      // still work, so any QR printed before this stays valid.
      const claimUrl = papicSeatJoinUrl(appUrl, s.claim_qr_token);
      const qrSvg = await renderUrlQrSvg(claimUrl, 128);
      return { ...s, claimUrl, qrSvg };
    }),
  );

  const claimedCount = seats.filter((s) => s.claimer_user_id).length;

  return (
    <section className="space-y-8 pb-12">
      <Link
        href={backLink}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Papic
      </Link>

      <header className="space-y-3">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          <Camera aria-hidden className="h-7 w-7 text-terracotta" strokeWidth={1.75} />
          Your photo crew
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Share a seat link (or QR) with each person you want shooting. They claim
          it from their own phone — no app to install — and every photo they take
          lands in your gallery in real time.
        </p>
        {seats.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink/55">
              {claimedCount} of {seats.length} seats claimed.
            </p>
            <Link
              href={`${backLink}/crew/print`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/10 hover:text-ink"
            >
              <Printer aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Print QR cards
            </Link>
          </div>
        )}
      </header>

      {seatSet === 'provisioned' && (
        <div className="flex items-start gap-2 rounded-lg border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm text-ink/80">
          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
          Your five seats are ready. Share a link with each friend below.
        </div>
      )}
      {seatSet === 'reissued' && (
        <div className="flex items-start gap-2 rounded-lg border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm text-ink/80">
          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
          Seat reissued — the old link no longer works. Share the fresh one.
        </div>
      )}
      {seatError && (
        <div className="flex items-start gap-2 rounded-lg border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/80">
          <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/60" strokeWidth={2} />
          We couldn&rsquo;t do that just now. Please try again.
        </div>
      )}

      {seats.length === 0 ? (
        <div className="rounded-2xl border border-ink/10 bg-surface p-7 text-center">
          <UserPlus aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
          <h2 className="mt-3 text-xl font-semibold tracking-tight">Top up your {PAPIC_SEAT_COUNT} seats</h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-ink/65">
            Your {PAPIC_SEAT_COUNT} photo-crew seats are set up automatically the moment your
            order is approved. If any are missing, tap below to fill them in — each
            gets its own claim link you can hand to a friend.
          </p>
          {/* Idempotent top-up: provisionPapicSeats only inserts the missing seat
              indexes (ON CONFLICT DO NOTHING), so this is now a SAFE fallback, not a
              required first step — seats already exist post-approval. */}
          <form action={provisionPapicSeats} className="mt-5">
            <input type="hidden" name="event_id" value={eventId} />
            <SubmitButton
              pendingLabel="Filling in…"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600"
            >
              <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
              Fill in my {PAPIC_SEAT_COUNT} seats
            </SubmitButton>
          </form>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {seatViews.map((s) => {
            const claimed = Boolean(s.claimer_user_id);
            return (
              <div key={s.seat_id} className="rounded-xl border border-ink/10 bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">
                    {s.seat_index >= 200
                      ? `Camera ${s.seat_index - 199}` /* per-camera (index base 200) */
                      : `Seat ${s.seat_index}`}
                  </p>
                  {claimed ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/10 px-2.5 py-1 text-xs font-medium text-terracotta">
                      <UserCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      Claimed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-ink/60">
                      Open
                    </span>
                  )}
                </div>

                {claimed ? (
                  <p className="mt-2 text-sm text-ink/65">
                    A friend has this seat and can shoot. Reissue it to hand the
                    seat to someone else — the old link stops working.
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-ink/65">
                      Share this link (or QR) with the friend you want on this
                      seat.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-md bg-ink/5 px-2.5 py-1.5 text-xs text-ink/70">
                        {s.claimUrl}
                      </code>
                      <CopyButton value={s.claimUrl} />
                    </div>
                    <div className="mt-3 inline-block rounded-lg bg-cream p-2" aria-label={`QR code for seat ${s.seat_index}`}>
                      <div className="h-32 w-32" dangerouslySetInnerHTML={{ __html: s.qrSvg }} />
                    </div>
                  </>
                )}

                <form action={reissuePapicSeat} className="mt-3">
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="seat_id" value={s.seat_id} />
                  <SubmitButton
                    pendingLabel="Reissuing…"
                    className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
                  >
                    <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    {claimed ? 'Reissue to someone else' : 'Reset link'}
                  </SubmitButton>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
