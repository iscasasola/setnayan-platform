import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import {
  COLLAPSE_WINDOW_MS,
  NOTICE_TYPE,
  samahanNoticeCopy,
  samahanNoticeUrl,
  selectSamahanRecipients,
  type SamahanNoticeKind,
} from '@/lib/samahan-notice-rules';

export type { SamahanNoticeKind };
export { COLLAPSE_WINDOW_MS, samahanNoticeCopy, samahanNoticeUrl, selectSamahanRecipients };

// THE SAMAHAN WAS SILENT — the group could not reach its own members.
//
// Measured on prod the day this shipped: 61 files call emitNotification and NOT
// ONE of them is on the samahan surface. So a member recorded a 3-second story
// that disappears in 24 hours, or wrote in Usapan, and the rest of the group was
// told nothing at all. A 24-hour feed that nobody is told about is a feed with
// no audience: by the time somebody happens to open the page, the clip they were
// meant to see has expired by RLS.
//
// Two shapes, one helper:
//   story   → "Ana added to Barkada" · gone in 24 hours, so it is time-shaped
//   message → "Ana wrote in Barkada" · Usapan
//
// 🔑 ONE UNREAD NOTICE PER SAMAHAN PER PERSON. A group chat is bursty — twenty
// messages in a minute is normal — and one row per message would bury every
// other notification a person has under a conversation they are already in.
// Before writing, we ask which recipients ALREADY have an unread notice of this
// kind pointing at this samahan, and skip them. Reading the tray clears it and
// the next burst rings once more.
//
// 🔑 THE COLLAPSE READ FAILS TOWARD RINGING. Supabase does not throw — a refused
// read resolves with { error } and an empty list, which is indistinguishable
// from "nobody has an unread notice". Treating that as "everybody is already
// notified" would silence the whole feature the moment the query broke, and the
// symptom would be an absence nobody can see. So a refused read notifies
// everyone: a duplicate notice is noise, silence is the bug this file exists to
// fix.
//
// 🔑 NO MESSAGE PREVIEW, ON PURPOSE. Taking a message down is a SOFT delete, and
// a preview copied into a notification row has no inverse — the words would
// survive in the tray of every recipient after the author removed them. The
// notice says who wrote and where; the words stay in the one place that can
// still take them back.
//
// Neither type is on the email or push allowlist in notification-emit.ts. The
// in-app bell rings; nobody's phone buzzes at 2am until the owner has ruled on
// quiet hours (WHATS_NEXT_Samahan_2026-08-24.md § 3.2).

const FANOUT_BATCH = 25;

/**
 * Tell everyone else in the samahan. Best-effort throughout: the poster's own
 * story or message has already landed by the time this runs, and nothing here
 * may undo it or surface an error to them.
 *
 * Returns how many people were told — so a caller can log it and a test can
 * assert the collapse actually collapsed.
 */
export async function notifySamahanCoMembers(args: {
  communityId: string;
  actorUserId: string;
  kind: SamahanNoticeKind;
}): Promise<number> {
  const { communityId, actorUserId, kind } = args;
  if (!communityId || !actorUserId) return 0;

  try {
    const admin = createAdminClient();

    // The roster fan-out uses the service-role client because the ACTOR is the
    // one acting: their own session can read the roster, but this runs after
    // the response in `after()`, where that session is no longer the caller.
    const { data: memberRows } = await admin
      .from('community_members')
      .select('user_id')
      .eq('community_id', communityId);
    // The actor filter lives in selectSamahanRecipients and NOWHERE ELSE — two
    // copies of one rule drift, and the copy that drifts is the one that stops
    // excluding you from your own notifications.
    const roster = (memberRows ?? []).map((r) => (r as { user_id: string }).user_id);
    const recipients = selectSamahanRecipients(roster, actorUserId, []);
    if (recipients.length === 0) return 0;

    const { data: community } = await admin
      .from('communities')
      .select('name, archived')
      .eq('community_id', communityId)
      .maybeSingle();
    // A closed samahan rings nobody.
    if (!community || (community as { archived?: boolean }).archived) return 0;

    const { data: actor } = await admin
      .from('users')
      .select('display_name')
      .eq('user_id', actorUserId)
      .maybeSingle();

    const type = NOTICE_TYPE[kind];
    const relatedUrl = samahanNoticeUrl(communityId, kind);
    const { title, body } = samahanNoticeCopy(
      kind,
      (actor as { display_name?: string | null } | null)?.display_name ?? '',
      (community as { name?: string | null }).name ?? '',
    );

    // Collapse: who is already holding an unread notice of this kind for this
    // samahan? `error` is checked explicitly — see the fail-toward-ringing note
    // at the top of this file.
    const { data: standing, error: standingErr } = await admin
      .from('notifications')
      .select('user_id, created_at')
      .eq('type', type)
      .eq('related_url', relatedUrl)
      .is('read_at', null)
      .gte('created_at', new Date(Date.now() - COLLAPSE_WINDOW_MS).toISOString())
      .in('user_id', recipients);
    const toTell = selectSamahanRecipients(
      recipients,
      actorUserId,
      standingErr
        ? null
        : (standing ?? []).map((r) => {
            const row = r as { user_id: string; created_at: string };
            return { userId: row.user_id, createdAt: row.created_at };
          }),
    );
    if (toTell.length === 0) return 0;

    for (let i = 0; i < toTell.length; i += FANOUT_BATCH) {
      const batch = toTell.slice(i, i + FANOUT_BATCH);
      await Promise.all(
        batch.map((userId) =>
          emitNotification({ userId, type, title, body, relatedUrl }).catch(() => {}),
        ),
      );
    }
    return toTell.length;
  } catch {
    /* best-effort — never breaks the post it follows */
    return 0;
  }
}
