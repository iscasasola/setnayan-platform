import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import { INVITATION_CHAPTER_FIELDS, invitationChapters, needsNoSeat, partialInviteTag, seatedChapterIds, type InvitationChapter } from './invitation-chapters';
import { askedOnce } from './request-once';

/**
 * ✉ PER-GUEST "INVITED TO" CHAPTERS — the event-wide reads (owner 2026-11-02, DECISION_LOG "PER-GUEST "INVITED TO"
 * CHAPTERS"; table `guest_chapter_not_invited`, migration 20271302948959). NOT 'server-only' on purpose: the seat plan's
 * stop-readers (`lib/seating-inputs.ts`) read through here and are exercised by node tests with a stub client. Every
 * function takes the caller's own client — RLS decides what it may read. The per-guest reads live in
 * `invitation-chapters.server.ts`.
 *
 * 🔒 The table, which column the chapter fence reads, and which guests the database refuses an answer for are the
 * migration's; this file only asks.
 */
type Client = SupabaseClient;

/** The chapter fence these reads use — the same three questions `onlyInvitationChapters` asks. */
function invitationChapterQuery(client: Client, eventId: string, columns: string) {
  return client
    .from('event_schedule_blocks')
    .select(columns)
    .eq('event_id', eventId)
    .eq('on_invitation', true)
    .is('parent_block_id', null)
    .neq('visibility', 'coordinator_only');
}

/**
 * ✉ The event's chapters on the invitation, in the day's order — asked ONCE per render for this client (the Guests page's
 * tags and the open guest card's "Invited to ▾" ask the same question; `askedOnce`, lib/request-once.ts). `null` = the read
 * failed.
 */
export function readInvitationChapterList(client: Client, eventId: string): Promise<InvitationChapter[] | null> {
  return askedOnce(client, 'event_schedule_blocks.invitation_chapters', [eventId], async () => {
    const { data, error } = await invitationChapterQuery(client, eventId, INVITATION_CHAPTER_FIELDS).order('start_at', { ascending: true });
    if (error || !data) {
      if (error) logQueryError('readInvitationChapterList', error, { event_id: eventId }, 'graceful_degrade');
      return null;
    }
    return invitationChapters((Array.isArray(data) ? data : []) as unknown as Parameters<typeof invitationChapters>[0]);
  });
}

const NOT_INVITED_PAGE = 1000;

/**
 * ✉ Every "taken off" row of one event, guest by guest — the Guest list's tags and the seat plan read it once. `null` =
 * the read failed (the list then draws no tag rather than a wrong one; the seat plan offers everyone, as before).
 */
export async function readEventNotInvited(client: Client, eventId: string): Promise<Map<string, Set<string>> | null> {
  const out = new Map<string, Set<string>>();
  // Page by page — a list is never cut at PostgREST's 1,000 rows (unlimited guests).
  for (let from = 0; ; from += NOT_INVITED_PAGE) {
    const { data, error } = await client
      .from('guest_chapter_not_invited')
      .select('guest_id, block_id')
      .eq('event_id', eventId)
      .order('guest_id', { ascending: true })
      .order('block_id', { ascending: true })
      .range(from, from + NOT_INVITED_PAGE - 1);
    if (error || !data) {
      if (error) logQueryError('readEventNotInvited', error, { event_id: eventId }, 'graceful_degrade');
      return null;
    }
    const rows = Array.isArray(data) ? (data as { guest_id: string; block_id: string }[]) : [];
    for (const r of rows) {
      const set = out.get(r.guest_id) ?? new Set<string>();
      set.add(r.block_id);
      out.set(r.guest_id, set);
    }
    if (rows.length < NOT_INVITED_PAGE) return out;
  }
}

/**
 * 🪑 SEATS FOLLOW THE INVITATION (owner 2026-11-02, "seats follow it"): the guests taken off EVERY seated chapter
 * ("after party only" — `seatedChapterIds`, `needsNoSeat`). The seat plan does not offer them and Auto arrange does not
 * seat them. No seated chapter, or nobody taken off one → an empty set (the seat plan exactly as before). `null` = a read
 * was refused: the page offers everyone, as before; an arranging action STOPS (lib/seating-inputs.ts).
 */
export async function readNoSeatGuestIds(client: Client, eventId: string): Promise<Set<string> | null> {
  const { data, error } = await invitationChapterQuery(client, eventId, 'block_id, label, block_type');
  if (error || !data) {
    if (error) logQueryError('readNoSeatGuestIds', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  // A list read always answers a list; anything else (a stand-in client) is read as "no chapter", never thrown on.
  const rows = Array.isArray(data) ? (data as unknown as { block_id: string; label: string; block_type: string | null }[]) : [];
  const seated = seatedChapterIds(rows);
  if (seated.size === 0) return new Set();
  const off = await readEventNotInvited(client, eventId);
  if (!off) return null;
  const out = new Set<string>();
  for (const [guestId, set] of off) if (needsNoSeat(seated, set)) out.add(guestId);
  return out;
}

/**
 * 🏷 THE GUEST LIST'S TAGS (owner 2026-11-02, "a partial invite shows a tag"): guest id → "After party only" · "Not at
 * Ceremony", for the guests taken off part of the day — nobody else. Two reads, and only the second when the invitation
 * has chapters. `null` = a read was refused (the list then draws no tag, and logs it — a quiet note, never a count).
 */
export async function readInviteTagsByGuest(client: Client, eventId: string): Promise<Record<string, string> | null> {
  const chapters = await readInvitationChapterList(client, eventId);
  if (!chapters) return null;
  if (chapters.length === 0) return {};
  const off = await readEventNotInvited(client, eventId);
  if (!off) return null;
  const out: Record<string, string> = {};
  for (const [guestId, set] of off) {
    const tag = partialInviteTag(chapters, set);
    if (tag) out[guestId] = tag;
  }
  return out;
}

