/**
 * Server-side taxonomy helpers for the adaptive checklist.
 *
 * Fetches the couple's `interested_categories` from the events row —
 * the plan-group IDs the couple selected during onboarding. These drive
 * the Tier 3 plan-group list at runtime (see checklistTier3PlanGroups()
 * in lib/checklist.ts).
 *
 * Column: events.interested_categories (text[]) — populated by
 * apps/web/app/onboarding/wedding/actions.ts at onboarding completion.
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Returns the plan-group IDs the couple selected during onboarding for
 * the given event. Returns an empty array when no picks exist (pre-onboarding
 * events or events where interested_categories was never set).
 */
export async function getEventInterestedPlanGroups(eventId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('interested_categories')
    .eq('event_id', eventId)
    .single()
  return (data?.interested_categories as string[] | null) ?? []
}
