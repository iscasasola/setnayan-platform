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
import { createClient } from '@/lib/supabase/server';

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
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Source 1 — event_moderators (canonical going forward · iteration 0048 V1).
  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
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
