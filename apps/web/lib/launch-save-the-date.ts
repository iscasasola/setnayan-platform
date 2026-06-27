import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Save-the-Date launch helpers — the single source of truth for "what it means
 * for a wedding website to go public", shared by:
 *   • the manual "Launch now" action (launchSaveTheDate, save-the-date/actions.ts)
 *   • the scheduled (cron-free) auto-launch evaluated at read time in
 *     apps/web/app/[slug]/page.tsx
 *   • the scheduling UI (status copy on the launch panel + privacy page)
 *
 * Owner ruling 2026-06-20: a wedding page is PRIVATE until the couple launches
 * their Save-the-Date. Owner ask 2026-06-28: couples can also SCHEDULE that
 * launch for a future date/time (events.scheduled_launch_at). Both paths flip
 * the same columns, so they live here and can never drift.
 */

/** The visibility-bearing event fields these helpers read. */
export type LaunchState = {
  landing_page_visibility?: 'public' | 'unlisted' | 'private' | null;
  scheduled_launch_at?: string | null;
  std_launched_at?: string | null;
};

/**
 * True when a private event's scheduled launch moment has arrived. The ONLY
 * trigger for the cron-free auto-launch — evaluated fresh on every page read.
 * `now` is injectable for testing; defaults to the current instant.
 */
export function isScheduledLaunchDue(
  event: LaunchState,
  now: number = Date.now(),
): boolean {
  const visibility = event.landing_page_visibility ?? 'private';
  if (visibility !== 'private') return false;
  if (!event.scheduled_launch_at) return false;
  const due = new Date(event.scheduled_launch_at).getTime();
  return Number.isFinite(due) && due <= now;
}

/**
 * Effective visibility for a render: the stored visibility, except a private
 * event whose scheduled launch is due reads as 'public'. Pure — no writes. Used
 * by both generateMetadata (robots/index) and the page body so they agree.
 */
export function resolveEffectiveVisibility(
  event: LaunchState,
  now: number = Date.now(),
): 'public' | 'unlisted' | 'private' {
  if (isScheduledLaunchDue(event, now)) return 'public';
  return event.landing_page_visibility ?? 'private';
}

/**
 * Flip an event public: visibility -> 'public', stamp std_launched_at (the
 * go-live moment), and clear any pending schedule. Idempotent — safe to call on
 * an already-public event (re-launch). Returns the event's slug for revalidation
 * (or null on failure). Callers own revalidatePath() + email fan-out so this
 * stays usable from both a server action and a deferred after() task.
 */
export async function publishSaveTheDate(
  client: SupabaseClient,
  eventId: string,
): Promise<{ slug: string | null } | null> {
  const { data, error } = await client
    .from('events')
    .update({
      landing_page_visibility: 'public',
      std_launched_at: new Date().toISOString(),
      scheduled_launch_at: null,
    })
    .eq('event_id', eventId)
    .select('slug')
    .single();
  if (error || !data) return null;
  return { slug: (data.slug as string | null) ?? null };
}
