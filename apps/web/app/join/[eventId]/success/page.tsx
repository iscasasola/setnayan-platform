import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ROLE_LABELS, type GuestRole } from '@/lib/guests';

export const metadata = { title: 'You\'re in' };

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function JoinSuccessPage({ params }: Props) {
  const { eventId } = await params;

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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          You&rsquo;re in
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{event.display_name}</h1>
        <p className="text-sm text-ink/60">
          {[event.event_date, event.venue_name].filter(Boolean).join(' · ')}
        </p>
      </header>

      <section className="rounded-xl border border-ink/10 bg-cream p-5">
        <p className="text-sm text-ink/70">You joined as</p>
        <p className="mt-1 text-lg font-medium text-ink">
          {ROLE_LABELS[(membership.role as GuestRole) ?? 'guest']}
        </p>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/40">
          Event {event.public_id}
        </p>
      </section>

      <section className="space-y-3 text-sm text-ink/70">
        <p>
          Your personal invitation site will be ready when iteration 0002 ships. For now,
          you&rsquo;ll find this event in your dashboard.
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link className="button-primary" href="/dashboard">
          Go to your dashboard
        </Link>
      </div>
    </main>
  );
}
