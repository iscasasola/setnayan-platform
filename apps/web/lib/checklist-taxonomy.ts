/**
 * Server-side taxonomy helpers for the adaptive checklist.
 *
 * Fetches the couple's `interested_categories` — the plan-group IDs the couple
 * selected during onboarding. These drive the Tier 3 plan-group list at runtime
 * (see checklistTier3PlanGroups() in lib/checklist.ts).
 *
 * ⚠ FIXED 2026-07-26. This file used to select `interested_categories` as if it
 * were a top-level column on public.events. It is NOT and never has been: the
 * picks live INSIDE the `style_preferences` JSONB blob, which is exactly where
 * apps/web/app/onboarding/wedding/actions.ts writes them and where every other
 * reader (lib/checklist-budget.ts, lib/pending-inquiries.ts,
 * app/dashboard/[eventId]/vendors/page.tsx) looks for them. PostgREST fails the
 * WHOLE query on an unknown column (42703), so this helper returned `[]` for
 * every event and the adaptive checklist's Tier-3 plan groups were permanently
 * empty — the couple's onboarding picks drove nothing.
 *
 * Do NOT "fix" this by pointing at events.tracked_categories: that is a real
 * column but a DIFFERENT concept (the wedding-essentials tracking set, migration
 * 20260706000000).
 */

import { createClient } from '@/lib/supabase/server'
import { logQueryError } from '@/lib/supabase/error-detect'

/**
 * Returns the plan-group IDs the couple selected during onboarding for
 * the given event. Returns an empty array when no picks exist (pre-onboarding
 * events or events where interested_categories was never set).
 */
export async function getEventInterestedPlanGroups(eventId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('style_preferences')
    .eq('event_id', eventId)
    .single()
  if (error) {
    logQueryError('checklist-taxonomy:interestedPlanGroups', error, { eventId })
    return []
  }
  const prefs = (data?.style_preferences ?? {}) as Record<string, unknown>
  const picks = prefs.interested_categories
  return Array.isArray(picks) ? picks.filter((p): p is string => typeof p === 'string') : []
}
