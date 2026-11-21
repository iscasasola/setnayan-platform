import 'server-only';

/**
 * ADJUST · RESET TO FAIR SPLIT — the writes behind "Who gets new inquiries" (supplier roles d–h, the #8013 drawing (e):
 * "A Shop Manager or Branch Manager can change any split; a split you change stays until you reset it").
 *
 * The cuts table is read-only to browsers (migration `supplier_roles_one_client_one_account_manager` §2), so this
 * checks the caller's OWN seat on the card's shop — a Shop Manager, or the Branch Manager of the card's branch
 * (`mayMoveClient`, the same line) — then writes with the service role. Adjust is drawn for a cut between TWO people;
 * the cut is one of `cutChoices`, never a free-typed letter.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { mayMoveClient } from '@/lib/client-handover';
import { callerIn } from '@/lib/client-handover.server';
import { PREFIXES } from '@/lib/inquiry-split';

export type CutResult = { ok: true } | { ok: false; message: string };

async function cardAndPeople(admin: SupabaseClient, serviceId: string) {
  const { data: card } = await admin.from('vendor_services').select('vendor_profile_id, branch_id').eq('vendor_service_id', serviceId).maybeSingle();
  const c = card as { vendor_profile_id: string; branch_id: string | null } | null;
  if (!c) return null;
  const [{ data: cover }, { data: team }] = await Promise.all([
    admin.from('vendor_service_agents').select('vendor_team_member_id').eq('vendor_service_id', serviceId),
    admin
      .from('vendor_team_members')
      .select('vendor_team_member_id, duty, branch_id, created_at, deactivated_at')
      .eq('vendor_profile_id', c.vendor_profile_id)
      .eq('duty', 'account_manager'),
  ]);
  const covering = new Set(((cover ?? []) as { vendor_team_member_id: string }[]).map((r) => r.vendor_team_member_id));
  const people = ((team ?? []) as Array<{ vendor_team_member_id: string; branch_id: string | null; created_at: string; deactivated_at: string | null }>)
    .filter((m) => covering.has(m.vendor_team_member_id) && (m.branch_id ?? null) === (c.branch_id ?? null) && !m.deactivated_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => m.vendor_team_member_id);
  return { shopId: c.vendor_profile_id, branchId: c.branch_id, people };
}

export async function writeSplitCut(
  admin: SupabaseClient,
  userId: string,
  input: { serviceId: string; eventType: string | null; cut: string | null },
): Promise<CutResult> {
  const card = await cardAndPeople(admin, input.serviceId);
  if (!card) return { ok: false, message: 'That card could not be found.' };
  const caller = await callerIn(admin, card.shopId, userId);
  if (!caller || !mayMoveClient(caller, card.branchId)) return { ok: false, message: 'Only a Shop or Branch Manager can change who gets new inquiries.' };

  // Check the cut BEFORE clearing anything, so a refused cut never deletes the manager's current one (ship review 22 Nov).
  if (input.cut !== null) {
    if (card.people.length !== 2) return { ok: false, message: 'A cut is set between two Account Managers on a card.' };
    if (!PREFIXES.includes(input.cut) || input.cut === 'AA') return { ok: false, message: 'Pick one of the cuts shown.' };
  }
  // Keep what is there now, so a failed insert can put it back (the delete and the insert are two statements).
  let read = admin.from('vendor_inquiry_split_cuts').select('*').eq('vendor_service_id', input.serviceId);
  read = card.branchId ? read.eq('branch_id', card.branchId) : read.is('branch_id', null);
  read = input.eventType ? read.eq('event_type', input.eventType) : read.is('event_type', null);
  const { data: before, error: readErr } = await read;
  if (readErr) {
    logQueryError('split-cuts: read before', readErr, { service: input.serviceId }, 'graceful_degrade');
    return { ok: false, message: 'That change didn’t save. Try again.' };
  }
  let del = admin.from('vendor_inquiry_split_cuts').delete().eq('vendor_service_id', input.serviceId);
  del = card.branchId ? del.eq('branch_id', card.branchId) : del.is('branch_id', null);
  del = input.eventType ? del.eq('event_type', input.eventType) : del.is('event_type', null);
  const { error: delErr } = await del;
  if (delErr) {
    logQueryError('split-cuts: clear', delErr, { service: input.serviceId }, 'graceful_degrade');
    return { ok: false, message: 'That change didn’t save. Try again.' };
  }
  if (input.cut === null) return { ok: true }; // Reset to fair split — no rows means the fair split runs.

  const base = { vendor_profile_id: card.shopId, branch_id: card.branchId, vendor_service_id: input.serviceId, event_type: input.eventType, adjusted_by: userId };
  const { error } = await admin.from('vendor_inquiry_split_cuts').insert([
    { ...base, vendor_team_member_id: card.people[0]!, from_prefix: 'AA', to_prefix: input.cut },
    { ...base, vendor_team_member_id: card.people[1]!, from_prefix: input.cut, to_prefix: null },
  ]);
  if (error) {
    logQueryError('split-cuts: write', error, { service: input.serviceId }, 'graceful_degrade');
    if (before && before.length > 0) {
      const { error: backErr } = await admin.from('vendor_inquiry_split_cuts').insert(before);
      if (backErr) logQueryError('split-cuts: restore', backErr, { service: input.serviceId }, 'graceful_degrade');
    }
    return { ok: false, message: 'That change didn’t save. Try again.' };
  }
  return { ok: true };
}
