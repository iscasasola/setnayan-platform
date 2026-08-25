import type { NotificationType } from '@/lib/notifications';

// The rules that decide who hears a samahan, and in what words.
//
// SEPARATE FROM samahan-notify.ts ON PURPOSE: that file is `server-only` (it
// holds the service-role fan-out), and a server-only module cannot be imported
// by a unit test. The decisions worth proving without a database live here,
// pure, where they can be exercised directly — see samahan-notice-rules.test.ts.

export type SamahanNoticeKind = 'story' | 'message';

export const NOTICE_TYPE: Record<SamahanNoticeKind, NotificationType> = {
  story: 'samahan_story',
  message: 'samahan_message',
};

/** Where the notice points — also the collapse key, so both must agree. */
export function samahanNoticeUrl(communityId: string, kind: SamahanNoticeKind): string {
  return kind === 'message'
    ? `/dashboard/samahan/${communityId}?tab=usapan`
    : `/dashboard/samahan/${communityId}`;
}

/**
 * How long one unread notice speaks for the ones behind it. A samahan already
 * allows one story per member per clock hour, so an hour is the group's own
 * rhythm for "this is the same burst".
 */
export const COLLAPSE_WINDOW_MS = 60 * 60 * 1000;

/** An unread notice already sitting in somebody's tray for this samahan. */
export type StandingNotice = { userId: string; createdAt: string };

/**
 * Who actually gets told. Pure, so the rules that matter can be proved without
 * a database:
 *   · the person who just posted is never told about their own post;
 *   · anybody already holding a RECENT unread notice of this kind for this
 *     samahan is skipped, so a burst of chat rings once.
 *
 * 🔑 THE WINDOW IS WHAT KEEPS THIS FROM BECOMING A PERMANENT MUTE, and the
 * first version of this file had that bug. Collapsing on "has any unread notice"
 * sounds right until you look at how a notice becomes read: the tray's Open
 * button takes you to the samahan and does NOT clear anything — clearing is a
 * separate "Mark read" press that plenty of people never make. So a single
 * unread notice from last Tuesday would have silenced the group for that person
 * for good, and the symptom would have been an absence nobody could see. Bursts
 * are minutes apart; a mute is forever. The window tells them apart.
 *
 * `standing` is NULL when the collapse read was REFUSED — Supabase resolves with
 * { error } and an empty list, which looks identical to "nobody is ringing". We
 * ring everybody in that case: a duplicate notice is noise, silence is the
 * defect this file exists to remove.
 */
export function selectSamahanRecipients(
  memberIds: readonly string[],
  actorUserId: string,
  standing: readonly StandingNotice[] | null,
  now: number = Date.now(),
): string[] {
  const alreadyRinging = new Set(
    (standing ?? [])
      .filter((n) => {
        const at = new Date(n.createdAt).getTime();
        // An unreadable timestamp must not mute anybody: fail toward ringing,
        // the same direction as a refused read.
        if (!Number.isFinite(at)) return false;
        return now - at < COLLAPSE_WINDOW_MS;
      })
      .map((n) => n.userId),
  );
  return [
    ...new Set(
      memberIds.filter(
        (id) => Boolean(id) && id !== actorUserId && !alreadyRinging.has(id),
      ),
    ),
  ];
}

export function samahanNoticeCopy(
  kind: SamahanNoticeKind,
  actorName: string,
  communityName: string,
): { title: string; body: string } {
  const who = actorName.trim() || 'Someone';
  const where = communityName.trim() || 'your samahan';
  return kind === 'story'
    ? {
        title: `${who} added to ${where}`,
        body: 'Their clip is there for the next 24 hours.',
      }
    : {
        title: `${who} wrote in ${where}`,
        body: 'Open Usapan to read it.',
      };
}
