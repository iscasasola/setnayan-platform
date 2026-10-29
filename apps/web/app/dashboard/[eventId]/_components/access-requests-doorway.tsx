import { createClient } from '@/lib/supabase/server';
import { routes } from '@/lib/routes';
import { formatCount } from '@/lib/format-number';
import { readClaimAccessAsks } from '@/lib/claim-access-asks.server';
import { claimAsksDoorwayTitle } from '@/lib/claim-access-asks';
import { HomeTodayItem } from './home-parts';

/**
 * The doorway to /dashboard/[eventId]/access-requests — a page ships with its
 * link (the wayfinding rule), and a request nobody can find is a request nobody
 * answers.
 *
 * ☀ A LINE OF HOME'S TODAY LIST, under the cover (owner 2026-10-29: *"The popup for the access and other popups above
 * the header can be presented better"*) — it used to be a tile above the cover; it is the Today line's pill now
 * (`HomeTodayItem`), a door to the requests page.
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
    .eq('kind', 'areas')
    .eq('status', 'pending');
  // 🤝 + the suppliers who joined from the couple's link (owner 2026-10-20) —
  // the same doorway, the shipped pattern for "someone is waiting on you".
  const claims = await readClaimAccessAsks(supabase, eventId);
  if (error) console.error('[supabase-error] app/dashboard/[eventId]/_components/access-requests-doorway.tsx · from:event_access_requests.select', error);

  // 🔑 A REFUSED COUNT IS NOT ZERO. Saying nothing here read exactly like "no
  // request is waiting" — so a coordinator's request could sit unanswered with
  // no door to it. On a failure the doorway still opens, and says why (S41b).
  if (error || !claims.measured) {
    return (
      <HomeTodayItem
        href={routes.dashboard.accessRequests(eventId)}
        tone="warn"
        words="We couldn’t check for access requests"
        tail="Open the list"
        dataAttr={['data-access-requests', 'unread']}
      />
    );
  }
  const claimTitle = claimAsksDoorwayTitle(claims.asks);
  if (!count && !claimTitle) return null;

  return (
    <HomeTodayItem
      href={routes.dashboard.accessRequests(eventId)}
      words={
        claimTitle && !count
          ? claimTitle
          : (count ?? 0) + claims.asks.length === 1
            ? 'Your coordinator is asking for access'
            : `${formatCount((count ?? 0) + claims.asks.length)} access requests are waiting`
      }
      tail={claimTitle && !count ? 'Approve to let them in' : 'You decide what to share'}
      dataAttr={['data-access-requests', 'ask']}
    />
  );
}
