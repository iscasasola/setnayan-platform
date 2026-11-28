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
  /** `deadline` (epoch ms): start no further Graph call for this post past it. */
  schedule(row: QueueRow, at: Date, opts?: { deadline?: number }): Promise<{ ok: true; externalId: string } | { ok: false; error: string }>;
  remove(fbPostId: string): Promise<OpResult>;
  editMessage(fbPostId: string, message: string): Promise<OpResult>;
  isPublished(fbPostId: string): Promise<{ ok: true; published: boolean } | { ok: false; error: string }>;
  comment(fbPostId: string, message: string): Promise<{ ok: true; commentId: string } | { ok: false; error: string }>;
  /**
   * The Page's posts still waiting on Facebook's clock (GET /{page-id}/scheduled_posts). `complete` is false when
   * more pages were left unread: a no-match is then not proof the post is absent.
   */
  listScheduled(): Promise<{ ok: true; posts: FbScheduledPost[]; complete: boolean } | { ok: false; error: string }>;
};

/** One post waiting on Facebook's clock: its id, text and time (Unix seconds). */
export type FbScheduledPost = { id: string; message: string | null; scheduledAt: number | null };

/** The slice of the Supabase client used here (structural, so the recording fake in tests fits). */
export type Db = { from(table: string): any };

/** A schedule that keeps failing stops retrying on every visit and fails with its reason. */
export const MAX_SCHEDULE_ATTEMPTS = 3;
/** How long after its slot a post may still be unconfirmed before it is called failed. */
export const SETTLE_GRACE_MS = 2 * 60 * 60 * 1000;

/** At most this many posts are handed to Facebook in one flush, inside this much time: a flush runs in `after()`. */
export const MAX_HANDOFFS_PER_FLUSH = 5;
export const HANDOFF_BUDGET_MS = 60_000;
/** A hand-off still `publishing` this long after its claim was cut off (a lost save, or `after()` killed). */
export const HANDOFF_STUCK_MS = 10 * 60 * 1000;

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Find a row's post among the Page's scheduled posts. Facebook keeps no id of ours on a post, so the marker is the
 * pair we sent: the exact slot second (`scheduled_publish_time`; one post per slot is a database rule) AND the
 * post's own text (its first 80 characters, whitespace-folded). Two matches are never guessed between.
 */
export function matchScheduledPost(
  row: Pick<QueueRow, 'scheduled_for' | 'body'>,
  posts: readonly FbScheduledPost[],
): { kind: 'found'; id: string } | { kind: 'none' } | { kind: 'ambiguous'; ids: string[] } {
  const at = Math.floor(ms(row.scheduled_for) / 1000);
  const key = norm(row.body).slice(0, 80);
  const hits = posts.filter((p) => p.scheduledAt === at && key.length > 0 && norm(p.message ?? '').includes(key));
  if (hits.length === 1 && hits[0]) return { kind: 'found', id: hits[0].id };
  if (hits.length === 0) return { kind: 'none' };
  return { kind: 'ambiguous', ids: hits.map((h) => h.id) };
}

/** A row this module claimed for a hand-off: `publishing` with the hand-off stamp, and no Facebook id yet. */
export function isUnconfirmedHandOff(row: Pick<QueueRow, 'status' | 'facebook_post_id' | 'platform_results'>): boolean {
  return row.status === 'publishing' && !row.facebook_post_id && typeof facebookLeg(row).handoff_started_at === 'string';
}

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

function facebookLeg(row: Pick<QueueRow, 'platform_results'>): Record<string, unknown> {
  const fb = row.platform_results?.facebook;
  return fb && typeof fb === 'object' ? (fb as Record<string, unknown>) : {};
}

/**
 * Store Facebook's id on a claimed row: it is now waiting on Facebook's clock. When the save matches NO row (the row
 * left `publishing` meanwhile — pulled, or taken down), the post must not go out: it is deleted on Facebook at once,
 * and if that fails the row is marked for the manual take-down lane. A save that ERRORS keeps the post (recovery
 * finds its id later).
 */
async function saveScheduled(db: Db, row: QueueRow, externalId: string, stamp: string, how: string, ops: FbOps): Promise<boolean> {
  const { data, error } = await db
    .from('social_posts')
    .update({
      status: 'scheduled_on_fb',
      facebook_post_id: externalId,
      platform_results: {
        ...(row.platform_results ?? {}),
        facebook: { status: 'scheduled_on_fb', external_id: externalId, handed_over_at: stamp, confirmed_by: how, error: null },
      },
      updated_at: stamp,
    })
    .eq('post_id', row.post_id)
    .eq('status', 'publishing')
    .select('post_id');
  // Facebook has it scheduled; a failed save is logged loudly and the stuck-hand-off recovery finds its id later.
  if (error) {
    logQueryError('fb-queue (save Facebook id)', error, { post_id: row.post_id, facebook_post_id: externalId });
    return false;
  }
  if (Array.isArray(data) && data.length > 0) return true;
  // Already holding this very id (another path saved it first)? Then nothing is wrong.
  const { data: now, error: readErr } = await db
    .from('social_posts')
    .select('status, facebook_post_id')
    .eq('post_id', row.post_id)
    .maybeSingle();
  if (readErr) logQueryError('fb-queue (re-read after empty save)', readErr, { post_id: row.post_id });
  const held = now as { status?: string; facebook_post_id?: string | null } | null;
  if (held && held.facebook_post_id === externalId) return false;
  const removed = await ops.remove(externalId);
  if (!removed.ok) {
    console.error(`[social] post ${row.post_id} was pulled while Facebook took it (${externalId}) and the delete failed: ${removed.error}`);
    const { error: markErr } = await db
      .from('social_posts')
      .update({
        platform_results: {
          ...(row.platform_results ?? {}),
          facebook: { status: 'takedown_needed', external_id: externalId, error: `Delete on Facebook failed: ${removed.error}`, at: stamp },
        },
        updated_at: stamp,
      })
      .eq('post_id', row.post_id);
    if (markErr) logQueryError('fb-queue (mark for manual take-down)', markErr, { post_id: row.post_id, facebook_post_id: externalId });
  }
  return false;
}

/** Fail a claimed row with a reason, without retrying (retrying could post it twice). */
async function failHandOff(db: Db, row: QueueRow, reason: string, extra: Record<string, unknown> = {}): Promise<void> {
  const { error } = await db
    .from('social_posts')
    .update({
      status: 'failed',
      platform_results: {
        ...(row.platform_results ?? {}),
        facebook: { ...facebookLeg(row), status: 'failed', external_id: null, posted_at: null, error: reason, ...extra },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('post_id', row.post_id)
    .eq('status', 'publishing');
  if (error) logQueryError('fb-queue (fail hand-off)', error, { post_id: row.post_id });
}

const AMBIGUOUS = 'Facebook holds more than one scheduled post at this time with this text; check the Page before retrying.';
const UNSURE = 'The Page has more scheduled posts than one read covers, so this hand-off could not be confirmed; check the Page before retrying.';
/** Shown when a Pull or take-down meets a hand-off that may still be in flight. */
export const HANDING_OVER_MESSAGE = 'Being handed to Facebook — try again in a few minutes.';

/**
 * Hand the next ~7 days of slot posts to Facebook. Each row is CLAIMED first (scheduled → publishing, conditional,
 * stamped `handoff_started_at`), so two overlapping visits can never schedule the same post twice. `allowed` re-asks a
 * post's own share gate (a recap or badge post whose shop or couple changed its mind is pulled, not scheduled).
 *
 * A refused or timed-out schedule may still have been accepted by Facebook, so before ANY retry the Page's scheduled
 * posts are read (`matchScheduledPost`): a post already there is adopted, never scheduled again. When that read
 * fails too, the row stays claimed for `recoverStuckHandOffs`. At most `MAX_HANDOFFS_PER_FLUSH` rows, inside
 * `HANDOFF_BUDGET_MS`, per flush.
 */
export async function handOffToFacebook(
  db: Db,
  now: Date,
  ops: FbOps,
  allowed: (row: QueueRow) => Promise<boolean> = async () => true,
  limits: { maxRows?: number; budgetMs?: number; clock?: () => number } = {},
): Promise<{ scheduled: string[]; failed: string[] }> {
  const out = { scheduled: [] as string[], failed: [] as string[] };
  const maxRows = limits.maxRows ?? MAX_HANDOFFS_PER_FLUSH;
  const budgetMs = limits.budgetMs ?? HANDOFF_BUDGET_MS;
  const clock = limits.clock ?? Date.now;
  const started = clock();
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

  let tried = 0;
  const overBudget = () => clock() - started >= budgetMs;
  for (const picked of pickHandOffs((data ?? []) as QueueRow[], now)) {
    if (tried >= maxRows || overBudget()) break; // the rest go on the next visit
    tried += 1;
    const stamp = new Date().toISOString();
    if (!(await allowed(picked))) {
      const { error: pullErr } = await db
        .from('social_posts')
        .update({ status: 'pulled', updated_at: stamp })
        .eq('post_id', picked.post_id)
        .eq('status', 'scheduled');
      if (pullErr) logQueryError('fb-queue (pull on closed gate)', pullErr, { post_id: picked.post_id });
      continue;
    }
    const prior = facebookLeg(picked);
    // The hand-off stamp is what lets a cut-off hand-off be found and reconciled later.
    const row: QueueRow = {
      ...picked,
      status: 'publishing',
      platform_results: { ...(picked.platform_results ?? {}), facebook: { ...prior, status: 'handing_off', handoff_started_at: stamp } },
    };
    // Claim: only the visit that flips scheduled → publishing hands this row over.
    const { data: claimed, error: claimErr } = await db
      .from('social_posts')
      .update({ status: 'publishing', platform_results: row.platform_results, updated_at: stamp })
      .eq('post_id', row.post_id)
      .eq('status', 'scheduled')
      .select('post_id');
    if (claimErr) {
      logQueryError('fb-queue (hand-off claim)', claimErr, { post_id: row.post_id });
      continue;
    }
    if (!claimed || claimed.length === 0) continue; // another visit is handing it over

    const attemptsSoFar = typeof prior.schedule_attempts === 'number' ? prior.schedule_attempts : 0;
    // A post that failed before may have been accepted after all (a timeout): look before scheduling it again.
    if (attemptsSoFar > 0) {
      const listed = await ops.listScheduled();
      if (!listed.ok) {
        const { error: relErr } = await db
          .from('social_posts')
          .update({ status: 'scheduled', platform_results: picked.platform_results, updated_at: stamp })
          .eq('post_id', row.post_id)
          .eq('status', 'publishing');
        if (relErr) logQueryError('fb-queue (release unverified retry)', relErr, { post_id: row.post_id });
        out.failed.push(row.post_id);
        continue;
      }
      const found = matchScheduledPost(row, listed.posts);
      if (found.kind === 'found') {
        await saveScheduled(db, row, found.id, stamp, 'found on the Page before a retry', ops);
        out.scheduled.push(row.post_id);
        continue;
      }
      if (found.kind === 'ambiguous' || !listed.complete) {
        await failHandOff(db, row, found.kind === 'ambiguous' ? AMBIGUOUS : UNSURE, found.kind === 'ambiguous' ? { candidates: found.ids } : {});
        out.failed.push(row.post_id);
        continue;
      }
    }

    if (overBudget()) {
      // No Graph call has been made for this row in this visit: give it back to the queue for the next one.
      const { error: relErr } = await db
        .from('social_posts')
        .update({ status: 'scheduled', platform_results: picked.platform_results, updated_at: stamp })
        .eq('post_id', row.post_id)
        .eq('status', 'publishing');
      if (relErr) logQueryError('fb-queue (release over budget)', relErr, { post_id: row.post_id });
      break;
    }
    const at = new Date(row.scheduled_for as string);
    const res = await ops.schedule(row, at, { deadline: started + budgetMs });
    if (res.ok) {
      await saveScheduled(db, row, res.externalId, stamp, 'schedule call', ops);
      out.scheduled.push(row.post_id);
      continue;
    }

    // Refused or timed out: Facebook may still have taken it. Never retry before looking — and past the budget, not
    // even look: the row stays claimed and `recoverStuckHandOffs` settles it on a later visit.
    if (overBudget()) {
      out.failed.push(row.post_id);
      break;
    }
    const listed = await ops.listScheduled();
    if (!listed.ok) {
      // We cannot tell; the row stays claimed and `recoverStuckHandOffs` settles it on a later visit.
      console.warn(`[social] post ${row.post_id}: schedule failed (${res.error}) and the Page could not be read (${listed.error}); left for recovery`);
      out.failed.push(row.post_id);
      continue;
    }
    const found = matchScheduledPost(row, listed.posts);
    if (found.kind === 'found') {
      await saveScheduled(db, row, found.id, stamp, 'found on the Page after a failed call', ops);
      out.scheduled.push(row.post_id);
      continue;
    }
    if (found.kind === 'ambiguous' || !listed.complete) {
      await failHandOff(db, row, found.kind === 'ambiguous' ? AMBIGUOUS : UNSURE, found.kind === 'ambiguous' ? { candidates: found.ids } : {});
      out.failed.push(row.post_id);
      continue;
    }
    const attempts = attemptsSoFar + 1;
    const giveUp = attempts >= MAX_SCHEDULE_ATTEMPTS;
    const { error: backErr } = await db
      .from('social_posts')
      .update({
        status: giveUp ? 'failed' : 'scheduled',
        platform_results: {
          ...(picked.platform_results ?? {}),
          facebook: { status: 'failed', external_id: null, posted_at: null, error: res.error, schedule_attempts: attempts },
        },
        updated_at: stamp,
      })
      .eq('post_id', row.post_id)
      .eq('status', 'publishing');
    if (backErr) logQueryError('fb-queue (record schedule failure)', backErr, { post_id: row.post_id });
    out.failed.push(row.post_id);
  }
  return out;
}

/**
 * A hand-off cut off after its claim — Facebook's id never saved (a failed save, or `after()` killed between the
 * schedule call and the save), or a failed call whose answer could not be checked. After `HANDOFF_STUCK_MS`, each is
 * reconciled against the Page's scheduled posts: found → its id is stored and it is `scheduled_on_fb`; not there and
 * its slot still ahead → back to `scheduled` (Facebook does not hold it, so it is handed over again); not there and
 * the slot passed, or two candidates → `failed` with the reason (it may have gone out; a person checks the Page).
 */
export async function recoverStuckHandOffs(db: Db, now: Date, ops: FbOps): Promise<{ adopted: string[]; requeued: string[]; failed: string[] }> {
  const out = { adopted: [] as string[], requeued: [] as string[], failed: [] as string[] };
  const { data, error } = await db
    .from('social_posts')
    .select(`${QUEUE_ROW_SELECT}, updated_at`)
    .eq('status', 'publishing')
    .is('facebook_post_id', null)
    .lt('updated_at', new Date(now.getTime() - HANDOFF_STUCK_MS).toISOString())
    .order('updated_at', { ascending: true })
    .limit(20);
  if (error) {
    logQueryError('fb-queue (stuck hand-off scan)', error);
    return out;
  }
  const stuck = ((data ?? []) as QueueRow[]).filter(isUnconfirmedHandOff);
  if (stuck.length === 0) return out;
  const listed = await ops.listScheduled();
  if (!listed.ok) {
    console.warn(`[social] could not read the Page's scheduled posts to recover ${stuck.length} hand-off(s): ${listed.error}`);
    return out;
  }
  for (const row of stuck) {
    const stamp = new Date().toISOString();
    const found = matchScheduledPost(row, listed.posts);
    if (found.kind === 'found') {
      if (await saveScheduled(db, row, found.id, stamp, 'recovered from the Page', ops)) out.adopted.push(row.post_id);
      continue;
    }
    if (found.kind === 'none' && listed.complete && ms(row.scheduled_for) > now.getTime()) {
      const { error: backErr } = await db
        .from('social_posts')
        .update({
          status: 'scheduled',
          platform_results: { ...(row.platform_results ?? {}), facebook: { ...facebookLeg(row), status: 'requeued', handoff_started_at: null } },
          updated_at: stamp,
        })
        .eq('post_id', row.post_id)
        .eq('status', 'publishing');
      if (backErr) logQueryError('fb-queue (requeue stuck hand-off)', backErr, { post_id: row.post_id });
      else out.requeued.push(row.post_id);
      continue;
    }
    await failHandOff(
      db,
      row,
      found.kind === 'ambiguous'
        ? AMBIGUOUS
        : !listed.complete
          ? UNSURE
          : 'The hand-off to Facebook was never confirmed and the slot has passed; check the Page before posting it again.',
      found.kind === 'ambiguous' ? { candidates: found.ids } : {},
    );
    out.failed.push(row.post_id);
  }
  return out;
}

/**
 * Take back a claimed hand-off whose Facebook id is not known (a pull or a couple's take-down): find it on the Page,
 * delete it there, and only then move the row to `toStatus`. If the Page cannot be read, the delete is refused, or
 * two candidates match, the row is left claimed — its slot is not freed while the post could still go out.
 */
export async function takeBackUnconfirmedHandOff(
  db: Db,
  row: Pick<QueueRow, 'post_id' | 'status' | 'facebook_post_id' | 'platform_results' | 'scheduled_for' | 'body'>,
  ops: FbOps,
  toStatus: 'pulled',
  now: Date = new Date(),
): Promise<OpResult> {
  // A hand-off claimed moments ago may have its schedule call in flight: freeing the row now would let the post go
  // out after being pulled. Only a hand-off older than HANDOFF_STUCK_MS is taken back.
  const startedAt = ms((facebookLeg(row).handoff_started_at as string | undefined) ?? null);
  if (!Number.isFinite(startedAt) || now.getTime() - startedAt < HANDOFF_STUCK_MS) return { ok: false, error: HANDING_OVER_MESSAGE };
  const listed = await ops.listScheduled();
  if (!listed.ok) return { ok: false, error: `could not read the Page's scheduled posts (${listed.error})` };
  const found = matchScheduledPost(row, listed.posts);
  if (found.kind === 'ambiguous') return { ok: false, error: AMBIGUOUS };
  if (found.kind === 'none' && !listed.complete) return { ok: false, error: UNSURE };
  if (found.kind === 'found') {
    const removed = await ops.remove(found.id);
    if (!removed.ok) return removed;
  }
  const { data, error } = await db
    .from('social_posts')
    .update({
      status: toStatus,
      platform_results: { ...(row.platform_results ?? {}), facebook: { status: 'withdrawn', withdrawn_at: new Date().toISOString() } },
      updated_at: new Date().toISOString(),
    })
    .eq('post_id', row.post_id)
    .eq('status', 'publishing')
    .is('facebook_post_id', null)
    .select('post_id');
  if (error) return { ok: false, error: error.message ?? 'update failed' };
  return data && data.length > 0 ? { ok: true } : { ok: false, error: 'The post changed while it was being taken back; try again.' };
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
export async function pullPost(db: Db, postId: string, ops: FbOps, now: Date = new Date()): Promise<OpResult> {
  const { data, error } = await db
    .from('social_posts')
    .select('post_id, status, facebook_post_id, platform_results, scheduled_for, body')
    .eq('post_id', postId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message ?? 'read failed' };
  const row = data as Pick<QueueRow, 'post_id' | 'status' | 'facebook_post_id' | 'platform_results' | 'scheduled_for' | 'body'> | null;
  if (!row) return { ok: false, error: 'Post not found.' };
  if (isUnconfirmedHandOff(row)) {
    // Handed over but its Facebook id never saved: find it on the Page and delete it there first.
    const res = await takeBackUnconfirmedHandOff(db, row, ops, 'pulled', now);
    if (res.ok || res.error === HANDING_OVER_MESSAGE) return res;
    return { ok: false, error: `Facebook may still hold this post (${res.error}); it was not pulled.` };
  }
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

/**
 * A couple revoked consent: take each of their unsent posts down, Facebook first.
 *   • on Facebook's schedule → deleted there, then pulled (`withdrawFromFacebook`);
 *   • handed over with its id unknown → found on the Page, deleted, then pulled (`takeBackUnconfirmedHandOff`);
 *   • still only in our queue → pulled;
 *   • `publishing` without a hand-off stamp is a post being sent right now: left alone, and the manual take-down lane
 *     in the admin queue handles it once it is out.
 * A row whose Facebook side is not clear is left as it is, so its slot is not freed while the post could still go out.
 */
export async function takeDownRevoked(
  db: Db,
  rows: ReadonlyArray<Pick<QueueRow, 'post_id' | 'status' | 'facebook_post_id' | 'platform_results' | 'scheduled_for' | 'body'>>,
  ops: FbOps,
  now: Date = new Date(),
): Promise<{ pulled: string[]; left: string[] }> {
  const out = { pulled: [] as string[], left: [] as string[] };
  for (const row of rows) {
    let res: OpResult;
    if (row.status === 'scheduled_on_fb') {
      res = await withdrawFromFacebook(db, row, ops, 'pulled');
    } else if (isUnconfirmedHandOff(row)) {
      res = await takeBackUnconfirmedHandOff(db, row, ops, 'pulled', now);
    } else if (row.status === 'scheduled') {
      const { data, error } = await db
        .from('social_posts')
        .update({ status: 'pulled', updated_at: new Date().toISOString() })
        .eq('post_id', row.post_id)
        .eq('status', 'scheduled')
        .select('post_id');
      res = error ? { ok: false, error: error.message ?? 'update failed' } : data && data.length > 0 ? { ok: true } : { ok: false, error: 'changed meanwhile' };
    } else {
      res = { ok: false, error: 'being sent right now; the manual take-down lane handles it' };
    }
    if (res.ok) out.pulled.push(row.post_id);
    else {
      out.left.push(row.post_id);
      console.warn(`[social] take-down of post ${row.post_id} waits: ${res.error}`);
    }
  }
  return out;
}
