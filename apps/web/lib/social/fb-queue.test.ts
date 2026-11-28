/**
 * 📅 FACEBOOK HOLDS THE SCHEDULE, AND OUR QUEUE STAYS IN STEP WITH IT (owner, 28 Nov 2026: "schedule posts on Facebook
 * itself and stay cron-free"). Every rule of lib/social/fb-queue.ts, with a recording fake database and a fake
 * Facebook:
 *
 *   • hand-off — only slot posts 10 minutes to 7 days ahead, past every hold; claimed first, so two visits never
 *     schedule one post twice; Facebook's id stored and the row shown as scheduled_on_fb; a failure retried, then failed;
 *   • pull     — deleted on Facebook first; a refused delete changes nothing;
 *   • edit     — updated on Facebook first; a refused edit changes nothing;
 *   • switch   — with autopublish or Facebook off, every post waiting on Facebook comes back;
 *   • settle   — the first visit after the slot confirms it went out, adds the first comment ("pin by hand"), marks it
 *                published; claimed first, so the comment is never added twice.
 *
 * Sabotage (measured): dropping the hand-off claim turns "claimed first" red; updating the row before the Facebook
 * delete turns "pull" red; skipping the settle claim turns "comment once" red; the 7-day horizon at 30 days turns
 * "which posts go" red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeAdmin, type Answer, type Call } from './lane-s.fixture';
import {
  MAX_SCHEDULE_ATTEMPTS,
  editPost,
  handOffToFacebook,
  pickHandOffs,
  pullPost,
  settleFacebookPosts,
  withdrawAllFromFacebook,
  type FbOps,
  type QueueRow,
} from './fb-queue';

const ph = (s: string) => new Date(`${s}+08:00`);
const now = ph('2026-12-01T09:00:00');

function row(over: Partial<QueueRow> = {}): QueueRow {
  return {
    post_id: 'p1',
    source_type: 'library',
    source_ref: 'lib-1',
    title: 't',
    body: 'Hello',
    media_url: null,
    media_urls: null,
    link_url: null,
    publish_after: null,
    hold_until: null,
    scheduled_for: ph('2026-12-01T20:00:00').toISOString(),
    slot: 'evening',
    status: 'scheduled',
    first_comment: null,
    facebook_post_id: null,
    platform_results: {},
    ...over,
  };
}

function fakeFb(over: Partial<Record<keyof FbOps, unknown>> = {}) {
  const log: string[] = [];
  const ops: FbOps = {
    schedule: async (r, at) => {
      log.push(`schedule ${r.post_id} ${at.toISOString()}`);
      return (over.schedule as Awaited<ReturnType<FbOps['schedule']>>) ?? { ok: true, externalId: `fb_${r.post_id}` };
    },
    remove: async (id) => {
      log.push(`remove ${id}`);
      return (over.remove as Awaited<ReturnType<FbOps['remove']>>) ?? { ok: true };
    },
    editMessage: async (id, m) => {
      log.push(`edit ${id} ${m}`);
      return (over.editMessage as Awaited<ReturnType<FbOps['editMessage']>>) ?? { ok: true };
    },
    isPublished: async (id) => {
      log.push(`check ${id}`);
      return (over.isPublished as Awaited<ReturnType<FbOps['isPublished']>>) ?? { ok: true, published: true };
    },
    comment: async (id, m) => {
      log.push(`comment ${id} ${m}`);
      return (over.comment as Awaited<ReturnType<FbOps['comment']>>) ?? { ok: true, commentId: 'c1' };
    },
  };
  return { ops, log };
}

const updates = (calls: Call[]) => calls.filter((c) => c.action === 'update').map((c) => c.payload as Record<string, unknown>);
const has = (c: Call, op: string, col: string, val?: unknown) =>
  c.filters.some(([o, k, v]) => o === op && k === col && (val === undefined || JSON.stringify(v) === JSON.stringify(val)));

test('which posts go to Facebook: 10 minutes to 7 days ahead, on a slot not yet open, past every hold', () => {
  const ok = row();
  const picked = pickHandOffs(
    [
      ok,
      row({ post_id: 'too-soon', scheduled_for: ph('2026-12-01T09:05:00').toISOString(), slot: 'morning' }),
      row({ post_id: 'too-far', scheduled_for: ph('2026-12-09T08:00:00').toISOString(), slot: 'morning' }),
      row({ post_id: 'held', hold_until: ph('2026-12-01T10:00:00').toISOString() }),
      row({ post_id: 'gated', publish_after: ph('2026-12-02T00:00:00').toISOString() }),
      row({ post_id: 'already', facebook_post_id: 'fb_x' }),
      row({ post_id: 'on-fb', status: 'scheduled_on_fb' }),
      row({ post_id: 'off-slot', scheduled_for: ph('2026-12-01T19:00:00').toISOString() }),
      row({ post_id: 'day-7', scheduled_for: ph('2026-12-08T08:00:00').toISOString(), slot: 'morning' }),
    ],
    now,
  );
  assert.deepEqual(picked.map((r) => r.post_id), ['p1', 'day-7']);
});

function queueDb(rows: QueueRow[], opts: { claim?: boolean } = {}) {
  return fakeAdmin((call): Answer | undefined => {
    if (call.table !== 'social_posts') return undefined;
    if (call.action === 'select') return { data: rows };
    if (call.action === 'update' && (call.payload as { status?: string }).status === 'publishing') {
      return { data: opts.claim === false ? [] : [{ post_id: 'p1' }] };
    }
    if (call.action === 'update') return { data: [{ post_id: 'p1' }] };
    return undefined;
  });
}

test('hand-off: claimed first, scheduled for the slot, Facebook\'s id stored, shown as scheduled_on_fb', async () => {
  const { admin, calls } = queueDb([row()]);
  const fb = fakeFb();
  const res = await handOffToFacebook(admin, now, fb.ops);
  assert.deepEqual(res, { scheduled: ['p1'], failed: [] });
  assert.deepEqual(fb.log, [`schedule p1 ${ph('2026-12-01T20:00:00').toISOString()}`]);
  const [claim, done] = updates(calls);
  assert.equal(claim?.status, 'publishing');
  assert.equal(done?.status, 'scheduled_on_fb');
  assert.equal(done?.facebook_post_id, 'fb_p1');
  assert.equal((done?.platform_results as { facebook: { status: string } }).facebook.status, 'scheduled_on_fb');
  // The scan itself only asks for the 10-minute-to-7-day window.
  const scan = calls.find((c) => c.action === 'select');
  assert.ok(scan && has(scan, 'eq', 'status', 'scheduled') && has(scan, 'is', 'facebook_post_id', null));
});

test('hand-off: a visit that loses the claim never calls Facebook — one post is never scheduled twice', async () => {
  const { admin } = queueDb([row()], { claim: false });
  const fb = fakeFb();
  assert.deepEqual(await handOffToFacebook(admin, now, fb.ops), { scheduled: [], failed: [] });
  assert.deepEqual(fb.log, []);
});

test('hand-off: a refused schedule is retried on later visits, then fails with its reason', async () => {
  const fb = fakeFb({ schedule: { ok: false, error: 'Invalid image' } });
  const first = queueDb([row()]);
  await handOffToFacebook(first.admin, now, fb.ops);
  const back = updates(first.calls).at(-1)!;
  assert.equal(back.status, 'scheduled');
  assert.equal((back.platform_results as { facebook: { schedule_attempts: number } }).facebook.schedule_attempts, 1);

  const last = queueDb([row({ platform_results: { facebook: { schedule_attempts: MAX_SCHEDULE_ATTEMPTS - 1 } } })]);
  await handOffToFacebook(last.admin, now, fb.ops);
  const failed = updates(last.calls).at(-1)!;
  assert.equal(failed.status, 'failed');
  assert.match(JSON.stringify(failed.platform_results), /Invalid image/);
});

test('hand-off: a post whose share gate closed is pulled, and Facebook is never called', async () => {
  const { admin, calls } = queueDb([row({ source_type: 'supplier_badge' })]);
  const fb = fakeFb();
  await handOffToFacebook(admin, now, fb.ops, async () => false);
  assert.deepEqual(fb.log, []);
  assert.equal(updates(calls)[0]?.status, 'pulled');
});

function oneRowDb(r: Partial<QueueRow>) {
  return fakeAdmin((call): Answer | undefined => {
    if (call.action === 'select') return { data: { post_id: 'p1', platform_results: {}, ...r } };
    if (call.action === 'update') return { data: [{ post_id: 'p1' }] };
    return undefined;
  });
}

test('pull: a post on Facebook\'s schedule is deleted there FIRST, then pulled', async () => {
  const { admin, calls } = oneRowDb({ status: 'scheduled_on_fb', facebook_post_id: 'fb_1' });
  const fb = fakeFb();
  assert.deepEqual(await pullPost(admin, 'p1', fb.ops), { ok: true });
  assert.deepEqual(fb.log, ['remove fb_1']);
  const up = updates(calls)[0]!;
  assert.equal(up.status, 'pulled');
  assert.equal(up.facebook_post_id, null);
});

test('pull: if Facebook refuses the delete, nothing changes and the reason is shown', async () => {
  const { admin, calls } = oneRowDb({ status: 'scheduled_on_fb', facebook_post_id: 'fb_1' });
  const res = await pullPost(admin, 'p1', fakeFb({ remove: { ok: false, error: 'Permissions error' } }).ops);
  assert.equal(res.ok, false);
  assert.match(!res.ok ? res.error : '', /Permissions error.*still scheduled there/);
  assert.equal(updates(calls).length, 0);
});

test('pull: a post not yet on Facebook is pulled without calling Facebook', async () => {
  const { admin, calls } = oneRowDb({ status: 'scheduled', facebook_post_id: null });
  const fb = fakeFb();
  assert.deepEqual(await pullPost(admin, 'p1', fb.ops), { ok: true });
  assert.deepEqual(fb.log, []);
  assert.equal(updates(calls)[0]?.status, 'pulled');
});

test('edit: a post on Facebook\'s schedule is updated there FIRST; a refused edit changes nothing', async () => {
  const ok = oneRowDb({ status: 'scheduled_on_fb', facebook_post_id: 'fb_1' });
  const fb = fakeFb();
  assert.deepEqual(await editPost(ok.admin, 'p1', { title: 'T', body: 'New words' }, fb.ops), { ok: true });
  assert.deepEqual(fb.log, ['edit fb_1 New words']);
  assert.equal(updates(ok.calls)[0]?.body, 'New words');

  const refused = oneRowDb({ status: 'scheduled_on_fb', facebook_post_id: 'fb_1' });
  const res = await editPost(refused.admin, 'p1', { title: 'T', body: 'New' }, fakeFb({ editMessage: { ok: false, error: 'nope' } }).ops);
  assert.equal(res.ok, false);
  assert.equal(updates(refused.calls).length, 0);

  const published = oneRowDb({ status: 'published', facebook_post_id: 'fb_1' });
  assert.equal((await editPost(published.admin, 'p1', { title: 'T', body: 'x' }, fakeFb().ops)).ok, false);
});

test('switch off: every post waiting on Facebook is taken back to our queue', async () => {
  const waiting = [row({ post_id: 'a', status: 'scheduled_on_fb', facebook_post_id: 'fb_a' }), row({ post_id: 'b', status: 'scheduled_on_fb', facebook_post_id: 'fb_b' })];
  const { admin, calls } = fakeAdmin((call) => (call.action === 'select' ? { data: waiting } : { data: [] }));
  const fb = fakeFb();
  assert.equal(await withdrawAllFromFacebook(admin, now, fb.ops), 2);
  assert.deepEqual(fb.log, ['remove fb_a', 'remove fb_b']);
  assert.deepEqual(updates(calls).map((u) => [u.status, u.facebook_post_id]), [['scheduled', null], ['scheduled', null]]);
});

function settleDb(r: QueueRow, opts: { claim?: boolean } = {}) {
  return fakeAdmin((call): Answer | undefined => {
    if (call.action === 'select') return { data: [r] };
    if (call.action === 'update' && (call.payload as { status?: string }).status === 'publishing') {
      return { data: opts.claim === false ? [] : [{ post_id: r.post_id }] };
    }
    if (call.action === 'update') return { data: [{ post_id: r.post_id }] };
    return undefined;
  });
}

const due = row({ status: 'scheduled_on_fb', facebook_post_id: 'fb_1', scheduled_for: ph('2026-12-01T08:00:00').toISOString(), slot: 'morning', first_comment: 'Plan free at setnayan.com' });

test('settle: after the slot, the first comment is added ("pin by hand") and the row is published', async () => {
  const { admin, calls } = settleDb(due);
  const fb = fakeFb();
  const settled = await settleFacebookPosts(admin, ph('2026-12-01T08:20:00'), fb.ops);
  assert.deepEqual(settled.map((r) => r.post_id), ['p1']);
  assert.deepEqual(fb.log, ['check fb_1', 'comment fb_1 Plan free at setnayan.com']);
  const last = updates(calls).at(-1)!;
  assert.equal(last.status, 'published');
  const leg = (last.platform_results as { facebook: Record<string, unknown> }).facebook;
  assert.equal(leg.status, 'published');
  assert.deepEqual(leg.first_comment, { status: 'posted', comment_id: 'c1', pin: 'pin by hand', error: null });
});

test('settle: a visit that loses the claim never comments — the first comment is added once', async () => {
  const { admin } = settleDb(due, { claim: false });
  const fb = fakeFb();
  assert.deepEqual(await settleFacebookPosts(admin, ph('2026-12-01T08:20:00'), fb.ops), []);
  assert.deepEqual(fb.log, ['check fb_1']);
});

test('settle: not yet published waits for the next visit; two hours late it fails with the reason', async () => {
  const fb = fakeFb({ isPublished: { ok: true, published: false } });
  const early = settleDb(due);
  assert.deepEqual(await settleFacebookPosts(early.admin, ph('2026-12-01T08:20:00'), fb.ops), []);
  assert.equal(updates(early.calls).length, 0);
  const late = settleDb(due);
  await settleFacebookPosts(late.admin, ph('2026-12-01T10:30:00'), fb.ops);
  assert.equal(updates(late.calls)[0]?.status, 'failed');
  assert.match(JSON.stringify(updates(late.calls)[0]), /had not published/);
});
