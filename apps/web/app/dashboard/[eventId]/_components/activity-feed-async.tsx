import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEventActivity } from '@/lib/activity';
import { fetchAttributedActivity } from '@/lib/activity-attribution';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ActivityFeed } from './activity-feed';

/**
 * Streams the ActivityFeed in parallel with the rest of event-home,
 * wrapped in <Suspense> by the parent page.tsx.
 *
 * Owner directive 2026-05-30 — Phase 2 of the perceived-speed pass
 * documented in CLAUDE.md 2026-05-30 row "loading.tsx skeleton mirrors
 * event-home layout" + the Phase-2 follow-up row. Phase 1 (PR #653)
 * shipped the loading.tsx skeleton so couples see the shell at
 * ~100-200ms; Phase 2 (this component + money-and-upcoming-async)
 * goes further by letting the bottom panels stream in independently
 * as their data resolves, so the shell + welcome + StageStrip + plan
 * grid no longer block on the slowest query.
 *
 * Activity feed pulls two parallel lanes:
 * 1. Source activity — event_action_log via the RLS-scoped supabase
 *    client (host's own events).
 * 2. Attributed activity — event_action_log via adminClient with a
 *    user.id filter, so credit attribution renders even when the
 *    underlying row sat in a different host's RLS scope.
 *
 * Both lanes degrade silently to [] on query failure — the merged
 * feed always renders, just with whichever lane(s) succeeded.
 *
 * Lifted out of page.tsx round-1 Promise.all (CLAUDE.md 2026-05-28
 * 12th row PR #567) — moving these into a Suspense child trades a
 * tiny per-render client-creation cost for shell-streaming UX.
 */

type Props = {
  eventId: string;
  userId: string;
  /** Localized "Recent activity" heading + "See all" copy, evaluated
   *  at page level so the translation function doesn't cross the
   *  Suspense boundary. */
  headingLabel: string;
  seeAllLabel: string;
};

export async function ActivityFeedAsync({
  eventId,
  userId,
  headingLabel,
  seeAllLabel,
}: Props) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const [activity, attributedActivity] = await Promise.all([
    fetchEventActivity(supabase, eventId, 20).catch((err: unknown) => {
      logQueryError(
        'ActivityFeedAsync (fetchEventActivity threw)',
        err instanceof Error ? err : new Error(String(err)),
        { event_id: eventId, user_id: userId },
        'graceful_degrade',
      );
      return [] as Awaited<ReturnType<typeof fetchEventActivity>>;
    }),
    fetchAttributedActivity(adminClient, eventId, userId, 20).catch(
      (err: unknown) => {
        logQueryError(
          'ActivityFeedAsync (fetchAttributedActivity threw)',
          err instanceof Error ? err : new Error(String(err)),
          { event_id: eventId, user_id: userId },
          'graceful_degrade',
        );
        return [] as Awaited<ReturnType<typeof fetchAttributedActivity>>;
      },
    ),
  ]);

  return (
    <ActivityFeed
      eventId={eventId}
      sourceActivity={activity}
      attributedActivity={attributedActivity}
      headingLabel={headingLabel}
      seeAllLabel={seeAllLabel}
    />
  );
}

/**
 * Suspense fallback shown while ActivityFeedAsync is resolving.
 * Single panel matching the visual rhythm of the rendered feed
 * so the shell-to-data layout shift is minimal.
 */
export function ActivityFeedSkeleton() {
  return (
    <div
      className="h-32 animate-pulse rounded-2xl border border-ink/10 bg-ink/[0.03]"
      aria-busy="true"
    />
  );
}
