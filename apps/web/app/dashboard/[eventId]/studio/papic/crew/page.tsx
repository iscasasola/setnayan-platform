import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import {
  ArrowLeft,
  Camera,
  Check,
  CircleAlert,
  Clock,
  RefreshCw,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  eventPapicSeatsActive,
  fetchPapicSeats,
  fetchPapicSamplerSeats,
  papicSeatClaimUrl,
  PAPIC_SEAT_COUNT,
  PAPIC_SAMPLER_SEAT_COUNT,
  PAPIC_SAMPLER_PHOTO_CAP,
  PAPIC_SAMPLER_CLIP_CAP,
  PAPIC_SAMPLER_RETENTION_DAYS,
} from '@/lib/papic-seats';
import { renderUrlQrSvg } from '@/lib/qr';
import {
  provisionPapicSeats,
  provisionPapicSampler,
  reissuePapicSeat,
} from '../actions';
import { sweepExpiredSamplerPhotos } from '@/lib/papic-retention';
import { CopyButton } from './_components/copy-button';
import { SubmitButton } from '@/app/_components/submit-button';

// Papic · Your photo crew (couple-side seat management)
//
// Two modes share this surface:
//   • PAID crew — the event owns PAPIC_SEATS (₱2,999): 5 seats, uncapped,
//     permanent, ingested to the live wall.
//   • FREE SAMPLER — the event does NOT own the paid pack: 3 free seats, each
//     capped at 8 photos + 2 clips, kept 30 days (connect Drive or upgrade to
//     keep forever). Lets the couple feel the claim→shoot→tag→gallery loop
//     before buying. Provisioned by the papic_provision_sampler() RPC.
//
// For each seat (either mode) we show a shareable claim link + QR, its claim
// status, and a reissue control. A friend opens a claim link → /papic/claim/
// [token] → /papic/seat/[token] capture.
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

  // Cron-free retention: opportunistically purge this event's expired sampler
  // photos (R2 bytes + rows) in the background. Best-effort; never blocks render.
  after(() => sweepExpiredSamplerPhotos(eventId));

  const backLink = `/dashboard/${eventId}/studio/papic`;

  const owns = await eventPapicSeatsActive(supabase, eventId);
  // Paid crew when owned; otherwise the free sampler.
  const isSampler = !owns;
  const seats = owns
    ? await fetchPapicSeats(supabase, eventId)
    : await fetchPapicSamplerSeats(supabase, eventId);

  // Live expiry countdown for the sampler banner — the soonest non-expired
  // sampler photo (couple RLS reads their own papic_photos). 0 = none yet.
  let samplerExpiringCount = 0;
  let samplerDaysLeft: number | null = null;
  if (isSampler) {
    const { data: expiring } = await supabase
      .from('papic_photos')
      .select('expires_at')
      .eq('event_id', eventId)
      .not('expires_at', 'is', null)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });
    samplerExpiringCount = expiring?.length ?? 0;
    const soonest = expiring?.[0]?.expires_at as string | undefined;
    if (soonest) {
      samplerDaysLeft = Math.max(
        0,
        Math.ceil((new Date(soonest).getTime() - Date.now()) / 86_400_000),
      );
    }
  }

  // ---- Free sampler, not started yet → offer it (+ a pointer to the full pack) ----
  if (isSampler && seats.length === 0) {
    return (
      <section className="space-y-6 pb-12">
        <Link
          href={backLink}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Back to Papic
        </Link>
        <div className="rounded-2xl border border-terracotta/30 bg-surface p-7 text-center">
          <Sparkles aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Try Papic free</h1>
          <p className="mx-auto mt-2 max-w-prose text-sm text-ink/65">
            Spin up {PAPIC_SAMPLER_SEAT_COUNT} free seats and hand them to friends.
            Each shoots up to {PAPIC_SAMPLER_PHOTO_CAP} photos and {PAPIC_SAMPLER_CLIP_CAP}{' '}
            short clips — every shot lands in your gallery so you feel exactly how
            Papic works. Free photos are kept for {PAPIC_SAMPLER_RETENTION_DAYS} days;
            connect Google Drive or upgrade to keep them forever.
          </p>
          <form action={provisionPapicSampler} className="mt-5">
            <input type="hidden" name="event_id" value={eventId} />
            <SubmitButton
              pendingLabel="Starting…"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600"
            >
              <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
              Start my {PAPIC_SAMPLER_SEAT_COUNT} free seats
            </SubmitButton>
          </form>
          <Link
            href={backLink}
            className="mt-4 inline-block text-xs font-medium text-ink/55 underline-offset-2 hover:text-ink/80 hover:underline"
          >
            Or get the full photo-crew pack ({PAPIC_SEAT_COUNT} seats, unlimited)
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
      const claimUrl = papicSeatClaimUrl(appUrl, s.claim_qr_token);
      const qrSvg = await renderUrlQrSvg(claimUrl, 128);
      return { ...s, claimUrl, qrSvg };
    }),
  );

  const claimedCount = seats.filter((s) => s.claimer_user_id).length;
  const seatTotal = isSampler ? PAPIC_SAMPLER_SEAT_COUNT : PAPIC_SEAT_COUNT;

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
          {isSampler ? 'Papic · free sampler' : 'Papic · your photo crew'}
        </p>
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {isSampler ? (
            <Sparkles aria-hidden className="h-7 w-7 text-terracotta" strokeWidth={1.75} />
          ) : (
            <Camera aria-hidden className="h-7 w-7 text-terracotta" strokeWidth={1.75} />
          )}
          {isSampler ? 'Your free Papic sampler' : 'Your photo crew'}
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          {isSampler ? (
            <>
              {PAPIC_SAMPLER_SEAT_COUNT} free seats, {PAPIC_SAMPLER_SEAT_COUNT} friends.
              Share a seat link (or QR) with each one. They claim it from their own
              phone — no app to install — shoot up to {PAPIC_SAMPLER_PHOTO_CAP} photos
              and {PAPIC_SAMPLER_CLIP_CAP} clips, tag a guest by scanning their QR,
              and every shot lands in your gallery.
            </>
          ) : (
            <>
              Five seats, five friends. Share a seat link (or QR) with each person
              you want shooting. They claim it from their own phone — no app to
              install — and every photo they take lands in your gallery in real
              time.
            </>
          )}
        </p>
        {seats.length > 0 && (
          <p className="text-sm text-ink/55">
            {claimedCount} of {seats.length} seats claimed.
          </p>
        )}
      </header>

      {isSampler && (
        <div className="flex items-start gap-2 rounded-lg border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm text-ink/80">
          <Clock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
          <span>
            {samplerExpiringCount > 0 && samplerDaysLeft !== null ? (
              <>
                <b className="font-medium">
                  Your {samplerExpiringCount} free{' '}
                  {samplerExpiringCount === 1 ? 'photo' : 'photos'}{' '}
                  {samplerDaysLeft === 0
                    ? 'expire today'
                    : `expire in ${samplerDaysLeft} ${samplerDaysLeft === 1 ? 'day' : 'days'}`}
                  .
                </b>{' '}
              </>
            ) : (
              <>Free sampler photos are kept for {PAPIC_SAMPLER_RETENTION_DAYS} days. </>
            )}
            Connect Google Drive (your own copy) or upgrade to full Papic to keep
            them forever — and unlock all five seats with unlimited shots.{' '}
            <Link href={backLink} className="font-medium text-terracotta underline-offset-2 hover:underline">
              See the full pack
            </Link>
            .
          </span>
        </div>
      )}

      {(seatSet === 'provisioned' || seatSet === 'sampler') && (
        <div className="flex items-start gap-2 rounded-lg border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm text-ink/80">
          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
          {seatSet === 'sampler'
            ? `Your ${PAPIC_SAMPLER_SEAT_COUNT} free seats are ready. Share a link with each friend below.`
            : 'Your five seats are ready. Share a link with each friend below.'}
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
          <h2 className="mt-3 text-xl font-semibold tracking-tight">Set up your {seatTotal} seats</h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-ink/65">
            Create your {seatTotal} photo-crew seats. Each gets its own claim link you
            can hand to a friend.
          </p>
          <form action={provisionPapicSeats} className="mt-5">
            <input type="hidden" name="event_id" value={eventId} />
            <SubmitButton
              pendingLabel="Setting up…"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600"
            >
              <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
              Set up my {seatTotal} seats
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
                    {isSampler ? `Free seat ${s.seat_index - 100}` : `Seat ${s.seat_index}`}
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

                {isSampler && (
                  <p className="mt-1 text-xs text-ink/50">
                    Up to {PAPIC_SAMPLER_PHOTO_CAP} photos + {PAPIC_SAMPLER_CLIP_CAP} clips
                  </p>
                )}

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
