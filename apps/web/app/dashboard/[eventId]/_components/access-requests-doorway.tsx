import Link from 'next/link';
import { ArrowRight, ShieldQuestion } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { routes } from '@/lib/routes';

/**
 * The doorway to /dashboard/[eventId]/access-requests — a page ships with its
 * link (the wayfinding rule), and a request nobody can find is a request nobody
 * answers.
 *
 * Renders NOTHING when there is nothing waiting, so the overview stays quiet in
 * the normal case. RLS does the scoping: `event_access_requests_host_read` is
 * host-only, so a delegate loading this event's overview counts zero and the
 * card never appears for them.
 */
export async function AccessRequestsDoorway({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('event_access_requests')
    .select('request_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'pending');

  // Pre-migration or unreadable → say nothing rather than show a broken card.
  if (error || !count) return null;

  return (
    <Link
      href={routes.dashboard.accessRequests(eventId)}
      className="sn-tile flex items-center gap-3 p-4 transition hover:border-terracotta"
    >
      <ShieldQuestion aria-hidden className="h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">
          {count === 1
            ? 'Your coordinator is asking for access'
            : `${count} access requests are waiting`}
        </span>
        <span className="mt-0.5 block text-xs text-ink/60">
          You decide what to share, one thing at a time.
        </span>
      </span>
      <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={1.75} />
    </Link>
  );
}
