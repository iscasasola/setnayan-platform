import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ROLE_LABELS, type GuestRole } from '@/lib/guests';

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
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.15em] text-ink/40">
          Event {event.public_id}
        </p>
      </section>

      {unlisted ? (
        <section className="rounded-xl border border-warn-900/15 bg-warn-100 p-4 text-sm text-warn-900">
          You weren&rsquo;t on the couple&rsquo;s original list, so we&rsquo;ve added you and let
          them know — they&rsquo;ll confirm you shortly. You can fill in your details now and
          they&rsquo;ll carry over.
        </section>
      ) : null}

      <section className="space-y-3 text-sm text-ink/70">
        <p>
          Your personal invitation site is on its way. For now, you&rsquo;ll find this
          event in your dashboard.
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
