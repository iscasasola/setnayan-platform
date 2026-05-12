import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatEventDate } from '@/lib/events';
import { BottomNav } from './_components/bottom-nav';

type Props = {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
};

export default async function EventLayout({ children, params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Authorization (per acceptance criterion: 404 for non-couples).
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.member_type !== 'couple') {
    notFound();
  }

  const { data: event } = await supabase
    .from('events')
    .select('event_id, public_id, display_name, event_date, archived, event_type')
    .eq('event_id', eventId)
    .single();

  if (!event) notFound();

  return (
    <div className="flex min-h-dvh flex-col bg-cream pb-16 lg:pb-0">
      <div className="sticky top-0 z-10 border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="group flex min-w-0 items-center gap-2 rounded-full bg-terracotta/10 px-3 py-1.5 text-sm font-medium text-terracotta-700 hover:bg-terracotta/15"
          >
            <span aria-hidden className="text-base">
              ↶
            </span>
            <span className="truncate">{event.display_name}</span>
            {event.event_date ? (
              <span className="hidden text-xs text-terracotta-600 sm:inline">
                · {formatEventDate(event.event_date)}
              </span>
            ) : null}
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/profile"
              aria-label="Profile"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-cream text-sm font-medium text-ink/70 hover:border-terracotta/40 hover:text-terracotta"
            >
              {user.email?.charAt(0).toUpperCase() ?? '?'}
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <BottomNav eventId={eventId} />
    </div>
  );
}
