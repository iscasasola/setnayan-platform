/**
 * Host-membership gate for guest-website editor server actions
 * (OPEN-BROWSE PR10 — council verdict 2026-07-22 §1.4 "one requireHostMembership
 * helper in lib/host-gate.ts"). Before this, five website-editor action files
 * (`site-chrome`, `our-photos`, `hero-photo`, `widgets`, `privacy`) each carried
 * a byte-for-byte copy of the same event_moderators-OR-legacy-couple check —
 * the exact drift hazard the council named. This is now the ONE definition.
 *
 * The one REAL difference between those copies was the forbidden action:
 * `site-chrome` / `our-photos` / `hero-photo` `redirect('/dashboard')`, while
 * `widgets` / `privacy` `throw new Error('Forbidden — …')`. That inconsistency
 * is SURFACED, not silently resolved (§4/§5.6): the shared auth CORE lives in
 * {@link getHostUserId}; each caller keeps its behavior by choosing the
 * redirect wrapper ({@link requireHostMembership}) or the throwing wrapper
 * ({@link requireHostMembershipOrThrow}). A future decision to unify them (the
 * §5.6 moderator-vs-couple owner sign-off) changes only which wrapper they call.
 *
 * NOTE (§1.4): this is `requireHostMembership` — moderators OR legacy couple.
 * The stricter couple-only `requireCouple` (launch + STD studio) is a DIFFERENT
 * gate and is deliberately NOT folded in here.
 */
import { redirect } from 'next/navigation';
import { AUTH_READ_FAILED_MESSAGE, authReadFailed } from '@/lib/auth-read';
import { createClient } from '@/lib/supabase/server';
import {
  isEventIdShape,
  limitedHelperRefusalWith,
  refuseLimitedHelperWith,
  type LimitedHelperRpcClient,
} from '@/lib/limited-helper-gate';
import type { DelegateArea } from '@/lib/delegate-areas';
import {
  moodBoardHostsOnlyRefusalWith,
  moodBoardPhotoChangeRefusalWith,
  moodBoardPhotosRefusalWith,
  type MoodBoardChangeKind,
  type MoodBoardChangeRpcClient,
  type MoodBoardRpcClient,
} from '@/lib/mood-board-gate';

/**
 * 👁 A LIMITED HELPER VIEWS — AND CHANGES ONLY WHAT THE HOST SET TO EDIT
 * (owner 2026-09-28 · 2026-10-26; see `lib/limited-helper-gate.ts`). The FIRST
 * line of every server action under `app/dashboard/[eventId]`, naming the area
 * the action changes (null = no area: hosts only). Throws "You can view … but
 * not change it." when the caller's seat on `eventId` is a live limited helper
 * whose level for `area` is not 'edit'. A co-host, the creator and everybody
 * else pass through to the action's own gate unchanged. Takes `unknown` so a raw
 * `formData.get(...)` can be handed straight in — a value that is not an event
 * id passes, and the action's own validation answers it.
 */
export async function refuseLimitedHelper(eventId: unknown, area: DelegateArea | null): Promise<void> {
  if (!isEventIdShape(eventId)) return;
  const supabase = await createClient();
  await refuseLimitedHelperWith(supabase as unknown as LimitedHelperRpcClient, eventId, area);
}

/**
 * The same gate for an action that answers `{ ok: false, error }` instead of
 * throwing: returns the sentence to show ("You can view the seat plan but not
 * change it."), or null when the caller may go on. In production a THROWN
 * server-action message is replaced by a generic one, so an action whose
 * screen already prints its `error` (through `plainRefusal`) says it this way
 * and the helper reads the real reason in place.
 */
export async function limitedHelperRefusal(eventId: unknown, area: DelegateArea | null): Promise<string | null> {
  if (!isEventIdShape(eventId)) return null;
  const supabase = await createClient();
  return limitedHelperRefusalWith(supabase as unknown as LimitedHelperRpcClient, eventId, area);
}

/**
 * 🖼 THE MOOD BOARD'S PHOTOS — the hosts, and whoever they set to Mood Board Edit (owner 2026-10-30; see
 * `lib/mood-board-gate.ts`). The sentence to show, or null when the caller may add, replace, move or remove a photo.
 * Asked AFTER `refuseLimitedHelper(…, 'mood_board')`, never instead of it.
 */
export async function moodBoardPhotosRefusal(eventId: unknown): Promise<string | null> {
  const supabase = await createClient();
  return moodBoardPhotosRefusalWith(supabase as unknown as MoodBoardRpcClient, eventId);
}

/** The same question, throwing — for an action that answers nothing. */
export async function refuseUnlessMoodBoardPhotos(eventId: unknown): Promise<void> {
  const refusal = await moodBoardPhotosRefusal(eventId);
  if (refusal) throw new Error(refusal);
}

/**
 * 🖼⏱ The photo gate for an action that CHANGES the board (upload · replace · move · remove): the same question, and —
 * for a person who is not an owner — the change it opens, which the owners are told about and may Undo for 24 hours
 * (`lib/mood-board-gate.ts`, migration 20271299051148). One request either way.
 */
export async function moodBoardPhotoChangeRefusal(
  eventId: unknown,
  kind: MoodBoardChangeKind,
  slotKey: unknown,
): Promise<string | null> {
  const supabase = await createClient();
  return moodBoardPhotoChangeRefusalWith(supabase as unknown as MoodBoardChangeRpcClient, eventId, kind, slotKey);
}

/** The same, throwing — for an action that answers nothing. */
export async function refuseUnlessMoodBoardPhotoChange(eventId: unknown, kind: MoodBoardChangeKind, slotKey: unknown): Promise<void> {
  const refusal = await moodBoardPhotoChangeRefusal(eventId, kind, slotKey);
  if (refusal) throw new Error(refusal);
}

/**
 * 🎨 THE PALETTE, THE THEME, THE DRESS CODE, A TEMPLATE, A SIGN-OFF — the hosts alone (`couple_can_update_event` does
 * not move). Throws the refusal for anyone else, so a person given Mood Board Edit for the PHOTOS is told so here
 * instead of being silently refused by RLS.
 */
export async function refuseUnlessMoodBoardHost(eventId: unknown): Promise<void> {
  const refusal = await moodBoardHostRefusal(eventId);
  if (refusal) throw new Error(refusal);
}

/** The same question as a value, for an action that answers `{ status, … }`. */
export async function moodBoardHostRefusal(eventId: unknown): Promise<string | null> {
  const supabase = await createClient();
  return moodBoardHostsOnlyRefusalWith(supabase as unknown as MoodBoardRpcClient, eventId);
}

/**
 * The shared auth core. Returns the authenticated user's id when they are an
 * accepted host of `eventId` (an `event_moderators` row with `accepted_at` set
 * and no `removed_at`, OR a legacy `event_members` `couple` row); returns
 * `null` when authenticated but NOT a host. Redirects to `/login` when there is
 * no session at all (every prior inline copy did this identically). The
 * forbidden (`null`) decision is the caller's — see the two wrappers.
 */
export async function getHostUserId(eventId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (!user) {
    /* 🔑 "No user" because the CHECK failed (Supabase unreachable, 5xx, 429)
       is NOT "signed out" — the cookie is intact. Throw a retryable error the
       caller shows in place; only a real absence of a session goes to sign-in
       (`lib/auth-read.ts`, owner's live report 2026-09-29). */
    if (authReadFailed(error)) throw new Error(AUTH_READ_FAILED_MESSAGE);
    redirect('/login');
  }

  // Source 1 — event_moderators (canonical going forward · iteration 0048 V1).
  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .neq('role_subtype', 'viewer') // a limited helper views, never edits (owner 2026-09-28)
    .is('removed_at', null)
    .maybeSingle();
  if (moderator) return user.id;

  // Source 2 — event_members couple row (V1 backwards-compat).
  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (legacy && (legacy as { member_type: string }).member_type === 'couple') {
    return user.id;
  }

  return null;
}

/**
 * Host gate, REDIRECT variant (site-chrome / our-photos / hero-photo behavior):
 * non-hosts are sent to `/dashboard`. Returns the host user id.
 */
export async function requireHostMembership(eventId: string): Promise<string> {
  const userId = await getHostUserId(eventId);
  if (userId === null) redirect('/dashboard');
  return userId;
}

/**
 * Host gate, THROW variant (widgets / privacy behavior): non-hosts raise a
 * `Forbidden` error. `message` preserves each caller's original wording.
 * Returns the host user id.
 */
export async function requireHostMembershipOrThrow(
  eventId: string,
  message = 'Forbidden — only current hosts can edit this event.',
): Promise<string> {
  const userId = await getHostUserId(eventId);
  if (userId === null) throw new Error(message);
  return userId;
}
