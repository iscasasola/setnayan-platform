import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  Check,
  CircleAlert,
  RefreshCw,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  eventOwnsPapicSeats,
  fetchPapicSeats,
  papicSeatClaimUrl,
  PAPIC_SEAT_COUNT,
} from '@/lib/papic-seats';
import { renderUrlQrSvg } from '@/lib/qr';
import { provisionPapicSeats, reissuePapicSeat } from '../actions';
import { CopyButton } from './_components/copy-button';

// Papic · Your photo crew (couple-side seat management)
//
// The real surface behind PAPIC_SEATS (₱2,999). When the event owns the pack:
// provision the 5 seats (idempotent RPC), then for each seat show a shareable
// claim link + QR, its claim status, and a reissue control. A friend opens a
// claim link → /papic/claim/[token] → /papic/seat/[token] capture.
//
// Gated: signed-in couple on the event. Not-owned → a pointer back to the
// Papic page (where the buy CTA lives). Force-dynamic — per-request auth +
// live seat state.

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

  const backLink = `/dashboard/${eventId}/add-ons/papic`;

  const owns = await eventOwnsPapicSeats(supabase, eventId);

  // ---- Not owned → point back to the Papic page where the buy CTA lives ----
  if (!owns) {
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
          <Camera aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Your photo crew lives here</h1>
          <p className="mx-auto mt-2 max-w-prose text-sm text-ink/65">
            Get the Papic photo-crew pack and turn five friends into your
            candid camera crew — each one shoots from their own phone and every
            photo lands in your gallery. Set it up on the Papic page.
          </p>
          <Link
            href={backLink}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600"
          >
            See the Papic photo-crew pack
          </Link>
        </div>
      </section>
    );
  }

  const seats = await fetchPapicSeats(supabase, eventId);

  const h = await headers();
  const host = h.get('host') ?? 'www.setnayan.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const appUrl = `${proto}://${host}`;

  const seatViews = await Promise.all(
    seats.map(async (s) => {
      const claimUrl = papicSeatClaimUrl(appUrl, s.claim_qr_token);
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
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Papic · your photo crew
        </p>
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          <Camera aria-hidden className="h-7 w-7 text-terracotta" strokeWidth={1.75} />
          Your photo crew
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Five seats, five friends. Share a seat link (or QR) with each person
          you want shooting. They claim it from their own phone — no app to
          install — and every photo they take lands in your gallery in real
          time.
        </p>
        {seats.length > 0 && (
          <p className="text-sm text-ink/55">
            {claimedCount} of {seats.length} seats claimed.
          </p>
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
          <h2 className="mt-3 text-xl font-semibold tracking-tight">Set up your {PAPIC_SEAT_COUNT} seats</h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-ink/65">
            Create your five photo-crew seats. Each gets its own claim link you
            can hand to a friend.
          </p>
          <form action={provisionPapicSeats} className="mt-5">
            <input type="hidden" name="event_id" value={eventId} />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600"
            >
              <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
              Set up my {PAPIC_SEAT_COUNT} seats
            </button>
          </form>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {seatViews.map((s) => {
            const claimed = Boolean(s.claimer_user_id);
            return (
              <div key={s.seat_id} className="rounded-xl border border-ink/10 bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">Seat {s.seat_index}</p>
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
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
                  >
                    <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    {claimed ? 'Reissue to someone else' : 'Reset link'}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
