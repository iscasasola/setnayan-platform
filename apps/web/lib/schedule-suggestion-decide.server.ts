import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from './supabase/admin';
import { emitNotification } from './notification-emit';
import { isNoteOnlySuggestion } from './schedule-ros';
import { settleSupplierRequest, type SettleOutcome } from './supplier-schedule';

/**
 * ✅ THE ONE ACCEPT PATH for a supplier's schedule request (`event_schedule_suggestions`) — shared by the host's Approve,
 * Approve all (owner 2026-11-01, *"also have an approve all"*) and Auto-agree (3 Oct; ruled 1 Nov to start Off). Moved
 * here from `app/dashboard/[eventId]/schedule/actions.ts` (Step 4b, migration 20271300619930) so the supplier's side
 * can settle a request through the very same code, never a second copy of what "approve" means.
 *
 *   · adjust → the block takes the proposed name · time · place; a proposed crew replaces THEIR crew tasks on it;
 *   · new    → a private moment lands INSIDE the chapter it named (`proposed_parent_block_id`), tagged to their
 *              booking (`responsible_vendor_ids`, so it is theirs to change later), with one task per crew name;
 *   · remove → the block goes (the request outlives it — ON DELETE SET NULL, 20271263061583).
 * The status flips AFTER the change lands, so a refused write never reads 'accepted' over an unchanged schedule.
 */

type Db = SupabaseClient;
export type SuggestionOutcome = 'done' | 'gone' | 'words';

/** A write that reached no row — refused by RLS, or the moment is gone. */
export const NOTHING_CHANGED = 'Nothing on the schedule changed — the moment is gone, or this account cannot edit it.';

const SUGGESTION_COLUMNS =
  'suggestion_id, block_id, kind, proposed_label, proposed_start_at, proposed_end_at, proposed_location, proposed_parent_block_id, proposed_crew, note, status, vendor_profile_id';

type SuggestionRow = {
  suggestion_id: string;
  block_id: string | null;
  kind: string;
  proposed_label: string | null;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  proposed_location: string | null;
  proposed_parent_block_id: string | null;
  proposed_crew: string[] | null;
  note: string;
  status: string;
  vendor_profile_id: string | null;
};

/** This supplier's booking rows on the event — admin read, scoped by the event and the supplier on the request. */
async function bookingsOf(eventId: string, vendorProfileId: string | null): Promise<string[]> {
  if (!vendorProfileId) return [];
  const { data } = await createAdminClient()
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', vendorProfileId)
    .is('archived_at', null);
  return ((data ?? []) as { vendor_id: string }[]).map((b) => b.vendor_id);
}

/** Their crew on a moment becomes exactly `crew`: one task per name, `what` = the moment's name. */
async function setCrewTasks(db: Db, blockId: string, booking: string, crew: string[], what: string, bookings: string[]): Promise<void> {
  if (bookings.length > 0) {
    const { error: delError } = await db
      .from('event_schedule_tasks')
      .delete()
      .eq('block_id', blockId)
      .in('vendor_id', bookings)
      .not('crew', 'is', null);
    if (delError) throw new Error(delError.message);
  }
  if (crew.length === 0) return;
  const { error } = await db.from('event_schedule_tasks').insert(
    crew.map((name, i) => ({ block_id: blockId, vendor_id: booking, crew: name, what: what.slice(0, 500) || 'Their part', sort_order: i })),
  );
  if (error) throw new Error(error.message);
}

export async function decideSuggestion(
  db: Db,
  userId: string | null,
  eventId: string,
  suggestionId: string,
  decision: 'accept' | 'decline',
  onlyChanges = false,
  opts: { auto?: boolean } = {},
): Promise<SuggestionOutcome> {
  const { data } = await db
    .from('event_schedule_suggestions')
    .select(SUGGESTION_COLUMNS)
    .eq('suggestion_id', suggestionId)
    .eq('event_id', eventId)
    .maybeSingle();
  const suggestion = (data ?? null) as SuggestionRow | null;
  if (!suggestion || suggestion.status !== 'open') return 'gone';
  // ✅ APPROVE ALL (and Auto-agree) leave a suggestion in words out: it changes nothing by itself, so it is Noted by hand.
  if (onlyChanges && isNoteOnlySuggestion(suggestion)) return 'words';

  const flip = async () => {
    const { error: resolveError } = await db
      .from('event_schedule_suggestions')
      .update({
        status: decision === 'accept' ? 'accepted' : 'declined',
        resolved_by_user_id: userId,
        resolved_at: new Date().toISOString(),
        ...(opts.auto ? { auto_agreed: true } : {}),
      })
      .eq('suggestion_id', suggestionId)
      .eq('event_id', eventId)
      .eq('status', 'open');
    if (resolveError) throw new Error(resolveError.message);
  };

  if (decision === 'accept') {
    const crew = Array.isArray(suggestion.proposed_crew) ? suggestion.proposed_crew : null;
    if (suggestion.kind === 'adjust' && suggestion.block_id) {
      const patch: Record<string, string> = {};
      if (suggestion.proposed_start_at) patch.start_at = suggestion.proposed_start_at;
      if (suggestion.proposed_end_at) patch.end_at = suggestion.proposed_end_at;
      if (suggestion.proposed_location) patch.location = suggestion.proposed_location;
      if (suggestion.proposed_label) patch.label = suggestion.proposed_label;
      let label = suggestion.proposed_label;
      if (Object.keys(patch).length > 0) {
        const { data: changed, error } = await db
          .from('event_schedule_blocks')
          .update(patch)
          .eq('block_id', suggestion.block_id)
          .eq('event_id', eventId)
          .select('block_id, label');
        if (error) throw new Error(error.message);
        if (!changed?.length) throw new Error(NOTHING_CHANGED);
        label = (changed[0] as { label: string }).label;
      }
      if (crew) {
        const bookings = await bookingsOf(eventId, suggestion.vendor_profile_id);
        if (bookings[0]) await setCrewTasks(db, suggestion.block_id, bookings[0], crew, label ?? 'Their part', bookings);
      }
      await flip();
    } else if (suggestion.kind === 'new') {
      /*
        THE ITEM A SUPPLIER ADDS IS THAT SUPPLIER'S (owner 2026-10-03). It lands tagged to their booking — the column
        the lens and the own-items rule read — and, since Step 4b, inside the chapter they named. Admin read of the
        bookings: a coordinator holding The Day = Edit may have Suppliers set Off, and must still be able to approve.
      */
      const tags = await bookingsOf(eventId, suggestion.vendor_profile_id);
      const { data: made, error } = await db
        .from('event_schedule_blocks')
        .insert({
          event_id: eventId,
          parent_block_id: suggestion.proposed_parent_block_id,
          label: (suggestion.proposed_label ?? 'Supplier-requested moment').slice(0, 120),
          block_type: 'custom',
          start_at: suggestion.proposed_start_at,
          end_at: suggestion.proposed_end_at,
          location: suggestion.proposed_location,
          notes: suggestion.note,
          // Lands as a PRIVATE draft — the couple decides when guests see it.
          is_public: false,
          responsible_vendor_ids: tags,
        })
        .select('block_id')
        .maybeSingle();
      if (error) throw new Error(error.message);
      const blockId = (made as { block_id: string } | null)?.block_id;
      if (blockId && crew && crew.length > 0 && tags[0]) {
        await setCrewTasks(db, blockId, tags[0], crew, suggestion.proposed_label ?? 'Their part', []);
      }
      await flip();
    } else if (suggestion.kind === 'remove') {
      if (suggestion.block_id) {
        const { error } = await db
          .from('event_schedule_blocks')
          .delete()
          .eq('block_id', suggestion.block_id)
          .eq('event_id', eventId);
        if (error) throw new Error(error.message);
      }
      await flip();
    } else {
      await flip();
    }
  } else {
    await flip();
  }

  // Tell the supplier what the host decided (best-effort — the request is already resolved). Auto-agree needs no
  // notice: the supplier's own sheet said "Saved" the moment it went in.
  if (suggestion.vendor_profile_id && !opts.auto) {
    try {
      const admin = createAdminClient();
      const [vendorRes, eventRes] = await Promise.all([
        admin.from('vendor_profiles').select('user_id').eq('vendor_profile_id', suggestion.vendor_profile_id).maybeSingle(),
        admin.from('events').select('display_name').eq('event_id', eventId).maybeSingle(),
      ]);
      if (vendorRes.data?.user_id) {
        const eventName = eventRes.data?.display_name?.trim() || 'the couple';
        const accepted = decision === 'accept';
        await emitNotification({
          userId: vendorRes.data.user_id,
          type: 'schedule_suggestion',
          title: accepted
            ? `${eventName} accepted your timeline suggestion`
            : `${eventName} declined your timeline suggestion`,
          body: accepted
            ? suggestion.kind === 'remove'
              ? 'That moment is off their schedule.'
              : isNoteOnlySuggestion(suggestion)
                ? 'They read your note — nothing on the schedule moved.'
                : 'Your proposed change is now on their schedule.'
            : 'Your proposed change was not applied.',
          relatedUrl: `/vendor-dashboard/clients/${eventId}?tab=schedule`,
        });
      }
    } catch (e) {
      console.error('[decideSuggestion] vendor notify failed:', e);
    }
  }

  return 'done';
}

/**
 * 🤝 A SUPPLIER'S REQUEST, SETTLED — right after it is written. Auto-agree ON: the one accept path above applies it at
 * once (admin client: the supplier may not write the schedule, the host's standing choice does). OFF (the default) or
 * unreadable: it WAITS for the host or coordinator. The decision itself is `settleSupplierRequest` (pure, guarded).
 */
export async function settleAfterAsking(eventId: string, suggestionId: string): Promise<SettleOutcome> {
  const admin = createAdminClient();
  return settleSupplierRequest(
    async () => {
      const { data, error } = await admin
        .from('events')
        .select('supplier_requests_auto_agree')
        .eq('event_id', eventId)
        .maybeSingle();
      if (error || !data) return null;
      return (data as { supplier_requests_auto_agree: boolean | null }).supplier_requests_auto_agree === true;
    },
    async () => {
      try {
        const r = await decideSuggestion(admin, null, eventId, suggestionId, 'accept', true, { auto: true });
        return r === 'words' ? 'words' : r === 'done' ? 'applied' : 'waits';
      } catch (e) {
        // The change could not land (the moment is gone, a clash in the data): it stays open for a person to decide.
        console.error('[settleAfterAsking] auto-agree could not apply — it waits for the host', e instanceof Error ? e.message : e);
        return 'waits';
      }
    },
  );
}
