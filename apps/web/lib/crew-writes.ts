import type { SupabaseClient } from '@supabase/supabase-js';
import { crewRoleOf, type CrewRole } from '@/lib/crew-pass';

/**
 * 📱 THE CREW QR — the shop's writes (owner 2026-10-29, DECISION_LOG "CREW JOIN THE SUPPLIER'S EVENT HUB BY QR — AND SEE
 * ONLY THE EVENT HUB"): make the event's ONE crew QR, replace it (the printed one stops working; phones already in stay
 * in), turn it off (every pass under it ends), and decide each phone (Allow · Member / Helper · Remove).
 *
 * 🔑 NOT A SERVER ACTION, ON PURPOSE. Every exported server action is a Vercel route and the budget sits at its ceiling
 * (`lint-server-action-budget.mjs`). These are plain table writes on the CALLER'S OWN session, and the database is the
 * whole boundary (migration `…_crew_join_the_suppliers_event_hub_by_qr.sql`, proven as each role in
 * `crew-pass-sees-only-its-event.db.test.ts`): only the shop's admins touch its crew QR and passes, a QR is made only
 * for an event the shop is booked on, its end is derived from the event, and a pass's who / where never moves. The
 * booking fee is enforced where the crew READS (`/join/crew/[token]` asks the shop's fee gate before showing anything).
 */
export type CrewChange =
  | { kind: 'make' }
  | { kind: 'replace' }
  | { kind: 'off' }
  | { kind: 'decide'; passId: string; status?: 'allowed' | 'removed'; role?: CrewRole };

export type CrewWriteResult = { ok: true } | { ok: false; error: string };

/** 32 lowercase hex characters — the crew QR token's shape (the table's CHECK). */
export function newCrewToken(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export async function changeCrew(supabase: SupabaseClient, shopId: string, eventId: string, change: CrewChange): Promise<CrewWriteResult> {
  if (change.kind === 'make') {
    const { error } = await supabase.from('vendor_crew_codes').insert({ vendor_profile_id: shopId, event_id: eventId });
    if (!error || error.code === '23505') return { ok: true }; // already made — the page shows it
    if (/no date yet/i.test(error.message)) return { ok: false, error: 'This event has no date yet — a crew pass needs a day to end on.' };
    return { ok: false, error: 'Only the shop’s owner or an admin can make the crew QR.' };
  }
  if (change.kind === 'replace' || change.kind === 'off') {
    const q = supabase.from('vendor_crew_codes');
    const { data, error } = await (change.kind === 'replace' ? q.update({ token: newCrewToken() }) : q.delete())
      .eq('vendor_profile_id', shopId)
      .eq('event_id', eventId)
      .select('event_id');
    if (error || !data?.length) {
      return { ok: false, error: `Couldn’t ${change.kind === 'replace' ? 'replace' : 'turn off'} the crew QR — only the owner or an admin can.` };
    }
    return { ok: true };
  }
  const patch: { status?: 'allowed' | 'removed'; crew_role?: CrewRole } = {};
  if (change.status === 'allowed' || change.status === 'removed') patch.status = change.status;
  if (change.role) patch.crew_role = crewRoleOf(change.role);
  if (!patch.status && !patch.crew_role) return { ok: false, error: 'Nothing to change.' };
  const { data, error } = await supabase
    .from('vendor_crew_passes')
    .update(patch)
    .eq('pass_id', change.passId)
    .eq('vendor_profile_id', shopId)
    .eq('event_id', eventId)
    .select('pass_id');
  if (error || !data?.length) return { ok: false, error: 'Couldn’t save — only the owner or an admin can decide the crew.' };
  return { ok: true };
}
