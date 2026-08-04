import { createClient } from '@/lib/supabase/server';

/**
 * Authorization boundary for the Live Studio control room and every surface that
 * mirrors its video (today: the OBS program-output pop-out).
 *
 * A control-room member is a moderator (the couple, or a coordinator who accepted
 * an invite and hasn't been removed) or a legacy `event_members.member_type =
 * 'couple'` row. This is a day-of OPERATOR gate, not a viewer gate — guests watch
 * on the public live page, never here.
 *
 * Extracted from broadcast/page.tsx so the pop-out cannot drift into being a
 * softer door to the same feed: both routes must gate identically.
 */
export async function requirePanoodControlRoomMember(
  eventId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();

  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (moderator) return true;

  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  return legacy?.member_type === 'couple';
}

/**
 * The UNIFIED Live Studio controller's host gate (Wave 4).
 *
 * Same two sources as above, plus a legacy `coordinator` — and that difference is
 * deliberate, not drift. It matches TWO things this surface must agree with:
 *
 *   • `live_studio_roam_zones` RLS, which is `member_type IN ('couple','coordinator')`
 *     (migration 20270919193341). A coordinator can already read and write the
 *     channels under their own session, so a page gate that excluded them would
 *     lock them out of rows the database hands them.
 *   • the controller's own server actions (setup/actions.ts → requireHostMembership),
 *     which have always accepted a coordinator. A page stricter than its own POST
 *     handlers means a coordinator can submit a form and then be bounced off the
 *     screen that submitted it.
 *
 * Extracted because Wave 4 needs the SAME predicate on the page as in the actions:
 * the page reads camera SEAT rows through the service-role client (their RLS is
 * control-room-only and does not cover a moderator), so the membership check is the
 * only thing standing in front of that read. It must not be able to drift from the
 * gate on the writes.
 *
 * Returns a boolean; the caller decides what forbidden means.
 */
export async function isLiveStudioSetupHost(
  eventId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();

  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (moderator) return true;

  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  const type = (legacy as { member_type?: string } | null)?.member_type;
  return type === 'couple' || type === 'coordinator';
}
