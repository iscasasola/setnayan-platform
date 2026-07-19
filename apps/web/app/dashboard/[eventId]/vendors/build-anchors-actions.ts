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
import {
  resolveRegion,
  regionSlugForCity,
  regionByPsgc,
} from '@/lib/region-source';
import { regionForCity } from '@/lib/regions';

const MAX_BUDGET_PHP = 100_000_000;

/**
 * Normalize the Build-tab Location anchor to the CANONICAL region slug that the
 * burn RPC (`unlock_vendor_event`) alias-resolves on — slug / psgc_code /
 * aliases[]. A raw city string (e.g. "Tagaytay") matches NONE of those, so the
 * RPC falls to the band-1 floor and silently UNDER-CHARGES the inquiry burn
 * (CALABARZON is band 3 ₱300 → charged ₱100). Resolve at write time so
 * `events.region` always carries a band-resolvable value:
 *   1. exact region spelling (slug · underscore · PSGC · alias) → its slug
 *   2. city → canonical slug via the DB city-alias cache (regionSlugForCity)
 *   3. city → PSGC via regionForCity → that region's canonical slug
 *   4. unrecognized free text → kept verbatim (capped) so the couple's typed
 *      value isn't lost; this is the only path that can still floor to band-1,
 *      and it's an explicit, narrow fallback rather than the default.
 * `events.region` is a single column with no separate display field, so the
 * resolved slug IS what we persist.
 */
function normalizeRegionAnchor(value: string): string {
  // 1. Exact region spelling in any of the four vocabularies.
  const direct = resolveRegion(value);
  if (direct) return direct.slug;

  // 2. City → canonical slug via the wedding_destinations city-alias cache.
  const citySlug = regionSlugForCity(value);
  if (citySlug) return citySlug;

  // 3. City → PSGC (regionForCity returns a PSGC code) → canonical slug.
  const psgc = regionForCity(value);
  if (psgc) {
    const row = regionByPsgc(psgc);
    if (row) return row.slug;
  }

  // 4. Unrecognized — keep the typed text (capped) rather than dropping it.
  return value.slice(0, 120);
}

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
    // location → region (single value; the event carries one region, not two).
    // Normalize to the canonical slug the burn RPC resolves on, so a typed city
    // doesn't silently floor the inquiry burn to band-1 (under-charge leak).
    patch.region = value.length === 0 ? null : normalizeRegionAnchor(value);
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
