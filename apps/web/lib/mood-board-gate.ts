/**
 * apps/web/lib/mood-board-gate.ts — WHO MAY CHANGE THE MOOD BOARD, asked of the database, said in words.
 *
 * Owner, verbatim, 2026-10-30 (DECISION_LOG "THE MOOD BOARD IS CHANGED BY THE HOSTS — AND BY ANY SUPPLIER THEY GIVE
 * ACCESS TO, NOT BY EVERY MEMBER"): *"Only the host and whoever supplier they give access to and not all"* · *"The rest
 * can view but not edit"* · *"Host is the owners of the event"*.
 *
 * TWO PARTS OF THE BOARD, TWO ANSWERS:
 *   · THE PHOTOS (`event_inspiration_assets` — upload, replace, move, remove, a gallery pick) — the hosts AND every
 *     person whose seat the hosts set to Mood Board Edit in Event details › Event access. Asked of
 *     `public.can_change_mood_board_photos`, the SAME two sets the table's write policies ask (migration
 *     20271297714074), so this gate and the database cannot disagree.
 *   · THE PALETTE, THE THEME, THE DRESS CODE, A TEMPLATE, A PART'S SIGN-OFF, A SUGGESTION'S KEEP (columns of
 *     `public.events` and couple-only functions) — the hosts alone (`couple_can_update_event`, which does not move).
 *     Asked of `public.colour_access_caller_is_couple`, the MB16 gate those functions already use.
 *
 * 🔑 WHY ASK FIRST AT ALL: a refused UPDATE under RLS is an EMPTY SUCCESS — zero rows, no error — so without this
 * line a person who may not change the board would press Remove, see nothing go wrong, and believe it went.
 *
 * An unanswered question never lets a write through (`MOOD_BOARD_CHECK_FAILED`). Pure — the caller hands in the
 * session client — so a unit test drives it. `lib/host-gate.ts` holds the wrappers the server actions call.
 */

import { LIMITED_HELPER_CHECK_FAILED, isEventIdShape } from './limited-helper-gate';

/** Said to anyone who may view the board's photos but not change them. */
export const MOOD_BOARD_PHOTOS_REFUSAL =
  'You can view the Mood Board but not change it. The hosts can give you Mood Board access.';

/** Said to anyone but a host who tries the palette, the theme, the dress code or a sign-off. */
export const MOOD_BOARD_HOSTS_ONLY_REFUSAL = 'Only the hosts can change the palette, the theme and the dress code.';

/** The check itself did not happen — retryable, never read as "allowed". */
export const MOOD_BOARD_CHECK_FAILED = LIMITED_HELPER_CHECK_FAILED;

/** The slice of a Supabase client the gate needs. */
export type MoodBoardRpcClient = {
  rpc: (
    fn: 'can_change_mood_board_photos' | 'colour_access_caller_is_couple',
    args: { p_event_id: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

/** What a photo action is about to do — the words the owners' notice uses (migration 20271299051148). */
export type MoodBoardChangeKind = 'upload' | 'replace' | 'move' | 'remove';

/** The slice of a Supabase client the change door needs. */
export type MoodBoardChangeRpcClient = {
  rpc: (
    fn: 'begin_mood_board_change',
    args: { p_event_id: string; p_kind: MoodBoardChangeKind; p_slot_key: string | null },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

async function ask(
  client: MoodBoardRpcClient,
  fn: 'can_change_mood_board_photos' | 'colour_access_caller_is_couple',
  eventId: unknown,
  refusal: string,
): Promise<string | null> {
  // Not an event id → it addresses no event's board; the action's own validation answers it.
  if (!isEventIdShape(eventId)) return null;
  const res = await client.rpc(fn, { p_event_id: eventId });
  if (res.error) return MOOD_BOARD_CHECK_FAILED;
  return res.data === true ? null : refusal;
}

/** The sentence to show when the caller may NOT change this event's Mood Board photos, else null. */
export function moodBoardPhotosRefusalWith(client: MoodBoardRpcClient, eventId: unknown): Promise<string | null> {
  return ask(client, 'can_change_mood_board_photos', eventId, MOOD_BOARD_PHOTOS_REFUSAL);
}

/** The sentence to show when the caller is not a host of this event (palette · theme · dress code), else null. */
export function moodBoardHostsOnlyRefusalWith(client: MoodBoardRpcClient, eventId: unknown): Promise<string | null> {
  return ask(client, 'colour_access_caller_is_couple', eventId, MOOD_BOARD_HOSTS_ONLY_REFUSAL);
}

/**
 * 🖼⏱ THE PHOTO GATE THAT ALSO OPENS THE CHANGE (owner 2026-10-30, DECISION_LOG "MOOD BOARD CHANGES: SUPPLIERS ASK,
 * COORDINATORS APPLY, THE OWNERS HAVE 24 HOURS TO UNDO"). ONE call, asked first by every photo action: the database
 * answers `refused` (said in words here), `host` (an owner — nothing is recorded) or `recorded` (a coordinator, helper
 * or supplier with Mood Board Edit — the writes that follow are one change, the owners are told, and they have 24 hours
 * to Undo it). The same `can_change_mood_board_photos` question as `moodBoardPhotosRefusalWith`, asked inside
 * `begin_mood_board_change`, so the two cannot disagree. A non-string slot is sent as null and answered `bad_input`
 * AFTER the refusal — the action's own validation then says what was wrong.
 */
export async function moodBoardPhotoChangeRefusalWith(
  client: MoodBoardChangeRpcClient,
  eventId: unknown,
  kind: MoodBoardChangeKind,
  slotKey: unknown,
): Promise<string | null> {
  if (!isEventIdShape(eventId)) return null;
  const res = await client.rpc('begin_mood_board_change', {
    p_event_id: eventId,
    p_kind: kind,
    p_slot_key: typeof slotKey === 'string' && slotKey ? slotKey : null,
  });
  if (res.error) return MOOD_BOARD_CHECK_FAILED;
  const status = (res.data as { status?: unknown } | null)?.status;
  if (status === 'host' || status === 'recorded' || status === 'bad_input') return null;
  return status === 'refused' ? MOOD_BOARD_PHOTOS_REFUSAL : MOOD_BOARD_CHECK_FAILED;
}
