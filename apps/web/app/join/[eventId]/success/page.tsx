/**
 * /join/[eventId]/success — "you're in".
 *
 * Ported onto the shared <DoorShell> (2026-08-17). It hand-copied JoinShell's
 * wrapper and wore the gold eyebrow (the `terracotta` slot, 3.37:1 on cream).
 *
 * 🔑 THE EVENT NAME IS THE TITLE, the confirmation is the eyebrow. A guest who
 * has just joined needs to see WHICH event they joined above everything else —
 * they may have been sent three links in one week.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ROLE_LABELS, type GuestRole } from '@/lib/guests';
import { DoorShell, DoorNotice } from '@/app/_components/door/door-shell';
import { joinDoorMeta } from '@/lib/join-door-meta';

export const metadata = { title: 'You\'re in' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ unlisted?: string }>;
};

export default async function JoinSuccessPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const unlisted = (await searchParams).unlisted === '1';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();

  const [{ data: event }, { data: membership }] = await Promise.all([
    admin
      .from('events')
      .select('display_name, event_date, event_date_precision, venue_name, public_id, slug')
      .eq('event_id', eventId)
      .maybeSingle(),
    admin
      .from('event_members')
      .select('member_type, role')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (!event || !membership) {
    redirect(`/join/${eventId}`);
  }

  return (
    <DoorShell
      eyebrow="You're in"
      title={event.display_name}
      // Same one line as every other /join step, from the same helper — a second
      // copy of the precision rule here is exactly how the doors drifted apart
      // in the first place.
      meta={joinDoorMeta(event)}
    >
      <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-5">
        <p className="text-sm text-ink/70">You joined as</p>
        <p className="mt-1 text-lg font-medium text-ink">
          {ROLE_LABELS[(membership.role as GuestRole) ?? 'guest']}
        </p>
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.15em] text-ink/45">
          Event {event.public_id}
        </p>
      </div>

      {unlisted ? (
        <DoorNotice>
          You weren&rsquo;t on the original list, so we&rsquo;ve added you and let the hosts
          know — they&rsquo;ll confirm you shortly. You can fill in your details now and
          they&rsquo;ll carry over.
        </DoorNotice>
      ) : null}

      {/* 🔴 THIS USED TO SAY "Your personal invitation site is on its way. For
          now, you'll find this event in your dashboard." — and then offered one
          button, to the dashboard.
          Both halves were wrong. The invitation was not on its way: it exists,
          and they had just joined it. And the dashboard is an ORGANISER's
          surface — a guest sent there finds no celebration, no seat and no QR,
          while the person who joined WITHOUT an account was redirected onto the
          event page and greeted by name. The one who signed in got the worse
          ending.
          The joining action now mints the same guest session the accountless
          path mints, so this link lands them recognised. */}
      {event.slug ? (
        <>
          <p className="text-sm text-ink/70">
            Your invitation is ready — your seat, your QR and everything shared
            with guests are waiting on it.
          </p>
          <Link className="button-primary w-full sm:w-auto" href={`/${event.slug}`}>
            Open your invitation
          </Link>
        </>
      ) : (
        /* No public address yet — the celebration has nowhere to send them, so
           the dashboard remains the honest destination rather than a link to
           `/undefined`. */
        <>
          <p className="text-sm text-ink/70">
            You&rsquo;ll find this event in your dashboard until its page is
            published.
          </p>
          <Link className="button-primary w-full sm:w-auto" href="/dashboard">
            Go to your dashboard
          </Link>
        </>
      )}
    </DoorShell>
  );
}
