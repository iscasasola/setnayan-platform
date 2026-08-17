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
      .select('display_name, event_date, venue_name, public_id')
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
      meta={[event.event_date, event.venue_name].filter(Boolean).join(' · ') || undefined}
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

      <p className="text-sm text-ink/70">
        Your personal invitation site is on its way. For now, you&rsquo;ll find this event in
        your dashboard.
      </p>

      <Link className="button-primary w-full sm:w-auto" href="/dashboard">
        Go to your dashboard
      </Link>
    </DoorShell>
  );
}
