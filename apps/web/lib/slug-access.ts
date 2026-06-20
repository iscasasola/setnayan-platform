import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { readGuestSession } from '@/lib/guest-session';

/**
 * canViewSlugEvent — the single source of truth for "may the current viewer see
 * this wedding's /[slug] content?".
 *
 * app/[slug]/page.tsx applies this gate inline; the sub-routes (find-seat,
 * find-my-table, recap, …) historically did NOT, so a private (pre-launch) page
 * leaked couple data — names/venue/date — through a guessable URL. They now all
 * call this helper.
 *
 * Rules (mirror page.tsx:499-545):
 *   • public / unlisted  → always viewable (unlisted = link-only, just noindex).
 *   • private            → only an invited guest with a matching guest-session
 *     cookie, OR a signed-in host (event_members couple/host, or an accepted +
 *     non-removed event_moderator). Everyone else (strangers) is blocked.
 *
 * NULL visibility coalesces to 'private' (fail safe), matching the page.
 */
export async function canViewSlugEvent(
  eventId: string,
  visibilityRaw: string | null | undefined,
): Promise<boolean> {
  const visibility = visibilityRaw ?? 'private';
  if (visibility !== 'private') return true;

  // Path A — invited guest who redeemed their personal link on this device.
  const session = await readGuestSession();
  if (session?.event_id === eventId) return true;

  // Path B — signed-in host (couple member or accepted moderator).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const admin = createAdminClient();
  const [{ data: memberRow }, { data: moderatorRow }] = await Promise.all([
    admin
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('event_moderators')
      .select('moderator_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  ]);
  return Boolean(memberRow) || Boolean(moderatorRow);
}
