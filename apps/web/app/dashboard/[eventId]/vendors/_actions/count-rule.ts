'use server';

/**
 * 🧮 "WHO THEY COUNT" — the one write (owner 2026-11-04, DECISION_LOG "2026-11-04 WHO A SUPPLIER COUNTS…"; the approved
 * prototype's "Couple · who a supplier counts" sheet). The couple sets, on a per-head service, who its supplier counts:
 * Everyone attending · Only… · Everyone except… over roles and groups (`lib/supplier-count.ts`).
 *
 * Saved IN PLACE (house rule: a save never resets the screen) — no redirect; the sheet keeps its own state and the count
 * it already shows. On the user's own session: RLS (`event_vendor_count_rules_couple_all`) decides, and the table's
 * trigger refuses a flat-priced service and keeps only this event's own groups. A zero-row write is NOT a success —
 * the row is read back.
 */
import { createClient } from '@/lib/supabase/server';
import { limitedHelperRefusal } from '@/lib/host-gate';
import { logQueryError } from '@/lib/supabase/error-detect';
import { COUNT_MODES, ruleOfKeys, type CountMode } from '@/lib/supplier-count';

export type SaveCountRuleResult = { ok: true } | { ok: false; error: string };

export async function saveCountRule(input: {
  eventId: string;
  /** `event_vendors.vendor_id` — the booking. */
  serviceId: string;
  mode: CountMode;
  /** "r:principal_sponsors" · "g:<group id>". */
  keys: string[];
}): Promise<SaveCountRuleResult> {
  const eventId = String(input.eventId ?? '').trim();
  const serviceId = String(input.serviceId ?? '').trim();
  if (!eventId || !serviceId || !COUNT_MODES.includes(input.mode)) return { ok: false, error: 'That did not save. Nothing changed.' };
  const refused = await limitedHelperRefusal(eventId, 'vendors');
  if (refused) return { ok: false, error: refused };

  const rule = ruleOfKeys(input.mode, Array.isArray(input.keys) ? input.keys.map(String).slice(0, 200) : []);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_vendor_count_rules')
    .upsert(
      { event_vendor_id: serviceId, event_id: eventId, mode: rule.mode, roles: rule.roles, group_ids: rule.groupIds },
      { onConflict: 'event_vendor_id' },
    )
    .select('event_vendor_id')
    .maybeSingle();
  if (error || !data) {
    if (error) logQueryError('saveCountRule', error, { eventId, serviceId });
    return {
      ok: false,
      error: /per head/.test(error?.message ?? '')
        ? 'This service is not priced per head, so it counts nobody.'
        : 'That did not save. Nothing changed.',
    };
  }
  return { ok: true };
}
