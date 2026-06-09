'use server';

/**
 * build-anchors-actions — Pin/Flag the Build tab's three anchors (PR D of the
 * 0016 Plan Builder redesign). "Pin" = the couple fixes a value; "Flag" = they
 * leave it empty so Compute / Setnayan AI suggests it. State lives on the
 * existing `events` columns (no migration): a populated column = Pinned, an
 * empty one = Flagged.
 *   - date     → events.event_date
 *   - budget   → events.estimated_budget_centavos
 *   - location → events.region
 *
 * Couple-owned via RLS (the update is scoped by event_id; a non-owner's update
 * affects zero rows). Mirrors the auth + clear-on-empty pattern of
 * `budget/actions.ts` setEventBudget.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const MAX_BUDGET_PHP = 100_000_000;

export type SetAnchorResult = { ok: true } | { ok: false; error: string };

export async function setAnchor(formData: FormData): Promise<SetAnchorResult> {
  const eventId = formData.get('event_id');
  const anchor = formData.get('anchor');
  const raw = formData.get('value');

  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { ok: false, error: 'Missing event reference. Please refresh and try again.' };
  }
  if (anchor !== 'date' && anchor !== 'budget' && anchor !== 'location') {
    return { ok: false, error: 'Unknown anchor.' };
  }
  const value = typeof raw === 'string' ? raw.trim() : '';

  // Build the single-column patch. Empty value = Flag (clear the column).
  const patch: Record<string, string | number | null> = {};
  if (anchor === 'date') {
    if (value.length === 0) {
      patch.event_date = null;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { ok: false, error: 'Please choose a valid date.' };
    } else {
      patch.event_date = value;
    }
  } else if (anchor === 'budget') {
    const stripped = value.replace(/[₱,\s]/g, '');
    if (stripped.length === 0) {
      patch.estimated_budget_centavos = null;
    } else {
      const php = Number(stripped);
      if (!Number.isFinite(php) || php < 0) {
        return { ok: false, error: 'Please enter a budget — for example, 360,000.' };
      }
      if (php > MAX_BUDGET_PHP) {
        return { ok: false, error: 'Please enter a budget up to ₱100,000,000.' };
      }
      patch.estimated_budget_centavos = Math.round(php * 100);
    }
  } else {
    // location → region (single value; the event carries one region, not two)
    patch.region = value.length === 0 ? null : value.slice(0, 120);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { error } = await supabase.from('events').update(patch).eq('event_id', eventId);
  if (error) {
    return {
      ok: false,
      error: 'Couldn’t save that just now. If it keeps happening, reach out from /help.',
    };
  }

  revalidatePath(`/dashboard/${eventId}/vendors`);
  return { ok: true };
}
