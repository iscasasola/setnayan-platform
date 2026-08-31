import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { guestAvatarsEnabled } from '@/lib/venue-avatars';
import { AvatarMakerLoader } from './_components/avatar-maker-loader';

/**
 * THE AVATAR MAKER — `/{slug}/avatar`.
 *
 * The 3D room was finished and good and full of strangers. This is where a
 * guest stops being one. It writes `guests.avatar_config`, the JSONB column
 * that has existed since migration 20270918210897 with no writer.
 *
 * Per-request (the guest session cookie decides everything), so `force-dynamic`
 * — the same posture as `/{slug}/venue`, which this page links back to.
 *
 * 🔒 SIGNED-IN GUESTS ONLY, and only their own row. The session cookie is the
 * same one `submitRsvp` / `withdrawFaceConsent` trust; a visitor without one is
 * sent to the event page, which is where the lock screen explains how to get in
 * — exactly what `/venue` does for an unredeemed guest, rather than a dead end.
 *
 * 🚩 FLAG-DARK BY DEFAULT. `NEXT_PUBLIC_FIGURE_CHIBI` (the EXISTING chibi
 * switch, not a new one) gates the whole route: unset — production's only state
 * so far — and this is a 404, so the maker cannot be reached, no config can be
 * written, and the room keeps rendering exactly as it does today.
 */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Make your avatar' };

export default async function AvatarMakerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // The gate first — before any read. A 404 on an unflagged deployment must not
  // be distinguishable (by timing or by error) from a route that does not exist.
  if (!guestAvatarsEnabled()) notFound();

  const admin = createAdminClient();
  // `.ilike`, NOT `.eq` — the case-sensitivity bug that made `/Cale-Ice/venue`
  // a dead end while `/Cale-Ice` opened fine. 8 of the 10 guest sub-routes
  // already follow this; this one is written that way from the start.
  const { data: event, error } = await admin
    .from('events')
    .select('event_id, slug, event_type, display_name')
    .ilike('slug', slug)
    .maybeSingle();

  // A failed read is NOT a missing event — the rule the rest of the guest site
  // learned the hard way. Saying "no such wedding" because a query stumbled is
  // the lie.
  if (error) {
    throw new Error(`avatar: could not read the event for "${slug}": ${error.message}`);
  }
  if (!event) notFound();

  // 🪑 An avatar only means something in a room with seats. The same surface
  // check `/venue` makes, for the same reason: a kind of event that will never
  // have a floor plan should not be offered a figure to put in one. Empty
  // string → GENERIC_PROFILE, which enables seating, so an unreadable type
  // keeps its door (fail open, exactly as `/venue` does).
  const eventType = (event as { event_type?: string | null }).event_type ?? '';
  if (!surfaceEnabled(await resolveProfile(eventType), 'seating')) notFound();

  const eventId = (event as { event_id: string }).event_id;
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId) {
    redirect(`/${slug}`);
  }

  const { data: guest } = await admin
    .from('guests')
    .select('guest_id, avatar_config, display_name, first_name')
    .eq('event_id', eventId)
    .eq('guest_id', session.guest_id)
    .is('deleted_at', null)
    .maybeSingle();

  // The session named a guest this event does not have (a deleted row, a stale
  // cookie). Same destination as a missing session — the event's own page.
  if (!guest) redirect(`/${slug}`);

  const row = guest as {
    guest_id: string;
    avatar_config: unknown;
    display_name: string | null;
    first_name: string | null;
  };

  return (
    <main className="min-h-screen bg-[#0b0d12] p-3 sm:p-5">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-center justify-between px-1">
          <h1 className="text-lg font-medium text-white">Make your avatar</h1>
          <Link href={`/${slug}`} className="text-sm text-white/60 hover:text-white">
            ← Back
          </Link>
        </div>
        <p className="mb-4 px-1 text-sm text-white/55">
          This is you in the 3D room. Nobody has to make one — leave it and
          you&rsquo;ll look the same as you do now.
        </p>
        <AvatarMakerLoader
          eventId={eventId}
          slug={(event as { slug: string | null }).slug ?? slug}
          figureId={row.guest_id}
          initialConfig={row.avatar_config ?? null}
          hasSaved={row.avatar_config != null}
        />
      </div>
    </main>
  );
}
