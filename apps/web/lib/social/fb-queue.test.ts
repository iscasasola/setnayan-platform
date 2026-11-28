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
  HANDING_OVER_MESSAGE,
  HANDOFF_STUCK_MS,
  MAX_HANDOFFS_PER_FLUSH,
  MAX_SCHEDULE_ATTEMPTS,
  editPost,
  handOffToFacebook,
  matchScheduledPost,
  recoverStuckHandOffs,
  takeDownRevoked,
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
    listScheduled: async () => {
      log.push('list');
      return (over.listScheduled as Awaited<ReturnType<FbOps['listScheduled']>>) ?? { ok: true, posts: [], complete: true };
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
  assert.deepEqual(await pullPost(admin, 'p1', fb.ops, now), { ok: true });
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
  assert.deepEqual(await pullPost(admin, 'p1', fb.ops, now), { ok: true });
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

// ── Cut-off hand-offs, timeouts, take-downs and the time budget (controller review, 28 Nov) ─────────────────────

const slotSec = Math.floor(ph('2026-12-01T20:00:00').getTime() / 1000);
const onPage = (id: string, message = 'Hello', at = slotSec) => ({ id, message, scheduledAt: at });
const handingOff = { facebook: { status: 'handing_off', handoff_started_at: ph('2026-12-01T08:30:00').toISOString() } };

test('the marker: the slot second AND the post text find it; another time or text does not; two are never guessed', () => {
  const r = row({ body: 'Hello   world' });
  assert.deepEqual(matchScheduledPost(r, [onPage('a', 'Hello world'), onPage('b', 'Hello world', slotSec + 60)]), { kind: 'found', id: 'a' });
  assert.deepEqual(matchScheduledPost(r, [onPage('c', 'Other text')]), { kind: 'none' });
  assert.equal(matchScheduledPost(r, [onPage('a', 'Hello world'), onPage('d', 'Hello world')]).kind, 'ambiguous');
});

test('timeout: a schedule that timed out but WAS accepted is found on the Page and adopted — never scheduled again', async () => {
  const { admin, calls } = queueDb([row()]);
  const fb = fakeFb({
    schedule: { ok: false, error: 'Graph API call timed out after 15s.' },
    listScheduled: { ok: true, posts: [onPage('fb_late')], complete: true },
  });
  const res = await handOffToFacebook(admin, now, fb.ops);
  assert.deepEqual(res.scheduled, ['p1']);
  assert.deepEqual(fb.log.map((l) => l.split(' ')[0]), ['schedule', 'list']);
  const saved = updates(calls).at(-1)!;
  assert.equal(saved.status, 'scheduled_on_fb');
  assert.equal(saved.facebook_post_id, 'fb_late');
});

test('timeout: when the Page cannot be read either, the row stays claimed for recovery — no retry, no requeue', async () => {
  const { admin, calls } = queueDb([row()]);
  const fb = fakeFb({ schedule: { ok: false, error: 'timed out' }, listScheduled: { ok: false, error: 'timed out' } });
  await handOffToFacebook(admin, now, fb.ops);
  const ups = updates(calls);
  assert.equal(ups.length, 1, 'only the claim');
  assert.equal(ups[0]?.status, 'publishing');
  assert.equal(typeof (ups[0]?.platform_results as typeof handingOff).facebook.handoff_started_at, 'string');
});

test('retry: a post that failed before is looked for on the Page BEFORE it is scheduled again', async () => {
  const { admin, calls } = queueDb([row({ platform_results: { facebook: { schedule_attempts: 1 } } })]);
  const fb = fakeFb({ listScheduled: { ok: true, posts: [onPage('fb_first_try')], complete: true } });
  await handOffToFacebook(admin, now, fb.ops);
  assert.deepEqual(fb.log, ['list'], 'found on the Page, so never scheduled a second time');
  assert.equal(updates(calls).at(-1)?.facebook_post_id, 'fb_first_try');

  const unread = queueDb([row({ platform_results: { facebook: { schedule_attempts: 1 } } })]);
  const fb2 = fakeFb({ listScheduled: { ok: false, error: 'down' } });
  await handOffToFacebook(unread.admin, now, fb2.ops);
  assert.deepEqual(fb2.log, ['list'], 'an unreadable Page means no retry this visit');
  assert.equal(updates(unread.calls).at(-1)?.status, 'scheduled');
});

test('budget: at most 5 posts per flush, and none once the time budget is spent', async () => {
  const many = Array.from({ length: 8 }, (_, i) =>
    row({ post_id: `p${i}`, scheduled_for: ph(`2026-12-0${2 + Math.floor(i / 3)}T${['08', '14', '20'][i % 3]}:00:00`).toISOString(), slot: ['morning', 'afternoon', 'evening'][i % 3]! }),
  );
  const fb = fakeFb();
  await handOffToFacebook(queueDb(many).admin, now, fb.ops);
  assert.equal(fb.log.filter((l) => l.startsWith('schedule')).length, MAX_HANDOFFS_PER_FLUSH);

  let t = 0;
  const fb2 = fakeFb();
  await handOffToFacebook(queueDb(many).admin, now, fb2.ops, async () => true, { clock: () => (t += 30_000) });
  assert.ok(fb2.log.filter((l) => l.startsWith('schedule')).length < MAX_HANDOFFS_PER_FLUSH, 'the 60 s budget stops the loop');
});

function stuckDb(rows: QueueRow[]) {
  return fakeAdmin((call): Answer | undefined => {
    if (call.action === 'select') return { data: rows };
    if (call.action === 'update') return { data: [{ post_id: 'p1' }] };
    return undefined;
  });
}

test('recovery: a hand-off whose id was never saved gets its id from the Page; one not there goes back to the queue', async () => {
  const stuck = row({ status: 'publishing', platform_results: handingOff });
  const found = stuckDb([stuck]);
  const r1 = await recoverStuckHandOffs(found.admin, now, fakeFb({ listScheduled: { ok: true, posts: [onPage('fb_lost')], complete: true } }).ops);
  assert.deepEqual(r1.adopted, ['p1']);
  assert.equal(updates(found.calls)[0]?.status, 'scheduled_on_fb');
  assert.equal(updates(found.calls)[0]?.facebook_post_id, 'fb_lost');
  const scan = found.calls.find((c) => c.action === 'select')!;
  assert.ok(has(scan, 'eq', 'status', 'publishing') && has(scan, 'is', 'facebook_post_id', null));
  assert.ok(scan.filters.some(([o, k, v]) => o === 'lt' && k === 'updated_at' && v === new Date(now.getTime() - HANDOFF_STUCK_MS).toISOString()));

  const missing = stuckDb([stuck]);
  const r2 = await recoverStuckHandOffs(missing.admin, now, fakeFb().ops);
  assert.deepEqual(r2.requeued, ['p1']);
  assert.equal(updates(missing.calls)[0]?.status, 'scheduled');
});

test('recovery: not on the Page after its slot passed → failed with the reason, never re-posted; a direct send is ignored', async () => {
  const past = row({ status: 'publishing', platform_results: handingOff, scheduled_for: ph('2026-12-01T08:00:00').toISOString(), slot: 'morning' });
  const { admin, calls } = stuckDb([past, row({ post_id: 'direct', status: 'publishing', platform_results: {} })]);
  const res = await recoverStuckHandOffs(admin, now, fakeFb().ops);
  assert.deepEqual(res.failed, ['p1']);
  assert.equal(updates(calls).length, 1, 'the direct send (no hand-off stamp) is left alone');
  assert.match(JSON.stringify(updates(calls)[0]?.platform_results), /check the Page/);
});

test('pull: an unconfirmed hand-off is found on the Page and deleted there before it is pulled', async () => {
  const { admin, calls } = oneRowDb({ status: 'publishing', facebook_post_id: null, platform_results: handingOff, scheduled_for: row().scheduled_for, body: 'Hello' });
  const fb = fakeFb({ listScheduled: { ok: true, posts: [onPage('fb_lost')], complete: true } });
  assert.deepEqual(await pullPost(admin, 'p1', fb.ops, now), { ok: true });
  assert.deepEqual(fb.log, ['list', 'remove fb_lost']);
  assert.equal(updates(calls)[0]?.status, 'pulled');

  const unread = oneRowDb({ status: 'publishing', facebook_post_id: null, platform_results: handingOff, scheduled_for: row().scheduled_for, body: 'Hello' });
  const res = await pullPost(unread.admin, 'p1', fakeFb({ listScheduled: { ok: false, error: 'down' } }).ops, now);
  assert.equal(res.ok, false);
  assert.equal(updates(unread.calls).length, 0, 'not pulled while Facebook may still hold it');
});

test('take-down: Facebook first for every row; a row whose Facebook side is unclear keeps its slot', async () => {
  const { admin, calls } = stuckDb([]);
  const fb = fakeFb({ listScheduled: { ok: true, posts: [onPage('fb_lost')], complete: true } });
  const res = await takeDownRevoked(
    admin,
    [
      row({ post_id: 'on-fb', status: 'scheduled_on_fb', facebook_post_id: 'fb_1' }),
      row({ post_id: 'cut-off', status: 'publishing', platform_results: handingOff }),
      row({ post_id: 'queued', status: 'scheduled' }),
      row({ post_id: 'sending', status: 'publishing', platform_results: {} }),
    ],
    fb.ops,
    now,
  );
  assert.deepEqual(fb.log, ['remove fb_1', 'list', 'remove fb_lost']);
  assert.deepEqual(res.left, ['sending']);
  assert.equal(updates(calls).length, 3);
  assert.ok(updates(calls).every((u) => u.status === 'pulled'));

  const refused = stuckDb([]);
  const r2 = await takeDownRevoked(
    refused.admin,
    [row({ post_id: 'cut-off', status: 'publishing', platform_results: handingOff })],
    fakeFb({ listScheduled: { ok: true, posts: [onPage('fb_lost')], complete: true }, remove: { ok: false, error: 'nope' } }).ops,
    now,
  );
  assert.deepEqual(r2.left, ['cut-off']);
  assert.equal(updates(refused.calls).length, 0, 'the slot is not freed while the post could still go out');
});

// ── Re-review (controller, 28 Nov): a pull racing a hand-off, an incomplete Page read, the per-row budget ──────

test('pull: a hand-off claimed moments ago is NOT taken back — its schedule call may be in flight', async () => {
  const fresh = { facebook: { status: 'handing_off', handoff_started_at: new Date(now.getTime() - 60_000).toISOString() } };
  const { admin, calls } = oneRowDb({ status: 'publishing', facebook_post_id: null, platform_results: fresh, scheduled_for: row().scheduled_for, body: 'Hello' });
  const fb = fakeFb({ listScheduled: { ok: true, posts: [], complete: true } });
  assert.deepEqual(await pullPost(admin, 'p1', fb.ops, now), { ok: false, error: HANDING_OVER_MESSAGE });
  assert.deepEqual(fb.log, []);
  assert.equal(updates(calls).length, 0);
});

function raceDb(heldAfter: { status: string; facebook_post_id: string | null }) {
  return fakeAdmin((call): Answer | undefined => {
    if (call.table !== 'social_posts') return undefined;
    if (call.action === 'select' && (call.columns ?? '').startsWith('status')) return { data: heldAfter };
    if (call.action === 'select') return { data: [row()] };
    const payload = call.payload as { status?: string };
    if (call.action === 'update' && payload.status === 'publishing') return { data: [{ post_id: 'p1' }] };
    if (call.action === 'update' && payload.status === 'scheduled_on_fb') return { data: [] }; // pulled meanwhile
    if (call.action === 'update') return { data: [{ post_id: 'p1' }] };
    return undefined;
  });
}

test('race: Facebook takes a post the row no longer holds → it is deleted on Facebook at once', async () => {
  const { admin } = raceDb({ status: 'pulled', facebook_post_id: null });
  const fb = fakeFb();
  await handOffToFacebook(admin, now, fb.ops);
  assert.deepEqual(fb.log.map((l) => l.split(' ').slice(0, 2).join(' ')), ['schedule p1', 'remove fb_p1']);
});

test('race: when that delete fails, the row is marked for the manual take-down lane', async () => {
  const { admin, calls } = raceDb({ status: 'pulled', facebook_post_id: null });
  await handOffToFacebook(admin, now, fakeFb({ remove: { ok: false, error: 'nope' } }).ops);
  const mark = updates(calls).at(-1)!;
  assert.equal((mark.platform_results as { facebook: { status: string; external_id: string } }).facebook.status, 'takedown_needed');
  assert.equal((mark.platform_results as { facebook: { external_id: string } }).facebook.external_id, 'fb_p1');
});

test('race: a row that already holds this very id is left alone (no delete)', async () => {
  const { admin } = raceDb({ status: 'scheduled_on_fb', facebook_post_id: 'fb_p1' });
  const fb = fakeFb();
  await handOffToFacebook(admin, now, fb.ops);
  assert.deepEqual(fb.log.map((l) => l.split(' ')[0]), ['schedule']);
});

test('incomplete Page read: a no-match is not proof — recovery and a failed hand-off say "check the Page", never requeue', async () => {
  const stuck = row({ status: 'publishing', platform_results: handingOff });
  const r = stuckDb([stuck]);
  const res = await recoverStuckHandOffs(r.admin, now, fakeFb({ listScheduled: { ok: true, posts: [], complete: false } }).ops);
  assert.deepEqual(res, { adopted: [], requeued: [], failed: ['p1'] });
  assert.equal(updates(r.calls)[0]?.status, 'failed');
  assert.match(JSON.stringify(updates(r.calls)[0]?.platform_results), /check the Page/);

  const h = queueDb([row()]);
  await handOffToFacebook(h.admin, now, fakeFb({ schedule: { ok: false, error: 'timed out' }, listScheduled: { ok: true, posts: [], complete: false } }).ops);
  assert.equal(updates(h.calls).at(-1)?.status, 'failed', 'not put back for a retry');

  const pull = oneRowDb({ status: 'publishing', facebook_post_id: null, platform_results: handingOff, scheduled_for: row().scheduled_for, body: 'Hello' });
  const pr = await pullPost(pull.admin, 'p1', fakeFb({ listScheduled: { ok: true, posts: [], complete: false } }).ops, now);
  assert.equal(pr.ok, false);
  assert.equal(updates(pull.calls).length, 0);
});

test('budget, per row: past it no further Graph call starts — before the schedule the row goes back; after a failure it waits for recovery', async () => {
  // Spent between the claim and the schedule call: no call, the row is given back.
  let t = 0;
  const a = queueDb([row()]);
  const fa = fakeFb();
  await handOffToFacebook(a.admin, now, fa.ops, async () => true, { budgetMs: 10, clock: () => (t += 6) });
  assert.deepEqual(fa.log, []);
  assert.equal(updates(a.calls).at(-1)?.status, 'scheduled');

  // Spent during a failed schedule call: no Page read, the row stays claimed for recovery.
  let u = 0;
  const b = queueDb([row()]);
  const fbB = fakeFb({ schedule: { ok: false, error: 'timed out' } });
  const origSchedule = fbB.ops.schedule;
  let deadlineSeen: number | undefined;
  fbB.ops.schedule = async (r, at, opts) => {
    deadlineSeen = opts?.deadline;
    u += 100;
    return origSchedule(r, at, opts);
  };
  await handOffToFacebook(b.admin, now, fbB.ops, async () => true, { budgetMs: 50, clock: () => u });
  assert.equal(deadlineSeen, 50, 'the schedule call is handed the deadline');
  assert.deepEqual(fbB.log.map((l) => l.split(' ')[0]), ['schedule']);
  assert.equal(updates(b.calls).length, 1, 'only the claim: left for recovery');
});
