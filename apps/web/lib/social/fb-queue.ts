/**
 * apps/web/lib/social/fb-queue.ts — Facebook holds the schedule (owner, 28 Nov 2026: "schedule posts on Facebook
 * itself and stay cron-free").
 *
 * The ordinary `after()` flush, on any site visit, hands every slot post of the next ~7 days to Facebook as a
 * SCHEDULED post (published=false + scheduled_publish_time). Facebook then publishes it at the slot with nobody on
 * our site — no timer, no secret, no cron. Our row moves `scheduled → scheduled_on_fb` and keeps Facebook's id:
 *
 *   • pull   → the post is deleted on Facebook first, then the row is pulled;
 *   • edit   → the text is updated on Facebook first, then on the row;
 *   • switch → with autopublish or Facebook turned off, every post still waiting on Facebook is taken back;
 *   • settle → the first visit after the slot asks Facebook whether it went out, adds the first comment (a comment
 *              cannot be scheduled) and marks the row published.
 *
 * The Facebook calls and the database are both injected (`FbOps`, `Db`), so every rule here is unit-tested with
 * fakes; `lib/social/flush.ts` and the admin actions pass the real ones from `lib/social/facebook.ts`. Never throws
 * on a Facebook failure: each one is recorded on the row.
 */
import {
  FB_HANDOFF_HORIZON_MS,
  FB_SCHEDULE_MIN_LEAD_MS,
  canScheduleOnFacebook,
} from '@/lib/social/facebook-request';
import { slotVerdict } from '@/lib/social/governor';
import { logQueryError } from '@/lib/supabase/error-detect';

/** The row fields this module reads. */
export type QueueRow = {
  post_id: string;
  source_type: string;
  source_ref: string;
  title: string | null;
  body: string;
  media_url: string | null;
  media_urls: string[] | null;
  link_url: string | null;
  publish_after: string | null;
  hold_until: string | null;
  scheduled_for: string | null;
  slot: string | null;
  status: string;
  first_comment: string | null;
  facebook_post_id: string | null;
  platform_results: Record<string, unknown> | null;
};

/** The row fields this module reads, as one select. */
const QUEUE_ROW_SELECT =
  'post_id, source_type, source_ref, title, body, media_url, media_urls, link_url, publish_after, hold_until, scheduled_for, slot, status, first_comment, facebook_post_id, platform_results';

type OpResult = { ok: true } | { ok: false; error: string };

/** The Facebook calls this module needs. The real ones live in `lib/social/facebook.ts`. */
export type FbOps = {
  schedule(row: QueueRow, at: Date): Promise<{ ok: true; externalId: string } | { ok: false; error: string }>;
  remove(fbPostId: string): Promise<OpResult>;
  editMessage(fbPostId: string, message: string): Promise<OpResult>;
  isPublished(fbPostId: string): Promise<{ ok: true; published: boolean } | { ok: false; error: string }>;
  comment(fbPostId: string, message: string): Promise<{ ok: true; commentId: string } | { ok: false; error: string }>;
};

/** The slice of the Supabase client used here (structural, so the recording fake in tests fits). */
export type Db = { from(table: string): any };

/** A schedule that keeps failing stops retrying on every visit and fails with its reason. */
export const MAX_SCHEDULE_ATTEMPTS = 3;
/** How long after its slot a post may still be unconfirmed before it is called failed. */
export const SETTLE_GRACE_MS = 2 * 60 * 60 * 1000;

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);

/**
 * Which queued rows go to Facebook now: still `scheduled`, not already handed over, on a real slot that has not
 * opened (`slotVerdict` = wait), 10 minutes to 7 days ahead (Facebook's floor, the controller's horizon), and past
 * every hold — the pull window and the content gate — so nothing goes to Facebook that could still be pulled by
 * its rules.
 */
export function pickHandOffs<T extends Pick<QueueRow, 'status' | 'facebook_post_id' | 'scheduled_for' | 'slot' | 'source_type' | 'hold_until' | 'publish_after'>>(
  rows: readonly T[],
  now: Date,
): T[] {
  return rows.filter((row) => {
    if (row.status !== 'scheduled' || row.facebook_post_id || !row.scheduled_for) return false;
    if (slotVerdict(row, now) !== 'wait') return false;
    const at = new Date(row.scheduled_for);
    if (!canScheduleOnFacebook(at, now)) return false;
    if (at.getTime() - now.getTime() > FB_HANDOFF_HORIZON_MS) return false;
    if (row.hold_until && ms(row.hold_until) > now.getTime()) return false;
    if (row.publish_after && ms(row.publish_after) > at.getTime()) return false;
    return true;
  });
}

function facebookLeg(row: QueueRow): Record<string, unknown> {
  const fb = row.platform_results?.facebook;
  return fb && typeof fb === 'object' ? (fb as Record<string, unknown>) : {};
}

/**
 * Hand the next ~7 days of slot posts to Facebook. Each row is CLAIMED first (scheduled → publishing, conditional),
 * so two overlapping visits can never schedule the same post twice. `allowed` re-asks a post's own share gate
 * (a recap or badge post whose shop or couple changed its mind is pulled, not scheduled).
 */
export async function handOffToFacebook(
  db: Db,
  now: Date,
  ops: FbOps,
  allowed: (row: QueueRow) => Promise<boolean> = async () => true,
): Promise<{ scheduled: string[]; failed: string[] }> {
  const out = { scheduled: [] as string[], failed: [] as string[] };
  const { data, error } = await db
    .from('social_posts')
    .select(QUEUE_ROW_SELECT)
    .eq('status', 'scheduled')
    .is('facebook_post_id', null)
    .gte('scheduled_for', new Date(now.getTime() + FB_SCHEDULE_MIN_LEAD_MS).toISOString())
    .lte('scheduled_for', new Date(now.getTime() + FB_HANDOFF_HORIZON_MS).toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(50);
  if (error) {
    logQueryError('fb-queue (hand-off scan)', error);
    return out;
  }

  for (const row of pickHandOffs((data ?? []) as QueueRow[], now)) {
    const stamp = new Date().toISOString();
    if (!(await allowed(row))) {
      const { error: pullErr } = await db
        .from('social_posts')
        .update({ status: 'pulled', updated_at: stamp })
        .eq('post_id', row.post_id)
        .eq('status', 'scheduled');
      if (pullErr) logQueryError('fb-queue (pull on closed gate)', pullErr, { post_id: row.post_id });
      continue;
    }
    // Claim: only the visit that flips scheduled → publishing hands this row over.
    const { data: claimed, error: claimErr } = await db
      .from('social_posts')
      .update({ status: 'publishing', updated_at: stamp })
      .eq('post_id', row.post_id)
      .eq('status', 'scheduled')
      .select('post_id');
    if (claimErr) {
      logQueryError('fb-queue (hand-off claim)', claimErr, { post_id: row.post_id });
      continue;
    }
    if (!claimed || claimed.length === 0) continue; // another visit is handing it over

    const at = new Date(row.scheduled_for as string);
    const res = await ops.schedule(row, at);
    const prior = facebookLeg(row);
    if (res.ok) {
      const { error: savedErr } = await db
        .from('social_posts')
        .update({
          status: 'scheduled_on_fb',
          facebook_post_id: res.externalId,
          platform_results: {
            ...(row.platform_results ?? {}),
            facebook: { status: 'scheduled_on_fb', external_id: res.externalId, handed_over_at: stamp, error: null },
          },
          updated_at: stamp,
        })
        .eq('post_id', row.post_id)
        .eq('status', 'publishing');
      // Facebook has it scheduled; a failed save here is logged loudly, because the row no longer knows its id.
      if (savedErr) logQueryError('fb-queue (save Facebook id)', savedErr, { post_id: row.post_id, facebook_post_id: res.externalId });
      out.scheduled.push(row.post_id);
    } else {
      const attempts = (typeof prior.schedule_attempts === 'number' ? prior.schedule_attempts : 0) + 1;
      const giveUp = attempts >= MAX_SCHEDULE_ATTEMPTS;
      const { error: backErr } = await db
        .from('social_posts')
        .update({
          status: giveUp ? 'failed' : 'scheduled',
          platform_results: {
            ...(row.platform_results ?? {}),
            facebook: { status: 'failed', external_id: null, posted_at: null, error: res.error, schedule_attempts: attempts },
          },
          updated_at: stamp,
        })
        .eq('post_id', row.post_id)
        .eq('status', 'publishing');
      if (backErr) logQueryError('fb-queue (record schedule failure)', backErr, { post_id: row.post_id });
      out.failed.push(row.post_id);
    }
  }
  return out;
}

/**
 * Take a post back from Facebook (delete it there) and return the row to `toStatus` — `scheduled` when the
 * autopublish or Facebook switch is turned off (it is handed over again once it is back on), `pulled` for a pull or
 * a take-down. If Facebook refuses the delete, the row is left as it is and the reason returned, so it is never
 * marked pulled while the post would still go out.
 */
export async function withdrawFromFacebook(
  db: Db,
  row: Pick<QueueRow, 'post_id' | 'facebook_post_id' | 'platform_results'>,
  ops: FbOps,
  toStatus: 'scheduled' | 'pulled',
): Promise<OpResult> {
  if (row.facebook_post_id) {
    const removed = await ops.remove(row.facebook_post_id);
    if (!removed.ok) return removed;
  }
  const { error } = await db
    .from('social_posts')
    .update({
      status: toStatus,
      facebook_post_id: null,
      platform_results: { ...(row.platform_results ?? {}), facebook: { status: 'withdrawn', withdrawn_at: new Date().toISOString() } },
      updated_at: new Date().toISOString(),
    })
    .eq('post_id', row.post_id)
    .eq('status', 'scheduled_on_fb');
  return error ? { ok: false, error: error.message ?? 'update failed' } : { ok: true };
}

/** With autopublish or Facebook off, every post still waiting on Facebook comes back to our queue. */
export async function withdrawAllFromFacebook(db: Db, now: Date, ops: FbOps): Promise<number> {
  const { data, error } = await db
    .from('social_posts')
    .select('post_id, facebook_post_id, platform_results, scheduled_for')
    .eq('status', 'scheduled_on_fb')
    .gte('scheduled_for', now.toISOString())
    .limit(200);
  if (error) {
    logQueryError('fb-queue (withdraw scan)', error);
    return 0;
  }
  let n = 0;
  for (const row of (data ?? []) as QueueRow[]) {
    const res = await withdrawFromFacebook(db, row, ops, 'scheduled');
    if (res.ok) n += 1;
    else console.warn(`[social] could not take post ${row.post_id} back from Facebook: ${res.error}`);
  }
  return n;
}

/** The admin's Pull: delete it on Facebook first when it is already there, then pull the row. */
export async function pullPost(db: Db, postId: string, ops: FbOps): Promise<OpResult> {
  const { data, error } = await db
    .from('social_posts')
    .select('post_id, status, facebook_post_id, platform_results')
    .eq('post_id', postId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message ?? 'read failed' };
  const row = data as Pick<QueueRow, 'post_id' | 'status' | 'facebook_post_id' | 'platform_results'> | null;
  if (!row) return { ok: false, error: 'Post not found.' };
  if (row.status === 'scheduled_on_fb') {
    const res = await withdrawFromFacebook(db, row, ops, 'pulled');
    return res.ok ? res : { ok: false, error: `Facebook did not delete the scheduled post (${res.error}); it is still scheduled there.` };
  }
  if (row.status !== 'scheduled' && row.status !== 'failed') {
    return { ok: false, error: 'Post is no longer pullable (already publishing or published).' };
  }
  const { data: done, error: upErr } = await db
    .from('social_posts')
    .update({ status: 'pulled', updated_at: new Date().toISOString() })
    .eq('post_id', postId)
    .in('status', ['scheduled', 'failed'])
    .select('post_id');
  if (upErr) return { ok: false, error: upErr.message ?? 'update failed' };
  return done && done.length > 0 ? { ok: true } : { ok: false, error: 'Post is no longer pullable (already publishing or published).' };
}

/** The admin's edit: on Facebook first when the post is already scheduled there, then on the row. */
export async function editPost(db: Db, postId: string, edit: { title: string; body: string }, ops: FbOps): Promise<OpResult> {
  const { data, error } = await db
    .from('social_posts')
    .select('post_id, status, facebook_post_id')
    .eq('post_id', postId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message ?? 'read failed' };
  const row = data as Pick<QueueRow, 'post_id' | 'status' | 'facebook_post_id'> | null;
  if (!row || (row.status !== 'scheduled' && row.status !== 'scheduled_on_fb')) {
    return { ok: false, error: 'Post is no longer editable (already publishing or published).' };
  }
  if (row.status === 'scheduled_on_fb' && row.facebook_post_id) {
    const res = await ops.editMessage(row.facebook_post_id, edit.body);
    if (!res.ok) return { ok: false, error: `Facebook did not take the edit (${res.error}); nothing was changed.` };
  }
  const { data: done, error: upErr } = await db
    .from('social_posts')
    .update({ title: edit.title, body: edit.body, updated_at: new Date().toISOString() })
    .eq('post_id', postId)
    .in('status', ['scheduled', 'scheduled_on_fb'])
    .select('post_id');
  if (upErr) return { ok: false, error: upErr.message ?? 'update failed' };
  return done && done.length > 0 ? { ok: true } : { ok: false, error: 'Post is no longer editable (already publishing or published).' };
}

/**
 * The first visit after a slot: ask Facebook whether each post waiting on it went out. Published → add the first
 * comment (it cannot be scheduled; "pin by hand", the Graph API cannot pin) and mark the row published. Not yet →
 * wait for the next visit, up to `SETTLE_GRACE_MS`, then fail it with the reason. Returns the rows it published so
 * the flush can run the other platforms' legs and the source stamps.
 */
export async function settleFacebookPosts(db: Db, now: Date, ops: FbOps): Promise<QueueRow[]> {
  const settled: QueueRow[] = [];
  const { data, error } = await db
    .from('social_posts')
    .select(QUEUE_ROW_SELECT)
    .eq('status', 'scheduled_on_fb')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(20);
  if (error) {
    logQueryError('fb-queue (settle scan)', error);
    return settled;
  }

  for (const row of (data ?? []) as QueueRow[]) {
    const fbId = row.facebook_post_id;
    const overdue = now.getTime() - ms(row.scheduled_for) > SETTLE_GRACE_MS;
    const check = fbId ? await ops.isPublished(fbId) : { ok: false as const, error: 'no Facebook post id on the row' };
    const stamp = new Date().toISOString();

    if (!check.ok || !check.published) {
      if (!overdue) continue; // Facebook can lag a few minutes; the next visit asks again.
      const { error: failErr } = await db
        .from('social_posts')
        .update({
          status: 'failed',
          platform_results: {
            ...(row.platform_results ?? {}),
            facebook: { ...facebookLeg(row), status: 'failed', error: check.ok ? 'Facebook had not published the scheduled post two hours after its slot.' : check.error },
          },
          updated_at: stamp,
        })
        .eq('post_id', row.post_id)
        .eq('status', 'scheduled_on_fb');
      if (failErr) logQueryError('fb-queue (fail unpublished post)', failErr, { post_id: row.post_id });
      continue;
    }

    // Claim it (scheduled_on_fb → publishing) so two visits settling at once never add the first comment twice.
    const { data: claimed, error: claimErr } = await db
      .from('social_posts')
      .update({ status: 'publishing', updated_at: stamp })
      .eq('post_id', row.post_id)
      .eq('status', 'scheduled_on_fb')
      .select('post_id');
    if (claimErr) logQueryError('fb-queue (settle claim)', claimErr, { post_id: row.post_id });
    if (!claimed || claimed.length === 0) continue;

    const leg: Record<string, unknown> = {
      status: 'published',
      external_id: fbId,
      post_url: `https://www.facebook.com/${fbId}`,
      posted_at: row.scheduled_for,
      error: null,
    };
    const firstComment = row.first_comment?.trim();
    if (firstComment && fbId) {
      const c = await ops.comment(fbId, firstComment);
      leg.first_comment = c.ok
        ? { status: 'posted', comment_id: c.commentId, pin: 'pin by hand', error: null }
        : { status: 'failed', comment_id: null, pin: 'pin by hand', error: c.error };
    }
    const { data: done, error: doneErr } = await db
      .from('social_posts')
      .update({ status: 'published', platform_results: { ...(row.platform_results ?? {}), facebook: leg }, updated_at: stamp })
      .eq('post_id', row.post_id)
      .eq('status', 'publishing')
      .select('post_id');
    if (doneErr) logQueryError('fb-queue (mark published)', doneErr, { post_id: row.post_id });
    if (done && done.length > 0) settled.push({ ...row, status: 'published', platform_results: { ...(row.platform_results ?? {}), facebook: leg } });
  }
  return settled;
}
