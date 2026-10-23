import Link from 'next/link';
import { logQueryError } from '@/lib/supabase/error-detect';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowLeft, Camera, CircleAlert, Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { renderUrlQrSvg } from '@/lib/qr';
import { sharedJoinLinkState } from '@/lib/shared-join-link';
import { CopyButton } from './_components/copy-button';
import { PageMasthead } from '@/app/_components/page-masthead';

// Papic · One code for everyone (couple-side).
//
// ⛔ THE PER-SEAT CARDS ARE GONE (owner 2026-10-23, of "Free camera 1 / 2 / 3 / Free camera / Free camera
// 51" — each with its own link, QR and Reset link: "why do i have these?"). They were a camera per seat,
// and the 2026-09-16 ruling retired that model: *"we do not have papic seat. we only have papic with credits
// and shared amongst everybody."* ("Free camera 51" was not even a crew camera — it was seat 150, the
// couple's OWN uploads camera, mislabelled by the `>= 100` branch.)
//
// What stays is the one thing a couple hands out: the event's shared join code. Anyone who scans it lands
// on the Event Hub with a camera that shoots from the shared credits. Each guest's own invite QR is their
// camera too. The seats themselves are untouched in the database — a seat is the camera CLAIM a phone
// holds, never an allowance — and `papic_event_point_grants.seat_id` (the free camera grant the owner said
// "should stay" on 2026-09-22) is server machinery nobody hands out, so nothing here shows it.
//
// Gated: signed-in couple on the event. Force-dynamic — per-request auth + the live join link.

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ eventId: string }>;
  /** `seat_set` / `seat_error` were the per-seat cards' confirmations — accepted and ignored now. */
  searchParams: Promise<{ seat_set?: string; seat_error?: string }>;
};

export default async function PapicCrewPage({ params }: Props) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership, error: membershipError } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  // ⚠ the viewer's membership. Absence DENIES rather than renders.
  if (membershipError) {
    logQueryError('PapicCrewPage.membership', membershipError, { eventId }, 'graceful_degrade');
  }
  if (!membership || membership.member_type !== 'couple') {
    redirect(`/dashboard/${eventId}`);
  }

  const backLink = `/dashboard/${eventId}/studio/papic`;

  const { data: eventRow, error: eventRowError } = await supabase
    .from('events')
    .select('slug, landing_page_visibility, scheduled_launch_at, std_launched_at')
    .eq('event_id', eventId)
    .maybeSingle();
  // ⚠ the event record. Degrades rather than claiming.
  if (eventRowError) {
    logQueryError('PapicCrewPage.eventRow', eventRowError, { eventId }, 'graceful_degrade');
  }
  const eventSlug = (eventRow as { slug?: string | null } | null)?.slug ?? null;

  // ⚠ CAN THE POSTER QR ACTUALLY BE SCANNED? Until 2026-08-10 this page printed
  // it from the slug alone, so a PRIVATE event handed the host a QR that opens
  // to "Link not found" — the invite door refuses private events by design
  // (2026-08-06) and nothing here knew. See lib/shared-join-link.ts.
  const { data: joinTokenRow, error: joinTokenRowError } = await supabase
    .from('event_join_tokens')
    .select('token, revoked_at, expires_at')
    .eq('event_id', eventId)
    .maybeSingle();
  // ⚠ the join link for the crew. Refused, the page offers no way in and looks as
  // ⚠ though sharing was never set up.
  if (joinTokenRowError) {
    logQueryError('PapicCrewPage.joinTokenRow', joinTokenRowError, { eventId }, 'graceful_degrade');
  }
  const joinTokenValid =
    !!joinTokenRow?.token &&
    !joinTokenRow.revoked_at &&
    (!joinTokenRow.expires_at || new Date(joinTokenRow.expires_at) > new Date());
  const posterLink = sharedJoinLinkState({
    event: (eventRow ?? {}) as Parameters<typeof sharedJoinLinkState>[0]['event'],
    tokenValid: joinTokenValid,
  });

  const h = await headers();
  const host = h.get('host') ?? 'www.setnayan.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const appUrl = `${proto}://${host}`;

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

      <PageMasthead
        titleNode={
          <>
            <Camera aria-hidden strokeWidth={1.75} />
            One code for everyone
          </>
        }
      />

      {poolJoinUrl && poolQrSvg ? (
        <div className="rounded-2xl border-2 border-terracotta/40 bg-terracotta/[0.04] p-5 sm:p-6">
          <div className="flex flex-wrap items-start gap-5">
            <div
              aria-hidden
              className="shrink-0 rounded-xl bg-white p-2 [&>svg]:h-32 [&>svg]:w-32"
              dangerouslySetInnerHTML={{ __html: poolQrSvg }}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="text-lg font-semibold tracking-tight text-ink">Print it, or show it at the door</h2>
              <p className="max-w-prose text-sm text-ink/70">
                Anyone who scans it gets a camera and shoots from your shared credits — no app, no
                sign-up. Each guest&rsquo;s own invite QR is their camera too.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <CopyButton value={poolJoinUrl} />
                <Link
                  href={`${backLink}/crew/poster`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/10 hover:text-ink"
                >
                  <Printer aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Print the poster
                </Link>
              </div>
              <p className="pt-1 text-xs text-ink/50">
                Anyone holding this code can shoot. Reprint from a fresh code if it ends up somewhere you
                didn&rsquo;t intend.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ⚠ SAY WHY, DO NOT JUST VANISH. A private event's invite door refuses scanners by design, so a QR
           printed anyway opens to "Link not found"; the refusal is deliberate, only silence would be the
           defect. Every state that is not usable carries its notice (`lib/shared-join-link.ts`). */
        <div className="rounded-2xl border-2 border-dashed border-ink/20 bg-ink/[0.02] p-5 sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <CircleAlert aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-terracotta" strokeWidth={1.75} />
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="text-lg font-semibold tracking-tight text-ink">Not working yet</h2>
              <p className="max-w-prose text-sm text-ink/70">
                {posterLink.notice ?? 'We couldn’t check your shared code just now. Reload the page to try again.'}
              </p>
              {posterLink.state === 'private' ? (
                <Link
                  href={`/dashboard/${eventId}/website`}
                  className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-mulberry px-3 py-2 text-xs font-medium text-cream hover:bg-mulberry-600"
                >
                  Open your Event Hub settings
                </Link>
              ) : null}
              <p className="pt-1 text-xs text-ink/50">
                Your guests&rsquo; own invite QRs still work — this only affects the one shared code.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
