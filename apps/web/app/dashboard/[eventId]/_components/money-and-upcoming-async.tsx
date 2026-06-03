import { createClient } from '@/lib/supabase/server';
import { fetchUpcomingItems } from '@/lib/upcoming-items';
import { logQueryError } from '@/lib/supabase/error-detect';
import { MoneyInFlight } from './money-in-flight';
import { UpcomingSchedules } from './upcoming-schedules';

/**
 * Streams MoneyInFlight + UpcomingSchedules in parallel with the rest of
 * event-home, wrapped in <Suspense> by the parent page.tsx.
 *
 * Owner directive 2026-05-30 — Phase 2 of the perceived-speed pass
 * documented in CLAUDE.md 2026-05-30 row "loading.tsx skeleton mirrors
 * event-home layout" + the Phase-2 follow-up row. Phase 1 (PR #653)
 * shipped the loading.tsx skeleton so couples see the shell at
 * ~100-200ms; Phase 2 (this component + activity-feed-async) goes
 * further by letting the bottom panels stream in independently as
 * their data resolves, so the shell + welcome + StageStrip + plan
 * grid no longer block on the slowest query.
 *
 * Money + Upcoming share the same fetcher result (MoneyInFlight reads
 * paymentItemsNext30d, UpcomingSchedules reads items) so they live in
 * the same Suspense boundary — splitting them would duplicate the
 * fetchUpcomingItems call without buying any progressive reveal.
 *
 * The graceful-degrade contract from the prior in-page fetch
 * (CLAUDE.md 2026-05-28 12th row PR #567) is preserved verbatim —
 * fetchUpcomingItems already internally graceful-degrades each of its
 * five sources; the outer try/catch returns the same empty-shape
 * default so downstream readers of `.items` + `.paymentItemsNext30d`
 * keep working unchanged.
 */

type Props = {
  eventId: string;
  eventDate: string | null;
  ceremonyType: string | null | undefined;
  userId: string;
  now: Date;
};

export async function MoneyAndUpcomingAsync({
  eventId,
  eventDate,
  ceremonyType,
  userId,
  now,
}: Props) {
  const supabase = await createClient();
  const { data: prefRow } = await supabase
    .from('users')
    .select('reminders_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  const remindersEnabled = prefRow?.reminders_enabled ?? true;
  const upcoming = await (async () => {
    try {
      return await fetchUpcomingItems({
        supabase,
        eventId,
        eventDate,
        ceremonyType,
        now,
        remindersEnabled,
        limit: 10,
      });
    } catch (caught) {
      logQueryError(
        'MoneyAndUpcomingAsync (fetchUpcomingItems threw)',
        caught instanceof Error ? caught : new Error(String(caught)),
        { event_id: eventId, user_id: userId },
        'graceful_degrade',
      );
      return {
        items: [] as Awaited<ReturnType<typeof fetchUpcomingItems>>['items'],
        paymentItemsNext30d: [] as Awaited<
          ReturnType<typeof fetchUpcomingItems>
        >['paymentItemsNext30d'],
        sourceCounts: {
          meeting: 0,
          schedule_block: 0,
          vendor_payment: 0,
          setnayan_sku_expiry: 0,
          document_deadline: 0,
          recommended_deadline: 0,
        },
      } satisfies Awaited<ReturnType<typeof fetchUpcomingItems>>;
    }
  })();

  return (
    <>
      <MoneyInFlight
        eventId={eventId}
        items={upcoming.paymentItemsNext30d}
        now={now}
      />
      <UpcomingSchedules eventId={eventId} items={upcoming.items} now={now} />
    </>
  );
}

/**
 * Suspense fallback shown while MoneyAndUpcomingAsync is resolving.
 * Two stacked panels matching the visual rhythm of the actual children
 * so the shell-to-data layout shift is minimal.
 */
export function MoneyAndUpcomingSkeleton() {
  return (
    <>
      <div
        className="h-32 animate-pulse rounded-2xl border border-ink/10 bg-ink/[0.03]"
        aria-busy="true"
      />
      <div
        className="h-32 animate-pulse rounded-2xl border border-ink/10 bg-ink/[0.03]"
        aria-busy="true"
      />
    </>
  );
}
