import 'server-only';
/**
 * The hub tools' reads for the on-the-day screen — ONE batched read per tool kind, each scoped to the event and the
 * supplier handed in, under the caller's own RLS (the frame mounting a tool is not authorisation; 2026-07-26 review).
 *
 * 🔒 HONEST: a refused or failed read is `unread`, never an empty list (CLAUDE.md rule 4).
 * Pure decisions live in `hub-tool-entries.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { dietaryFromRpc, groupEntries, type DietaryRead, type EntriesRead, type HubToolEntry, type HubToolEntryRow } from '@/lib/hub-tool-entries';

export const HUB_TOOL_ENTRY_COLUMNS = 'entry_id, tool_key, label, note, position, done_at, qty';

/** This supplier's rows in the given tools on one event, by tool. A failed read marks every asked tool `unread`. */
export async function readHubToolEntries(
  supabase: SupabaseClient,
  eventId: string,
  vendorProfileId: string,
  toolKeys: readonly string[],
): Promise<Map<string, EntriesRead>> {
  const out = new Map<string, EntriesRead>();
  if (toolKeys.length === 0) return out;
  const { data, error } = await supabase
    .from('vendor_hub_tool_entries')
    .select(HUB_TOOL_ENTRY_COLUMNS)
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .in('tool_key', [...toolKeys])
    .order('position', { ascending: true });
  if (error || !data) {
    logQueryError('readHubToolEntries', error, { event_id: eventId }, 'graceful_degrade');
    for (const k of toolKeys) out.set(k, { state: 'unread' });
    return out;
  }
  for (const [k, entries] of groupEntries(data as HubToolEntryRow[], toolKeys)) out.set(k, { state: 'ok', entries });
  return out;
}

/** The Dietary & allergies sheet — the RSVP answers, for a supplier booked under a food category only. */
export async function readDietaryList(supabase: SupabaseClient, eventId: string): Promise<DietaryRead> {
  const { data, error } = await supabase.rpc('vendor_event_dietary_list', { p_event_id: eventId });
  if (error) logQueryError('readDietaryList', error, { event_id: eventId }, 'graceful_degrade');
  return dietaryFromRpc(data, error);
}

/* ── 👀 THE COUPLE'S READ (owner 23 Nov 2026: "let couples see the checklist ticks") ─────────────────────────────── */

/** One supplier checklist as the couple sees it on their supplier workspace. */
export type CoupleChecklist = { toolKey: string; title: string; entries: HubToolEntry[] };
export type CoupleChecklistsRead = { state: 'ok'; lists: CoupleChecklist[] } | { state: 'unread' };

/**
 * A booked supplier's CHECKLIST tools on one event, for the couple (their own session; `vendor_hub_tool_entries_couple_read`
 * admits the event's hosts to rows of a tool whose `hub_tools.couple_sees` is on — migration 20271361284618). Which
 * tools is the library's flag, read here, never a list in code. Only lists with rows come back: a supplier who keeps no
 * paperwork list has nothing to show. A refused read is `unread`, never "they keep no lists".
 */
export async function readCoupleChecklists(
  supabase: SupabaseClient,
  eventId: string,
  vendorProfileId: string,
): Promise<CoupleChecklistsRead> {
  const { data: tools, error: toolsError } = await supabase
    .from('hub_tools')
    .select('tool_key, label')
    .eq('couple_sees', true)
    .eq('is_active', true)
    .eq('template', 'checklist')
    .order('sort_order');
  if (toolsError || !tools) {
    logQueryError('readCoupleChecklists.tools', toolsError, { event_id: eventId }, 'graceful_degrade');
    return { state: 'unread' };
  }
  const shown = (tools as Array<{ tool_key: string; label: string }>).filter((t) => t.tool_key !== 'shot_list');
  if (shown.length === 0) return { state: 'ok', lists: [] };
  const read = await readHubToolEntries(supabase, eventId, vendorProfileId, shown.map((t) => t.tool_key));
  const lists: CoupleChecklist[] = [];
  for (const t of shown) {
    const r = read.get(t.tool_key);
    if (!r || r.state !== 'ok') return { state: 'unread' };
    if (r.entries.length > 0) lists.push({ toolKey: t.tool_key, title: t.label, entries: r.entries });
  }
  return { state: 'ok', lists };
}
