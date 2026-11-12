/**
 * 🔒 THE SUPPLIER'S THREE LOCKS — one rule, read by every writer that lets someone ask for a change
 * (FINAL RULINGS 2026-11-09, "Money and forms: who writes, who asks, locks").
 *
 *   · Quotation     `vendor_proposals.changes_locked`   (flipped by `vendor_set_proposal_lock(…, 'changes', …)`)
 *   · Payment plan  `vendor_proposals.plan_locked`      (`vendor_set_proposal_lock(…, 'plan', …)`)
 *   · A sent form   `event_form_sends.locked` / `event_question_requests.locked` (`vendor_set_form_lock`)
 *
 * Only the supplier flips them — the database refuses anyone else (`tg_supplier_locks_are_the_suppliers`, migration
 * 20271332497337), and each flip posts its own chat line (a trigger, so no caller can forget it). A lock hides Ask
 * for a change on that item AND the server refuses the ask: Lane C's Ask-for-a-change writer calls `askRefusal()`
 * BEFORE it writes, which is the SQL `supplier_lock_refusal()` — one rule, never a TypeScript copy of it.
 *
 * Browser-callable: every RPC here is SECURITY DEFINER, granted to `authenticated` and keyed on `auth.uid()`, so the
 * supplier's switch calls it straight from the page and spends none of the app's capped server actions.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type LockKind = 'quote' | 'plan' | 'form' | 'questions';

/** What `supplier_lock_refusal` answers: null = the change may be asked for. */
export type LockRefusal = 'quote_locked' | 'plan_locked' | 'form_locked' | 'not_found' | 'unreadable';

/** The words a refused ask shows the asker (the couple) — the reason, never a bare "not allowed". A couple reads "final", never "lock" (owner d19; `the-couple-books-never-locks.test.ts`). */
export const LOCK_REFUSAL_WORDS: Record<LockRefusal, string> = {
  // 🔒 DECISION_LOG 2026-11-12 "A LOCKED QUOTATION STILL FOLLOWS THE GUEST LIST": the Quotation lock stops the couple's
  // asks only — the price still rises with the guest list (`quote_follow_guest_count`, migration 20271339826198), so
  // "the price won't change" would be untrue. Ships WITH the repricer, never before it.
  quote_locked: 'The supplier marked this quotation final — only your guest count can move the price.',
  plan_locked: 'The supplier marked this payment plan final — the dates and amounts won’t change now.',
  form_locked: 'The supplier marked this form final — it can’t be changed now.',
  not_found: 'This is no longer in your chat.',
  unreadable: 'Couldn’t check whether this can still change. Try again in a moment.',
};

/**
 * May a change be asked for on this item? Null = yes. Kinds and ids: quote / plan → the proposal_id; form → the
 * form_id (with the event); questions → the shop's vendor_profile_id (with the event).
 * 🔑 A failed check REFUSES (`unreadable`) — an ask written past a lock is the bug this exists to stop.
 */
export async function askRefusal(
  supabase: SupabaseClient,
  kind: LockKind,
  id: string,
  eventId?: string | null,
): Promise<LockRefusal | null> {
  const { data, error } = await supabase.rpc('supplier_lock_refusal', {
    p_kind: kind,
    p_id: id,
    p_event_id: eventId ?? null,
  });
  if (error) {
    console.warn('[askRefusal] lock check refused', error.code);
    return 'unreadable';
  }
  if (data == null) return null;
  return (Object.keys(LOCK_REFUSAL_WORDS) as LockRefusal[]).includes(data as LockRefusal)
    ? (data as LockRefusal)
    : 'unreadable';
}

/** The answer of a flip: `ok`, or the server's word for why not. */
export type LockFlipResult = 'ok' | 'not_allowed' | 'not_found' | 'unauthenticated' | 'failed';

/** Flip one lock. Quote / plan take the proposal_id; form takes the form_id; questions take the shop's id (ignored). */
export async function flipLock(
  supabase: SupabaseClient,
  kind: LockKind,
  ref: string,
  locked: boolean,
  eventId: string,
): Promise<LockFlipResult> {
  const call =
    kind === 'quote' || kind === 'plan'
      ? supabase.rpc('vendor_set_proposal_lock', { p_proposal_id: ref, p_lock: kind === 'quote' ? 'changes' : 'plan', p_locked: locked })
      : supabase.rpc('vendor_set_form_lock', { p_kind: kind, p_event_id: eventId, p_ref: ref, p_locked: locked });
  const { data, error } = await call;
  if (error) {
    console.warn('[flipLock] refused', error.code);
    return 'failed';
  }
  return data === 'ok' || data === 'not_allowed' || data === 'not_found' || data === 'unauthenticated' ? data : 'failed';
}

/** The switch's words — what it locks, and what the lock means for the other side. */
export const LOCK_WORDS: Record<LockKind, { label: string; on: string; off: string }> = {
  quote: { label: 'Quotation', on: 'Locked · the price is final', off: 'Open · they can ask for a change' },
  plan: { label: 'Payment plan', on: 'Locked · the plan is final', off: 'Open · they can ask for a change' },
  form: { label: 'Form', on: 'Locked · no more changes', off: 'Open · they can ask for a change' },
  questions: { label: 'Questions for the couple', on: 'Locked · no more changes', off: 'Open · they can ask for a change' },
};
