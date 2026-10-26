import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/is-uuid';
import { GuestCard } from '../_components/guest-card';
import { readGuestCard } from '../_components/guest-card-read';
import { guestCardErrorCopy } from '../_components/guest-card-error-copy';
import { guestCardFlash } from '../_components/guest-card-flash';
import { UndoToastHost } from '../_components/undo-toast';

export const metadata = { title: 'Guest detail' };

/**
 * The standalone guest route. Since 2026-09-22 it is a LOADER, not a screen of
 * its own: it renders the same `GuestCard` the roster opens in place, so
 * the two presentations of a guest can never drift.
 *
 * ── Why it still exists ─────────────────────────────────────────────────────
 * Nothing in the UI links here any more — a guest opens as a panel over the
 * roster. This route stays because a URL that used to work should keep working:
 * it is the deep link, the hard-load fallback, the print target, and where a
 * failed save lands for a host who opened a guest directly.
 *
 * The card SAVES ITSELF here too. One behaviour, not two — a Save button on
 * this route and autosave on the panel would be exactly the divergence the
 * merge was done to end.
 */

type Props = {
  params: Promise<{ eventId: string; guestId: string }>;
  searchParams: Promise<{ error?: string; saved?: string; invite?: string; swapped?: string; unlinked?: string; new_qr?: string }>;
};

export default async function GuestDetailPage({ params, searchParams }: Props) {
  const { eventId, guestId } = await params;
  // 🔑 A MALFORMED ADDRESS IS "NOT FOUND", NEVER A CRASH. A non-UUID segment
  // makes Postgres reject the query (22P02), and `fetchGuestById` deliberately
  // RE-THROWS every error except a missing relation — so `/guests/{guest}`
  // rendered the global error boundary ("Something on our end didn't work")
  // instead of a 404 (measured on prod 2026-09-29). Checked once, here, before
  // any query sees the segment. See lib/is-uuid.ts.
  if (!isUuid(guestId) || !isUuid(eventId)) notFound();
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // The card and everything drawn on it — the one reader every in-place card uses too (`readGuestCard`).
  const read = await readGuestCard(supabase, eventId, guestId, user.id);
  if (!read) notFound();
  const { guest } = read.data;

  /* Said in the card's own words — a code it knows, a sentence an action wrote for the host, or one plain line; never the database's. */
  const errorMessage = search.error ? guestCardErrorCopy(search.error) : null;

  // What the careful actions did — said on the card they were pressed on (`guest-card-flash.ts`, the in-place door says the same).
  const inviteFlash = guestCardFlash(search, guest.email);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-16">
      <Link
        href={`/dashboard/${eventId}/guests`}
        className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta-700"
      >
        ‹ Back to guest list
      </Link>

      {/* 🪪 THE ONE GUEST CARD (`GuestCard`, owner 2026-10-24) — its page frame. */}
      <GuestCard
        frame="page"
        eventId={eventId}
        {...read}
        returnTo={`/dashboard/${eventId}/guests/${guestId}`}
        errorMessage={errorMessage}
        inviteFlash={inviteFlash}
      />

      {/* The undo snackbar the card's autosave pushes to. The roster mounts its
          own; without one here an undo on this route would restore the row and
          show the host nothing — the failure mode the undo exists to prevent. */}
      <UndoToastHost />
    </div>
  );
}
