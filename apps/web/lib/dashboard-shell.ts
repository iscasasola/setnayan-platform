import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents } from '@/lib/events';
import { fetchUserRoleSummary } from '@/lib/roles';
import { countUnread } from '@/lib/notifications';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * Per-request cached shell data shared across nested dashboard layouts.
 * React cache() deduplicates within a single server render tree — the outer
 * /dashboard/(account)/layout and inner /dashboard/[eventId]/layout both call
 * this; the second call returns the already-resolved promise at zero DB cost.
 *
 * Cache key is userId only (not the supabase client), so the dedupe fires
 * reliably regardless of which layout obtains the supabase instance first.
 * createClient() is itself cache()-wrapped, so passing it through from here
 * vs. calling it inside the fetchers collapses to the same single client.
 */
export const getDashboardShell = cache(async (userId: string) => {
  const supabase = await createClient();
  const [events, roles, unreadCount] = await Promise.all([
    fetchUserEvents(supabase, userId, 'couple').catch((err: unknown) => {
      logQueryError(
        'getDashboardShell(events)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: userId },
        'graceful_degrade',
      );
      return [] as Awaited<ReturnType<typeof fetchUserEvents>>;
    }),
    fetchUserRoleSummary(supabase, userId).catch((err: unknown) => {
      logQueryError(
        'getDashboardShell(roles)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: userId },
        'graceful_degrade',
      );
      return {
        hasCustomerAccess: true,
        hasVendorAccess: false,
        hasAdminAccess: false,
        vendorProfiles: [],
      } as Awaited<ReturnType<typeof fetchUserRoleSummary>>;
    }),
    countUnread(supabase, userId).catch((err: unknown) => {
      logQueryError(
        'getDashboardShell(unread)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: userId },
        'graceful_degrade',
      );
      return 0;
    }),
  ]);
  return { events, roles, unreadCount };
});
