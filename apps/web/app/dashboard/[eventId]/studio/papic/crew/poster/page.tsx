import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { renderUrlQrSvg } from '@/lib/qr';
import { sharedJoinLinkState } from '@/lib/shared-join-link';

// Papic · the printable POSTER (owner-locked 2026-08-01).
//
// ONE code for the whole event, big enough to read across a table. Anyone who
// scans gets their own camera on the shared pool — no limit, first come first
// served. This is the physical object the Pool product always described and
// never had; before it, the only printable codes were per-seat cards, single
// use, first scanner takes it.
//
// Sibling of crew/print (the per-seat card pack) and deliberately separate: that
// sheet is N small cards to HAND OUT, this is one big code to LEAVE OUT. Same
// couple-only gate, same force-dynamic.

export const metadata = { title: 'Print your Papic poster' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

export default async function PapicPoolPosterPage({ params }: Props) {
  const { eventId } = await params;

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

  const { data: event } = await supabase
    .from('events')
    .select('display_name, slug, landing_page_visibility, scheduled_launch_at, std_launched_at')
    .eq('event_id', eventId)
    .maybeSingle();

  // ⚠ NEVER PRINT A DEAD QR. This is the worst place the 2026-08-10 bug landed:
  // a poster goes on a table at a real party, and a private event's join link
  // answers "Link not found" to everyone who scans it. There is no way to
  // correct a printed sheet. If the link cannot work, bounce back to /crew,
  // which now says WHY and links to the screen that fixes it — one explanation,
  // not a second copy of it on a print stylesheet.
  const { data: joinTokenRow } = await supabase
    .from('event_join_tokens')
    .select('token, revoked_at, expires_at')
    .eq('event_id', eventId)
    .maybeSingle();
  const posterLink = sharedJoinLinkState({
    event: (event ?? {}) as Parameters<typeof sharedJoinLinkState>[0]['event'],
    tokenValid:
      !!joinTokenRow?.token &&
      !joinTokenRow.revoked_at &&
      (!joinTokenRow.expires_at || new Date(joinTokenRow.expires_at) > new Date()),
  });
  if (!posterLink.usable) redirect(`/dashboard/${eventId}/studio/papic/crew`);

  // ⚠ The poster encodes the EVENT SITE's own join link, not a bespoke Papic
  // token. The first version minted its own and pointed at a standalone camera —
  // a second door beside `/{slug}/invite`, which already existed, is already
  // rotatable, and lands the scanner somewhere strictly better: the guest site,
  // where they get a camera AND their own QR to be tagged by AND a gallery of
  // photos of them. The standalone camera gave only the first of the three.
  // Non-null by construction: `posterLink.usable` is false without a slug.
  const slug = (event as { slug?: string | null } | null)?.slug ?? null;
  if (!slug) redirect(`/dashboard/${eventId}/studio/papic/crew`);

  const h = await headers();
  const host = h.get('host') ?? 'www.setnayan.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const joinUrl = `${proto}://${host}/${slug}/invite`;
  // Large: this is read from across a table, not from a card in the hand.
  const qrSvg = await renderUrlQrSvg(joinUrl, 520);

  const eventName = (event as { display_name?: string | null } | null)?.display_name ?? null;

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-white px-8 py-12 text-center text-ink print:px-0 print:py-0">
      <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Be our photographer</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        {eventName ?? 'Our event'}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-ink/70">
        Point your camera at the code. Your phone becomes a camera for the day —
        no app, no sign-up.
      </p>

      <div
        aria-hidden
        className="mx-auto mt-8 w-fit rounded-2xl bg-white p-4 [&>svg]:h-[420px] [&>svg]:w-[420px]"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />

      <p className="mx-auto mt-6 max-w-md text-sm text-ink/60">
        Every photo lands in our gallery. Shoot anything — the candids are the
        ones we&rsquo;ll never get otherwise.
      </p>

      {/* The URL in text, for anyone whose camera will not scan. Small, and the
          only place the capability appears in readable form — which is exactly
          why the poster should not be left anywhere it is not meant to be. */}
      <p className="mt-8 break-all text-[11px] text-ink/35 print:mt-6">{joinUrl}</p>

      <p className="mt-10 text-xs text-ink/40 print:hidden">
        Print this page, or save it as a PDF. One code — everyone scans the same
        one.
      </p>
    </main>
  );
}
