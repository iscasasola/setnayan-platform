/**
 * /join/[eventId]/connect/confirm — "THIS INVITATION IS FOR <NAME>. SAVE IT TO
 * <EMAIL>?" (2026-09-30, the owner's own wedding).
 *
 * Every sign-in or sign-up that returns through `/join/{id}/connect` stops here
 * before a seat becomes an account's — the connect route binds nothing on its
 * own. The name is what tells the second person on a shared phone that this
 * invitation is not theirs; the address is what tells them where it would go.
 *
 *   · Yes, save it → `confirmSeatLinkAction` binds exactly this seat.
 *   · Not me       → the guest pass in this browser is cleared (the event's own
 *                    `/{slug}/sign-out`, a POST) when that is how the seat was
 *                    found; otherwise home. Nothing is bound.
 *   · A couple seat this account may not hold → said plainly, no Yes at all
 *     (lib/seat-binding.ts `COUPLE_SEAT_REFUSED`).
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { findSeatToConnect } from '@/lib/event-account-link';
import { CONNECT_THEN_REPLY, connectQuery } from '@/lib/invite-arrival';
import { COUPLE_SEAT_REFUSED, seatConfirmLine } from '@/lib/seat-binding';
import { isPlaceholderEmail } from '@/lib/anon-onboarding';
import { SubmitButton } from '@/app/_components/submit-button';
import { DoorShell, DoorNotice, DoorActions } from '@/app/_components/door/door-shell';
import { confirmSeatLinkAction } from './actions';

export const metadata = { title: 'Save this invitation?' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ then?: string; approved?: string; failed?: string }>;
};

export default async function ConfirmSeatLinkPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const sp = await searchParams;
  const thenReply = sp.then === CONNECT_THEN_REPLY;
  const approved = typeof sp.approved === 'string' && sp.approved ? sp.approved : null;
  const carry = connectQuery({ thenReply, approved });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${eventId}/connect${carry}`)}`);

  const seat = await findSeatToConnect(eventId, user.id, user.email ?? null, approved);
  // Nothing to ask about (already inside, or no seat here) → the connect route
  // decides where they land, exactly as it did before this page existed.
  if (!seat) redirect(`/join/${eventId}/connect${carry}`);

  const { data: event } = await createAdminClient()
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  const slug = ((event?.slug as string | null) ?? '').trim();
  const accountEmail = user.email && !isPlaceholderEmail(user.email) ? user.email : null;
  const line = seatConfirmLine({ seatName: seat.name, accountEmail });

  // "Not me": when the seat came from THIS browser's guest pass, drop the pass
  // (so the next sign-in on this phone is not asked about it again).
  const notMe =
    seat.via === 'cookie' && slug ? (
      <form action={`/${slug}/sign-out`} method="post">
        <button type="submit" className="button-secondary w-full">
          Not me
        </button>
      </form>
    ) : (
      <Link href="/" className="button-secondary">
        Not me
      </Link>
    );

  if (seat.refusal) {
    return (
      <DoorShell eyebrow="Your invitation" title="This invitation is not yours to keep" tone="dead_end">
        <DoorNotice kind="alert">{COUPLE_SEAT_REFUSED}</DoorNotice>
        <DoorActions>{notMe}</DoorActions>
      </DoorShell>
    );
  }

  return (
    <DoorShell eyebrow="Your invitation" title={line.whose} sub={line.where}>
      {sp.failed ? (
        <DoorNotice kind="alert">We could not save it just now. Please try again.</DoorNotice>
      ) : null}
      <DoorActions>
        <form action={confirmSeatLinkAction.bind(null, eventId, seat.guestId, thenReply, approved)}>
          <SubmitButton className="button-primary w-full" pendingLabel="Saving…">
            Yes, save it
          </SubmitButton>
        </form>
        {notMe}
      </DoorActions>
    </DoorShell>
  );
}
