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
