/**
 * 🤝 THE SUPPLIER'S PRIVATE LOWEST PRICE — its read and its one write (owner 19 Nov 2026, DECISION_LOG "THE CLIENT PAGE
 * IS ONE CHAT THAT HOLDS EVERYTHING"; drawing S9ScH2Ps v3, screen 9; migration 20271351728770).
 *
 * CALLED FROM THE BROWSER with the supplier's own session, like `card-calls.ts` / `offer-calls.ts`. The row lives in
 * `vendor_proposal_lowest` (one per shop × event) under a shop-team-only policy: the hosts have no policy on that
 * table, so their session reads nothing and writes nothing — the privacy is the database's, not this file's.
 *
 * One read per chat, shared: every card that needs the number (the counter, Change quote, Make a quote, Every
 * version) reads the same small store, so setting it in one place is seen by the others at once.
 * A refused read is `failed` — a card then says nothing about the lowest (it never treats "unread" as "none set").
 */
import { useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';

export type LowestState = { at: 'idle' } | { at: 'loading' } | { at: 'failed' } | { at: 'ok'; centavos: number | null };

const IDLE: LowestState = { at: 'idle' };
const states = new Map<string, LowestState>();
const listeners = new Map<string, Set<() => void>>();

function set(threadId: string, next: LowestState) {
  states.set(threadId, next);
  listeners.get(threadId)?.forEach((l) => l());
}

type Key = { event_id: string; vendor_profile_id: string };

async function keyOf(threadId: string): Promise<Key | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from('chat_threads').select('event_id, vendor_profile_id').eq('thread_id', threadId).maybeSingle();
  if (error || !data) {
    console.warn('[lowest] thread:', error?.code || error?.message || 'no row');
    return null;
  }
  return data as Key;
}

/** Read this chat's lowest once (again only on `force`, or after a failed read). */
export async function loadLowest(threadId: string, force = false): Promise<void> {
  const now = states.get(threadId) ?? IDLE;
  if (!force && (now.at === 'loading' || now.at === 'ok')) return;
  set(threadId, { at: 'loading' });
  const key = await keyOf(threadId);
  if (!key) return set(threadId, { at: 'failed' });
  const supabase = createClient();
  const { data, error } = await supabase
    .from('vendor_proposal_lowest')
    .select('lowest_centavos')
    .eq('event_id', key.event_id)
    .eq('vendor_profile_id', key.vendor_profile_id)
    .maybeSingle();
  if (error) {
    console.warn('[lowest] read:', error.code || error.message);
    return set(threadId, { at: 'failed' });
  }
  const n = data ? Math.round(Number((data as { lowest_centavos: number | string }).lowest_centavos)) : null;
  set(threadId, { at: 'ok', centavos: n != null && Number.isFinite(n) && n > 0 ? n : null });
}

export type LowestResult = { ok: true } | { ok: false; message: string };

/** Set, change or clear (`null`) the lowest. The number is the supplier's own — nothing here invents one. */
export async function saveLowest(threadId: string, centavos: number | null): Promise<LowestResult> {
  const key = await keyOf(threadId);
  if (!key) return { ok: false, message: 'Couldn’t save that. Try again.' };
  const supabase = createClient();
  if (centavos === null || centavos <= 0) {
    const { error, count } = await supabase
      .from('vendor_proposal_lowest')
      .delete({ count: 'exact' })
      .eq('event_id', key.event_id)
      .eq('vendor_profile_id', key.vendor_profile_id);
    if (error) return { ok: false, message: 'Couldn’t clear that. Try again.' };
    /* 🔒 A ZERO-ROW DELETE IS NOT SUCCESS (house rule, "a zero row update is success shaped"). RLS refuses a delete by
       matching nothing — no error. If this chat held a lowest and nothing was removed, the clear did not happen: say so
       and read the real value back, never show an empty row the database still disagrees with. */
    const had = states.get(threadId);
    if ((count ?? 0) === 0 && had?.at === 'ok' && had.centavos != null) {
      console.warn('[lowest] clear: 0 rows');
      void loadLowest(threadId, true);
      return { ok: false, message: 'Couldn’t clear that — your role may not change it.' };
    }
    set(threadId, { at: 'ok', centavos: null });
    return { ok: true };
  }
  const { data: who } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('vendor_proposal_lowest')
    .upsert(
      { event_id: key.event_id, vendor_profile_id: key.vendor_profile_id, lowest_centavos: Math.round(centavos), updated_by: who.user?.id ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'vendor_profile_id,event_id' },
    )
    .select('lowest_centavos');
  if (error) {
    console.warn('[lowest] save:', error.code || error.message);
    return { ok: false, message: 'Couldn’t save that. Try again.' };
  }
  // 🔒 The write must hand its row back; a write that touched nothing is not a save.
  if (!data || data.length === 0) {
    console.warn('[lowest] save: 0 rows');
    return { ok: false, message: 'Couldn’t save that — your role may not change it.' };
  }
  set(threadId, { at: 'ok', centavos: Math.round(centavos) });
  return { ok: true };
}

function subscribe(threadId: string, fn: () => void): () => void {
  let s = listeners.get(threadId);
  if (!s) listeners.set(threadId, (s = new Set()));
  s.add(fn);
  return () => s!.delete(fn);
}

export function useLowestState(threadId: string): LowestState {
  return useSyncExternalStore(
    (fn) => subscribe(threadId, fn),
    () => states.get(threadId) ?? IDLE,
    () => IDLE,
  );
}

/** Is `totalCentavos` under the supplier's lowest? Pure: no lowest set, an unread one, or no price typed → false. */
export function isUnderLowest(lowestCentavos: number | null, totalCentavos: number): boolean {
  return lowestCentavos != null && lowestCentavos > 0 && totalCentavos > 0 && totalCentavos < lowestCentavos;
}
