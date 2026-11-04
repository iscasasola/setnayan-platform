import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import {
  INVITATION_CHAPTER_FIELDS,
  invitationChapters,
  type ChapterCount,
  type ChapterReply,
  type InvitationChapter,
  type StoredChapterReply,
} from './invitation-chapters';

/**
 * ✉ GUESTS AND RSVP BY CHAPTER — the server half (migration 20271301452824; the pure half is lib/invitation-chapters.ts).
 *
 * The guest pages run on the SERVICE-ROLE client, which passes straight through RLS, so the filters here ARE the fence:
 *   · `onlyInvitationChapters` — a top-level block with "On the invitation" on, never a coordinator's staged one, and
 *     only the columns a guest may see (`INVITATION_CHAPTER_FIELDS`: name, time, venue, spot). It does NOT ask
 *     `is_public` — a Time-TBA chapter can never be public (20271300482585) and is still replied to — and it never
 *     asks for a venue: a blank one still sends (plan §3 TBA).
 *   · a guest's own replies are read by THEIR guest id only, after the page proved who they are.
 *
 * 🛑 Honest: a failed read is `null`, never `[]` — an empty list would read as "no chapter on the invitation" or "you
 * answered nothing", and either would change what the page draws.
 * 🚦 Capacity: one indexed read per page per guest; no live connection (plan §6, "no Event Hub live connections").
 */

type Client = SupabaseClient;

/** 🔒 THE GUESTS' CHAPTER FENCE — handed the query, returns it filtered. */
export function onlyInvitationChapters<Q extends { eq: unknown; is: unknown; neq: unknown }>(query: Q): Q {
  type F = { eq(c: string, v: unknown): F; is(c: string, v: null): F; neq(c: string, v: unknown): F };
  return (query as unknown as F)
    .eq('on_invitation', true)
    .is('parent_block_id', null)
    .neq('visibility', 'coordinator_only') as unknown as Q;
}

/**
 * The invitation's chapters for one event, in the day's order. `null` = the read failed (said, never drawn as none).
 * Given a `guestId`, it is THAT guest's invitation (owner 2026-11-02, "Invited to"): the chapters the hosts took them off
 * are left out — and if that read fails the whole answer is `null`, never the full list (a guest is never asked about,
 * nor shown, a part of the day they were taken off because a read did not happen).
 */
export async function readInvitationChapters(admin: Client, eventId: string, guestId?: string): Promise<InvitationChapter[] | null> {
  const [{ data, error }, notInvited] = await Promise.all([
    onlyInvitationChapters(admin.from('event_schedule_blocks').select(INVITATION_CHAPTER_FIELDS).eq('event_id', eventId)).order('start_at', {
      ascending: true,
    }),
    guestId ? readGuestNotInvited(admin, guestId) : Promise.resolve(new Set<string>()),
  ]);
  if (error || !data || notInvited === null) {
    if (error) logQueryError('readInvitationChapters', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  return invitationChapters(data as unknown as Parameters<typeof invitationChapters>[0], notInvited);
}

/**
 * ✉ The chapters ONE guest was taken off (`guest_chapter_not_invited`, 20271302948959) — the exception; none = invited to
 * every chapter on the invitation. `null` = the read failed (the caller never treats that as "invited to all").
 */
export async function readGuestNotInvited(admin: Client, guestId: string): Promise<Set<string> | null> {
  const { data, error } = await admin.from('guest_chapter_not_invited').select('block_id').eq('guest_id', guestId);
  if (error || !data) {
    if (error) logQueryError('readGuestNotInvited', error, { guest_id: guestId }, 'graceful_degrade');
    return null;
  }
  return new Set((data as { block_id: string }[]).map((r) => r.block_id));
}


/** One guest's own answers, chapter by chapter. `null` = the read failed. */
export async function readGuestChapterReplies(admin: Client, guestId: string): Promise<StoredChapterReply[] | null> {
  const { data, error } = await admin
    .from('guest_chapter_replies')
    .select('block_id, attending, removal_seen_at')
    .eq('guest_id', guestId);
  if (error || !data) {
    if (error) logQueryError('readGuestChapterReplies', error, { guest_id: guestId }, 'graceful_degrade');
    return null;
  }
  return (data as StoredChapterReply[]).map((r) => ({
    block_id: r.block_id,
    attending: r.attending === true,
    removal_seen_at: r.removal_seen_at ?? null,
  }));
}

/**
 * The names of chapters this guest said yes to that are NO LONGER on the invitation — only those, only by their ids
 * (they were on this guest's invitation when they answered). Feeds "X is no longer on your invitation".
 */
export async function readRemovedChapterLabels(
  admin: Client,
  eventId: string,
  replies: readonly StoredChapterReply[] | null,
  onInvitation: readonly InvitationChapter[] | null,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!replies || !onInvitation) return out;
  const on = new Set(onInvitation.map((c) => c.block_id));
  const ids = replies.filter((r) => r.attending && !r.removal_seen_at && !on.has(r.block_id)).map((r) => r.block_id);
  if (ids.length === 0) return out;
  const { data, error } = await admin
    .from('event_schedule_blocks')
    .select('block_id, label')
    .eq('event_id', eventId)
    .is('parent_block_id', null)
    .in('block_id', ids);
  if (error || !data) {
    if (error) logQueryError('readRemovedChapterLabels', error, { event_id: eventId }, 'graceful_degrade');
    return out;
  }
  for (const r of data as { block_id: string; label: string }[]) out.set(r.block_id, r.label);
  return out;
}

/** Writes a guest's answers. Returns false when the write did not land (the caller says so). */
export async function writeChapterReplies(admin: Client, guestId: string, replies: readonly ChapterReply[]): Promise<boolean> {
  if (replies.length === 0) return true;
  const now = new Date().toISOString();
  const { error } = await admin.from('guest_chapter_replies').upsert(
    replies.map((r) => ({
      guest_id: guestId,
      block_id: r.block_id,
      // Replaced by the database's trigger from the chapter; sent only because the column is NOT NULL.
      event_id: '00000000-0000-0000-0000-000000000000',
      attending: r.attending,
      replied_at: now,
      removal_seen_at: null,
    })),
    { onConflict: 'guest_id,block_id' },
  );
  if (error) logQueryError('writeChapterReplies', error, { guest_id: guestId }, 'will_throw');
  return !error;
}

/** "Seen": the guest pressed OK on a removed chapter's notice. */
export async function markRemovalSeen(admin: Client, guestId: string, blockId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('guest_chapter_replies')
    .update({ removal_seen_at: new Date().toISOString() })
    .eq('guest_id', guestId)
    .eq('block_id', blockId)
    .select('block_id');
  if (error) logQueryError('markRemovalSeen', error, { guest_id: guestId }, 'will_throw');
  return !error && (data ?? []).length > 0;
}

/** How many names the "who said yes" list shows before "and N more". */
export const YES_NAMES_SHOWN = 20;

/**
 * Per chapter: two exact counts (never a row list, which PostgREST caps at 1,000 — unlimited guests) and the first
 * names who said yes. `null` for a chapter whose read failed — said, never drawn as 0.
 */
export async function readChapterCounts(
  supabase: Client,
  eventId: string,
  chapterIds: readonly string[],
): Promise<Map<string, ChapterCount | null>> {
  const out = new Map<string, ChapterCount | null>();
  await Promise.all(
    chapterIds.map(async (blockId) => {
      const base = () =>
        supabase
          .from('guest_chapter_replies')
          .select('guest_id, guests!inner(deleted_at)', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('block_id', blockId)
          .is('guests.deleted_at', null);
      const [yes, no, names, off] = await Promise.all([
        base().eq('attending', true),
        base().eq('attending', false),
        supabase
          .from('guest_chapter_replies')
          .select('guests!inner(first_name, last_name, display_name, deleted_at)')
          .eq('event_id', eventId)
          .eq('block_id', blockId)
          .eq('attending', true)
          .is('guests.deleted_at', null)
          .order('replied_at', { ascending: true })
          .limit(YES_NAMES_SHOWN),
        /* ✉ Who the hosts took off it (owner 2026-11-02). Their answers to it are already gone (20271302948959), so the
           two counts above never count them; this only says how many. A refused read leaves it unsaid, never 0. */
        supabase
          .from('guest_chapter_not_invited')
          .select('guest_id, guests!inner(deleted_at)', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('block_id', blockId)
          .is('guests.deleted_at', null),
      ]);
      if (yes.error || no.error || names.error || yes.count === null || no.count === null) {
        logQueryError('readChapterCounts', (yes.error ?? no.error ?? names.error)!, { event_id: eventId }, 'graceful_degrade');
        out.set(blockId, null);
        return;
      }
      const yesNames = ((names.data ?? []) as unknown as {
        guests: { first_name: string | null; last_name: string | null; display_name: string | null } | null;
      }[])
        .map(({ guests: g }) => (g?.display_name ?? '').trim() || `${g?.first_name ?? ''} ${g?.last_name ?? ''}`.trim())
        .filter(Boolean);
      out.set(blockId, { yes: yes.count, no: no.count, yesNames, ...(off.error || off.count === null ? {} : { notInvited: off.count }) });
    }),
  );
  return out;
}
