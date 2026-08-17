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
import { createAdminClient } from '@/lib/supabase/admin';
import { crewHolderName, crewShotsLeftLabel } from '@/lib/papic-crew-roster';
import {
  eventPapicSeatsActive,
  fetchPapicSeats,
  papicSeatJoinUrl,
} from '@/lib/papic-seats';
import { PAPIC_FREE_ONE_CAMERA_INDEX } from '@/lib/papic-cameras';
import { renderUrlQrSvg } from '@/lib/qr';
import { sharedJoinLinkState } from '@/lib/shared-join-link';
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
  const { data: eventRow } = await supabase
    .from('events')
    .select('slug, landing_page_visibility, scheduled_launch_at, std_launched_at')
    .eq('event_id', eventId)
    .maybeSingle();
  const eventSlug = (eventRow as { slug?: string | null } | null)?.slug ?? null;

  // ⚠ CAN THE POSTER QR ACTUALLY BE SCANNED? Until 2026-08-10 this page printed
  // it from the slug alone, so a PRIVATE event handed the host a QR that opens
  // to "Link not found" — the invite door refuses private events by design
  // (2026-08-06) and nothing here knew. See lib/shared-join-link.ts.
  const { data: joinTokenRow } = await supabase
    .from('event_join_tokens')
    .select('token, revoked_at, expires_at')
    .eq('event_id', eventId)
    .maybeSingle();
  const joinTokenValid =
    !!joinTokenRow?.token &&
    !joinTokenRow.revoked_at &&
    (!joinTokenRow.expires_at || new Date(joinTokenRow.expires_at) > new Date());
  const posterLink = sharedJoinLinkState({
    event: (eventRow ?? {}) as Parameters<typeof sharedJoinLinkState>[0]['event'],
    tokenValid: joinTokenValid,
  });

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

  // ── WHO IS HOLDING WHICH CAMERA ────────────────────────────────────────────
  //
  // 🔒 SCOPED TO THIS EVENT, AND TO ONE FIELD. The only user ids read are the
  // claimers of THIS event's seats, and the only column selected is the display
  // name — never the email sitting beside it. This page is already gated above
  // to a signed-in `couple` member of the event.
  //
  // ⚠ IT HAS TO BE THE SERVICE-ROLE CLIENT. `public.users` carries exactly two
  // policies — `user_owns_row` and admin — so a couple reading another
  // person's row under their own session gets ZERO ROWS AND NO ERROR. That is
  // indistinguishable from "this seat is unclaimed", which is precisely the
  // wrong answer to render here: the screen would have looked fixed and shown
  // nothing.
  const claimerIds = [...new Set(seats.map((s) => s.claimer_user_id).filter(Boolean))] as string[];
  const nameByUserId = new Map<string, string>();
  if (claimerIds.length > 0) {
    const { data: holders } = await createAdminClient()
      .from('users')
      .select('user_id, display_name')
      .in('user_id', claimerIds);
    for (const h of (holders ?? []) as Array<Record<string, unknown>>) {
      if (typeof h.user_id === 'string' && typeof h.display_name === 'string') {
        nameByUserId.set(h.user_id, h.display_name);
      }
    }
  }

  const seatViews = await Promise.all(
    seats.map(async (s) => {
      // Hybrid join link: native app opens directly when installed, otherwise
      // forwards to the existing /papic/claim flow. Legacy /papic/claim links
      // still work, so any QR printed before this stays valid.
      const claimUrl = papicSeatJoinUrl(appUrl, s.claim_qr_token);
      const qrSvg = await renderUrlQrSvg(claimUrl, 128);

      // How many shots this camera has left. `papic_camera_points_remaining` is
      // SECURITY DEFINER and — checked in production — is EXECUTE-granted to
      // `authenticated`, so it runs on the couple's own client. (Its sibling
      // `papic_seat_dedicated_points` is NOT granted; calling that one from here
      // would fail silently.) Display only: the fail-closed spend gate is
      // `papic_reserve_capture_split`, and this must never become a second
      // opinion about whether a camera may shoot.
      let remaining: number | null = null;
      if (s.claimer_user_id) {
        const { data: pts, error: ptsErr } = await supabase.rpc(
          'papic_camera_points_remaining',
          { p_seat_id: s.seat_id },
        );
        // A failed probe stays null and the row simply says nothing about
        // shots — never 0, which on this screen means "that camera has
        // stopped" and would send a host to fix a camera that is fine.
        remaining = !ptsErr && typeof pts === 'number' ? pts : null;
      }

      return {
        ...s,
        claimUrl,
        qrSvg,
        holderName: s.claimer_user_id
          ? crewHolderName(nameByUserId.get(s.claimer_user_id))
          : null,
        shotsLeftLabel: crewShotsLeftLabel(remaining),
      };
    }),
  );

  const claimedCount = seats.filter((s) => s.claimer_user_id).length;

  // ── THE POSTER QR — the EVENT SITE's own join link ─────────────────────────
  //
  // ⚠ REWRITTEN 2026-08-02. The first version of this minted a bespoke
  // `papic_pool_token` and pointed at a standalone /papic/pool/[token] camera.
  // That was a SECOND DOOR built beside one that already existed: `/{slug}/invite`
  // is the shared join link the couple already hands out, already rotatable and
  // revocable, already feeding the guest list's self-join reconcile queue. Both
  // the bespoke route and its column are gone (zero were ever minted).
  //
  // Pointing the poster at the event site is also the BETTER experience, not
  // just the cheaper one. A scanner lands on the guest site and gets all three
  // things: a camera, their own QR so others can tag them, and a gallery of
  // photos of them. The standalone camera gave only the first — so a poster
  // scanner could shoot but could never receive.
  //
  // Requires a slug (the site's address). No slug ⇒ no poster, rather than a QR
  // pointing nowhere.
  const posterUrl = posterLink.usable ? `${appUrl}/${eventSlug}/invite` : null;
  const poolJoinUrl = posterUrl;
  const poolQrSvg = poolJoinUrl ? await renderUrlQrSvg(poolJoinUrl, 200) : null;

  return (
    <section className="space-y-8 pb-12">
      <Link
        href={backLink}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Papic
      </Link>

      <header className="sn-reveal space-y-3">
        <p className="sn-eye">Crew</p>
        <h1 className="sn-h1 flex items-center gap-3">
          <Camera aria-hidden className="h-7 w-7 text-terracotta" strokeWidth={1.75} />
          Your photo crew
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Share a link (or QR) with each person you want shooting. They claim it
          from their own phone — no app to install — and every photo they take
          lands in your gallery in real time.
        </p>
        {seats.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink/55">
              {claimedCount} of {seats.length} cameras claimed.
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
          {/* ⚠ Was "Your five seats are ready" — a hardcoded count from the
              retired PAPIC_SEATS pass. Papic One has no seat cap and Pool
              cameras are unlimited, so the number is read off the roster we
              just fetched, never spelled. */}
          Your {seats.length === 1 ? 'camera is' : `${seats.length} cameras are`} ready.
          Share a link with each friend below.
        </div>
      )}
      {seatSet === 'reissued' && (
        <div className="flex items-start gap-2 rounded-lg border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm text-ink/80">
          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
          Camera reissued — the old link no longer works. Share the fresh one.
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
          {/* ⚠ NO SEAT COUNT HERE. This said "Top up your 5 seats" / "Your 5
              photo-crew seats", from PAPIC_SEAT_COUNT — the count of the RETIRED
              PAPIC_SEATS pass. What an event actually gets is
              PAPIC_FREE_CAMERA_COUNT (3) shared-pool cameras plus the free Papic
              One, and a paid event gets however many it bought. Five was true of
              none of them.
              🪤 The message 20 lines below was fixed for exactly this reason and
              carries a comment saying so — but it is the branch that renders
              when seats EXIST, and this is the branch that renders when they do
              not. One arm got the fix; the other kept the stale number. So the
              count is simply not spelled here: this is the ZERO state, and the
              roster it would describe is the thing that does not exist yet. */}
          <h2 className="mt-3 text-xl font-semibold tracking-tight">Set up your crew cameras</h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-ink/65">
            Your photo-crew cameras are set up automatically the moment your
            order is approved. If any are missing, tap below to fill them in — each
            gets its own claim link and QR you can hand to a friend.
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
              Fill in my crew cameras
            </SubmitButton>
          </form>
        </div>
      ) : (
        <>
        {poolJoinUrl && poolQrSvg ? (
          <div className="rounded-2xl border-2 border-terracotta/40 bg-terracotta/[0.04] p-5 sm:p-6">
            <div className="flex flex-wrap items-start gap-5">
              <div
                aria-hidden
                className="shrink-0 rounded-xl bg-white p-2 [&>svg]:h-32 [&>svg]:w-32"
                dangerouslySetInnerHTML={{ __html: poolQrSvg }}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  One code for everyone
                </h2>
                <p className="max-w-prose text-sm text-ink/70">
                  Print this, put it on a table. Anyone who scans it gets their
                  own camera and shoots into your shared pool — no app, no
                  sign-up, and it never runs out of cameras. It stops when your
                  shots do.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <CopyButton value={poolJoinUrl} />
                  <Link
                    href={`${backLink}/crew/poster`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/10 hover:text-ink"
                  >
                    <Printer aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    Print the poster
                  </Link>
                </div>
                <p className="pt-1 text-xs text-ink/50">
                  Anyone holding this code can shoot. Reprint from a fresh code
                  if it ends up somewhere you didn&rsquo;t intend.
                </p>
              </div>
            </div>
          </div>
        ) : posterLink.notice ? (
          /* ⚠ SAY WHY, DO NOT JUST VANISH. The QR used to be printed from the
             slug alone, so a private event handed the host a code that opens to
             "Link not found" — and simply hiding it here would be the same
             silence one step earlier: the host would ask where the shared code
             went, or print an old one. The door's refusal is deliberate; only
             its silence was the defect. */
          <div className="rounded-2xl border-2 border-dashed border-ink/20 bg-ink/[0.02] p-5 sm:p-6">
            <div className="flex flex-wrap items-start gap-4">
              <CircleAlert
                aria-hidden
                className="mt-0.5 h-6 w-6 shrink-0 text-terracotta"
                strokeWidth={1.75}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  One code for everyone — not working yet
                </h2>
                <p className="max-w-prose text-sm text-ink/70">{posterLink.notice}</p>
                {posterLink.state === 'private' ? (
                  <Link
                    href={`/dashboard/${eventId}/website`}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3 py-2 text-xs font-medium text-cream hover:bg-mulberry-600"
                  >
                    Open your Event Hub settings
                  </Link>
                ) : null}
                <p className="pt-1 text-xs text-ink/50">
                  The named cameras below still work — this only affects the one
                  shared code.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {seatViews.map((s) => {
            const claimed = Boolean(s.claimer_user_id);
            return (
              <div key={s.seat_id} className="rounded-xl border border-ink/10 bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">
                    {/* The free Papic ONE camera sits at a FIXED index (110),
                     *  deliberately clear of the free SHARED range (100..102).
                     *  The `>= 100` branch swallowed it and rendered
                     *  "Free camera 11" (110 − 99), while papic-cameras-card.tsx
                     *  calls the same seat "Camera #110" — one camera with two
                     *  names, neither of which says what it is. It is the one
                     *  camera here whose shots are its OWN, so it is named for
                     *  that, and the check must come FIRST or the range test
                     *  wins again. */}
                    {s.seat_index >= 200
                      ? `Camera ${s.seat_index - 199}` /* paid per-camera (index base 200) */
                      : s.seat_index === PAPIC_FREE_ONE_CAMERA_INDEX
                        ? 'Free camera'
                        : s.seat_index >= 100
                          ? `Free camera ${s.seat_index - 99}` /* free shared pool (100..102) */
                          : `Seat ${s.seat_index}`}
                  </p>
                  {claimed ? (
                    /* The pill now carries the NAME, because "Claimed" was the
                       one thing the host could already work out from the
                       missing QR. Falls back to "Claimed" only when the holder
                       has no name to show at all. */
                    <span className="inline-flex max-w-[60%] items-center gap-1.5 rounded-full bg-terracotta/10 px-2.5 py-1 text-xs font-medium text-mulberry">
                      <UserCheck aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      <span className="truncate">{s.holderName ?? 'Claimed'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-ink/60">
                      Open
                    </span>
                  )}
                </div>

                {claimed ? (
                  <>
                    <p className="mt-2 text-sm text-ink/65">
                      {s.holderName
                        ? `${s.holderName} has this camera and can shoot.`
                        : 'A friend has this seat and can shoot.'}{' '}
                      Reissue it to hand the camera to someone else — the old
                      link stops working.
                    </p>
                    {/* Only rendered when the number is actually known. "Out of
                        shots" is the state a host is looking for, so it is the
                        one that gets the loud colour. */}
                    {s.shotsLeftLabel ? (
                      <p
                        className={`mt-1.5 text-xs font-medium ${
                          s.shotsLeftLabel === 'Out of shots'
                            ? 'text-mulberry-600'
                            : 'text-ink/55'
                        }`}
                      >
                        {s.shotsLeftLabel}
                      </p>
                    ) : null}
                  </>
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
        </>
      )}
    </section>
  );
}
