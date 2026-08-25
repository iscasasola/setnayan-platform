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
 * Who actually gets told. Pure, so the two rules that matter can be proved
 * without a database:
 *   · the person who just posted is never told about their own post;
 *   · anybody already holding an unread notice of this kind for this samahan is
 *     skipped, so a burst of chat rings once.
 *
 * `standing` is NULL when the collapse read was REFUSED — Supabase resolves with
 * { error } and an empty list, which looks identical to "nobody is ringing". We
 * ring everybody in that case: a duplicate notice is noise, silence is the
 * defect this file exists to remove.
 */
export function selectSamahanRecipients(
  memberIds: readonly string[],
  actorUserId: string,
  standing: readonly string[] | null,
): string[] {
  const alreadyRinging = new Set(standing ?? []);
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
