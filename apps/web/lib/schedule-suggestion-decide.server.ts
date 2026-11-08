import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from './supabase/admin';
import { emitNotification } from './notification-emit';
import { logQueryError } from './supabase/error-detect';
import { isNoteOnlySuggestion } from './schedule-ros';
import { settleSupplierRequest, type SettleOutcome } from './supplier-schedule';
import { directionOf, proposedPatch, sideMayDecide } from './schedule-ask';
import { whereAskRefusalWords } from './supplier-where';
import { changeTheSchedule } from './change-the-schedule.server';

/**
 * ✅ THE ONE ACCEPT PATH for a supplier's schedule request (`event_schedule_suggestions`) — shared by the host's Approve,
 * Approve all (owner 2026-11-01, *"also have an approve all"*) and Auto-agree (3 Oct; ruled 1 Nov to start Off). Moved
 * here from `app/dashboard/[eventId]/schedule/actions.ts` (Step 4b, migration 20271300619930) so the supplier's side
 * can settle a request through the very same code, never a second copy of what "approve" means.
 *
 *   · adjust → the block takes the proposed name · time · place; a proposed crew replaces THEIR crew tasks on it;
 *   · new    → a private moment lands INSIDE the chapter it named (`proposed_parent_block_id`), tagged to their
 *              booking (`responsible_vendor_ids`, so it is theirs to change later), with one task per crew name;
 *   · remove → the block goes (the request outlives it — ON DELETE SET NULL, 20271263061583);
 *   · skip   → a crew Member's ask (owner 2026-11-05, *"yes they can request"*; migration 20271331290778): the part is
 *              skipped EXACTLY as the floor's own Skip skips it — the same `changeTheSchedule` call on the answerer's own
 *              session (RLS, the skip lock's line, ONE notice to the suppliers and the guests).
 * The status flips AFTER the change lands, so a refused write never reads 'accepted' over an unchanged schedule.
 *
 * 🔁 BOTH WAYS (owner 2026-11-02, supplier gate audit D2; migration 20271303655108). The same row also carries a HOST'S
 * ask of a supplier (`direction = 'to_supplier'`). `as` says which side is answering, and a row only the OTHER side may
 * answer is 'gone' — the host never approves their own ask, a supplier never answers its own request. A supplier's Yes
 * applies here, through the very same branches (the service role, after `may_answer_schedule_ask` said yes —
 * `lib/schedule-ask.server.ts`); the asker is told, not the supplier.
 */

type Db = SupabaseClient;
export type SuggestionOutcome = 'done' | 'gone' | 'words';

/** A write that reached no row — refused by RLS, or the moment is gone. */
export const NOTHING_CHANGED = 'Nothing on the schedule changed — the moment is gone, or this account cannot edit it.';

const SUGGESTION_COLUMNS =
  'suggestion_id, block_id, kind, proposed_label, proposed_start_at, proposed_end_at, proposed_location, proposed_parent_block_id, proposed_crew, note, status, vendor_profile_id, direction, suggested_by_user_id, proposed_ingress_minutes, proposed_egress_minutes, proposed_block_ids';

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
  direction?: string | null;
  suggested_by_user_id?: string | null;
  /** 📍 A Where request (kind 'where', migration 20271308641275): the chapters asked for. */
  proposed_block_ids?: string[] | null;
};

/** 📍 The chapters' names, in time order — the words of a Where answer. Admin read, scoped by the ids on the request. */
async function chapterNames(ids: readonly string[] | null | undefined): Promise<string> {
  if (!ids || ids.length === 0) return 'their chapters';
  const { data } = await createAdminClient()
    .from('event_schedule_blocks')
    .select('label')
    .in('block_id', [...ids])
    .order('start_at', { ascending: true });
  const names = ((data ?? []) as { label: string | null }[]).map((b) => b.label?.trim() || 'Untitled chapter');
  return names.length > 0 ? names.join(', ') : 'their chapters';
}

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

/** Is this block a chapter whose hours a venue holds? Read as the caller, who could already read the block. */
async function chapterIsHeld(db: Db, blockId: string): Promise<boolean> {
  const { data, error } = await db.from('event_schedule_blocks').select('hours_vendor_id').eq('block_id', blockId).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean((data as { hours_vendor_id: string | null } | null)?.hours_vendor_id);
}

/** The database's venue-hours refusals, in words (the codes `apply_venue_hours` raises). */
export function venueHoursRefusal(message: string): string {
  if (/schedulehours:gone/.test(message)) return 'That request was already answered.';
  if (/schedulehours:not_the_venue/.test(message)) return 'Only the venue booked to this chapter can set its hours.';
  if (/schedulehours:not_allowed/.test(message)) return 'This account can’t set these hours.';
  if (/schedulehours:not_a_chapter/.test(message)) return 'Hours are set on a chapter, and this chapter is gone.';
  return message;
}

export async function decideSuggestion(
  db: Db,
  userId: string | null,
  eventId: string,
  suggestionId: string,
  decision: 'accept' | 'decline',
  onlyChanges = false,
  opts: {
    auto?: boolean;
    /** Who is answering: the host side (the default — a supplier's request) or the supplier (a host's ask). */
    as?: 'host' | 'supplier';
    /** The supplier's reason on a No to a host's ask. */
    answerNote?: string | null;
    /**
     * 🗓 The client that writes the ANSWER on the request row, when it is not `db`: the booked coordinator answering
     * their own crew's ask on the floor may change the schedule (their session, RLS) but holds no UPDATE on the request
     * row — the floor action checked the ask is their crew's before passing the service role here.
     */
    answerAs?: Db;
  } = {},
): Promise<SuggestionOutcome> {
  const { data } = await db
    .from('event_schedule_suggestions')
    .select(SUGGESTION_COLUMNS)
    .eq('suggestion_id', suggestionId)
    .eq('event_id', eventId)
    .maybeSingle();
  const suggestion = (data ?? null) as SuggestionRow | null;
  if (!suggestion || suggestion.status !== 'open') return 'gone';
  // 🔁 Only the OTHER side answers: a host's ask is the supplier's to answer, a supplier's request the host's.
  if (!sideMayDecide(suggestion, opts.as ?? 'host')) return 'gone';
  const toSupplier = directionOf(suggestion) === 'to_supplier';
  // ✅ APPROVE ALL (and Auto-agree) leave a suggestion in words out: it changes nothing by itself, so it is Noted by hand.
  if (onlyChanges && isNoteOnlySuggestion(suggestion)) return 'words';

  const flip = async () => {
    const { error: resolveError } = await (opts.answerAs ?? db)
      .from('event_schedule_suggestions')
      .update({
        status: decision === 'accept' ? 'accepted' : 'declined',
        resolved_by_user_id: userId,
        resolved_at: new Date().toISOString(),
        ...(opts.auto ? { auto_agreed: true } : {}),
        ...(toSupplier && decision === 'decline' && opts.answerNote ? { answer_note: opts.answerNote } : {}),
      })
      .eq('suggestion_id', suggestionId)
      .eq('event_id', eventId)
      .eq('status', 'open');
    if (resolveError) throw new Error(resolveError.message);
  };

  if (decision === 'accept') {
    const crew = Array.isArray(suggestion.proposed_crew) ? suggestion.proposed_crew : null;
    if (suggestion.kind === 'where') {
      // 📍 WHERE (migration 20271308641275): the one door puts their booking on exactly the chapters asked — through
      // their change lock, for this request only. A supplier's Accept of a host's ask lands here the same way.
      const { error } = await db.rpc('apply_supplier_where', { p_suggestion_id: suggestionId });
      if (error) throw new Error(whereAskRefusalWords(error.message));
      await flip();
    } else if (suggestion.kind === 'hours' && suggestion.block_id) {
      // 🏛 VENUE HOURS (migration 20271307658341): the one door writes the chapter's hours and holds them for the venue.
      const { error } = await db.rpc('apply_venue_hours', { p_suggestion_id: suggestionId });
      if (error) throw new Error(venueHoursRefusal(error.message));
      await flip();
    } else if (suggestion.kind === 'adjust' && suggestion.block_id && toSupplier && (await chapterIsHeld(db, suggestion.block_id))) {
      // 🏛 "Ask <venue> to change", accepted by the venue: its held hours move through the same door.
      const { error } = await db.rpc('apply_venue_hours', { p_suggestion_id: suggestionId });
      if (error) throw new Error(venueHoursRefusal(error.message));
      await flip();
    } else if (suggestion.kind === 'adjust' && suggestion.block_id) {
      const patch = proposedPatch(suggestion);
      if (suggestion.proposed_start_at) {
        // ⏭ A real time ends "Time TBA" / "Right after the one above" (migration 20271302727358) — the row has a clock now.
        patch.time_tba = false;
        patch.follows_block_id = null;
      }
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
    } else if (suggestion.kind === 'skip' && suggestion.block_id) {
      // 🗓 The floor's own Skip, never a second copy of it: same rule, same write, same lock line, same notices.
      const res = await changeTheSchedule(db, userId ?? '', eventId, { op: 'skip', blockId: suggestion.block_id }, 'floor');
      if (!res.ok) throw new Error(res.error);
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

  // 🔁 A host's ask answered → tell the ASKER (best-effort — the ask is already resolved), in the app only.
  if (toSupplier) {
    await tellTheAsker(eventId, suggestion, decision, opts.answerNote ?? null);
    return 'done';
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
      // The coordinator answering their own crew's ask on the floor is not told what they just did.
      if (vendorRes.data?.user_id && vendorRes.data.user_id !== userId) {
        const eventName = eventRes.data?.display_name?.trim() || 'the couple';
        const accepted = decision === 'accept';
        const chaptersAsked = suggestion.kind === 'where' ? await chapterNames(suggestion.proposed_block_ids) : null;
        await emitNotification({
          userId: vendorRes.data.user_id,
          type: 'schedule_suggestion',
          // 📍 A Where pick reads as chapters, never as "a timeline suggestion".
          title:
            chaptersAsked !== null
              ? accepted
                ? `${eventName} OK’d your chapters`
                : `${eventName} kept your chapters as they were`
              : accepted
                ? `${eventName} accepted your timeline suggestion`
                : `${eventName} declined your timeline suggestion`,
          body: accepted
            ? chaptersAsked !== null
              ? `You’re on ${chaptersAsked}.`
              : suggestion.kind === 'remove'
                ? 'That moment is off their schedule.'
                : suggestion.kind === 'skip'
                  ? 'That part is skipped.'
                : isNoteOnlySuggestion(suggestion)
                  ? 'They read your note — nothing on the schedule moved.'
                  : 'Your proposed change is now on their schedule.'
            : chaptersAsked !== null
              ? `You asked for ${chaptersAsked}. Talk it through in your chat if it should change.`
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

/** The host or coordinator who asked hears the supplier's Yes or No — `schedule_ask_answered`, in the app only. */
async function tellTheAsker(eventId: string, s: SuggestionRow, decision: 'accept' | 'decline', reason: string | null): Promise<void> {
  if (!s.suggested_by_user_id) return;
  try {
    const admin = createAdminClient();
    const [shopRes, blockRes] = await Promise.all([
      s.vendor_profile_id
        ? admin.from('vendor_profiles').select('business_name').eq('vendor_profile_id', s.vendor_profile_id).maybeSingle()
        : Promise.resolve({ data: null }),
      s.block_id ? admin.from('event_schedule_blocks').select('label').eq('block_id', s.block_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const shop = (shopRes.data as { business_name: string | null } | null)?.business_name?.trim() || 'The supplier';
    const moment = (blockRes.data as { label: string | null } | null)?.label?.trim() || 'the moment';
    const yes = decision === 'accept';
    if (s.kind === 'where') {
      const names = await chapterNames(s.proposed_block_ids);
      await emitNotification({
        userId: s.suggested_by_user_id,
        type: 'schedule_ask_answered',
        title: yes ? `${shop} agreed to work ${names}` : `${shop} kept their chapters`,
        body: yes ? 'Their chapters on your schedule changed.' : reason ? `Their reason: ${reason}` : 'Their chapters stay as they were.',
        relatedUrl: `/dashboard/${eventId}/schedule`,
      });
      return;
    }
    await emitNotification({
      userId: s.suggested_by_user_id,
      type: 'schedule_ask_answered',
      title: yes ? `${shop} agreed to change “${moment}”` : `${shop} can’t change “${moment}”`,
      body: yes ? 'The new time is on your schedule.' : reason ? `Their reason: ${reason}` : 'Nothing on your schedule moved.',
      relatedUrl: `/dashboard/${eventId}/schedule`,
    });
  } catch (e) {
    console.error('[decideSuggestion] asker notify failed:', e);
  }
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
      if (error) {
        // Unread = Off: the request waits for a person (said in the log, never the look of a choice).
        logQueryError('settleAfterAsking.autoAgree', error, { event_id: eventId }, 'graceful_degrade');
        return null;
      }
      if (!data) return null;
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
