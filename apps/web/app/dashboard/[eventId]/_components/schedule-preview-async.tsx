import { createClient } from '@/lib/supabase/server';
import { fetchScheduleBlocks, type ScheduleBlockRow } from '@/lib/schedule';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SchedulePreview } from './schedule-preview';

/**
 * SchedulePreviewAsync — streams the Overview's Schedule section in its own
 * <Suspense> boundary (owner directive 2026-07-09). Mirrors the graceful-
 * degrade contract of the other async home panels: fetchScheduleBlocks throws
 * on a query error, so the try/catch logs + falls back to an empty list, which
 * SchedulePreview renders as the build-your-timeline empty state rather than
 * crashing the home shell.
 *
 * RLS on event_schedule_blocks already scopes the read to the host's events.
 */
export async function SchedulePreviewAsync({
  eventId,
  now,
}: {
  eventId: string;
  now: Date;
}) {
  const supabase = await createClient();
  let blocks: ScheduleBlockRow[] = [];
  try {
    blocks = await fetchScheduleBlocks(supabase, eventId);
  } catch (err) {
    logQueryError(
      'SchedulePreviewAsync (fetchScheduleBlocks threw)',
      err instanceof Error ? err : new Error(String(err)),
      { event_id: eventId },
      'graceful_degrade',
    );
    blocks = [];
  }
  return <SchedulePreview eventId={eventId} blocks={blocks} now={now} />;
}

export function SchedulePreviewSkeleton() {
  return (
    <div
      className="h-40 animate-pulse rounded-2xl border border-ink/10 bg-ink/[0.03]"
      aria-busy="true"
    />
  );
}
