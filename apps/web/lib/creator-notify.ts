import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';

// Creator "Adventure Chapter" — AUDIENCE layer · notify-on-new-chapter.
//
// When a followed account PUBLISHES a chapter, tell their followers. Reuses the
// existing notification pipeline (emitNotification → in-app row + branded email
// via Resend). Email is consent-gated inside emitNotification (the
// 'new_chapter_from_followed' type is on MARKETING_GATED_EMAIL_TYPES), so an
// opted-out follower still gets the in-app notification but no email (RA 10173).
//
// Runs via `after()` from the publish action — fire-and-forget, never blocks the
// author's publish. The follower lookup uses the service-role admin client
// because the author is the FOLLOWED party and Pattern A on user_follows only
// lets a caller read their OWN follow rows (the graph stays private).

const FANOUT_BATCH = 25;

/**
 * Fan a "new chapter" notification out to every follower of `authorUserId`.
 * Only fires when the author's profile is public (else the chapter link would
 * 404 for followers). Best-effort throughout — a failure never surfaces to the
 * author's publish flow.
 */
export async function notifyFollowersOfNewChapter(args: {
  authorUserId: string;
  chapterPublicId: string;
  chapterTitle: string;
}): Promise<void> {
  const { authorUserId, chapterPublicId, chapterTitle } = args;
  if (!authorUserId || !chapterPublicId) return;

  try {
    const admin = createAdminClient();

    // Author must be publicly visible — otherwise the chapter isn't reachable
    // and a notification link would dead-end.
    const { data: author } = await admin
      .from('users')
      .select('display_name, slug, public_profile_enabled')
      .eq('user_id', authorUserId)
      .maybeSingle();
    if (!author || author.public_profile_enabled !== true || !author.slug) {
      return;
    }

    const { data: followers } = await admin
      .from('user_follows')
      .select('follower_user_id')
      .eq('followed_user_id', authorUserId);
    const followerIds = (followers ?? [])
      .map((r) => r.follower_user_id as string)
      .filter(Boolean);
    if (followerIds.length === 0) return;

    const name = author.display_name?.trim() || 'Someone you follow';
    const title = `${name} published a new chapter`;
    const body = chapterTitle?.trim()
      ? `"${chapterTitle.trim()}" is now live.`
      : 'A new chapter is now live.';
    const relatedUrl = `/u/${author.slug}/c/${chapterPublicId}`;

    // Batch the fan-out so a creator with many followers doesn't open hundreds
    // of concurrent notification writes at once.
    for (let i = 0; i < followerIds.length; i += FANOUT_BATCH) {
      const batch = followerIds.slice(i, i + FANOUT_BATCH);
      await Promise.all(
        batch.map((followerId) =>
          emitNotification({
            userId: followerId,
            type: 'new_chapter_from_followed',
            title,
            body,
            relatedUrl,
          }).catch(() => {}),
        ),
      );
    }
  } catch {
    /* best-effort — never breaks the publish */
  }
}
