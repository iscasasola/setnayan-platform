import { createClient } from '@/lib/supabase/server';
import { fetchUpcomingItems } from '@/lib/upcoming-items';
import { logQueryError } from '@/lib/supabase/error-detect';
import { UpcomingSchedules } from './upcoming-schedules';

/**
 * UpcomingSchedulesAsync — streams ONLY the Upcoming-schedules panel on
 * the lean event-home, wrapped in <Suspense> by page.tsx.
 *
 * WHY a dedicated wrapper (not MoneyAndUpcomingAsync): owner directive
 * 2026-06-02 — the lean Home holds exactly THREE blocks: the personalized
 * menu · upcoming schedules · the activity feed. MoneyAndUpcomingAsync
 * renders MoneyInFlight + UpcomingSchedules together; Home doesn't want
 * the money panel (it lives on Budget / Orders), so this wrapper runs the
 * same fetchUpcomingItems call and renders the schedules panel alone.
 *
 * Graceful-degrade contract preserved verbatim from MoneyAndUpcomingAsync
 * (CLAUDE.md 2026-05-28 PR #567 + 2026-05-30 Phase 2): fetchUpcomingItems
 * already internally graceful-degrades each of its sources; the outer
 * try/catch returns the same empty-shape default so UpcomingSchedules's
 * `items` reader keeps working unchanged.
 */

type Props = {
  eventId: string;
  eventDate: string | null;
  ceremonyType: string | null | undefined;
  userId: string;
  now: Date;
};

export async function UpcomingSchedulesAsync({
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
        'UpcomingSchedulesAsync (fetchUpcomingItems threw)',
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

  return <UpcomingSchedules eventId={eventId} items={upcoming.items} now={now} />;
}

/**
 * Suspense fallback — a single panel matching the UpcomingSchedules
 * visual rhythm so the shell-to-data layout shift is minimal.
 */
export function UpcomingSchedulesSkeleton() {
  return (
    <div
      className="h-32 animate-pulse rounded-2xl border border-ink/10 bg-ink/[0.03]"
      aria-busy="true"
    />
  );
}
