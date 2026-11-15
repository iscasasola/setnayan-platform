/**
 * Every queue the solo-operator audit called SILENT has a count — and a count
 * that could not be read says so, never 0.
 *
 * Owner-approved admin drawing (Setnayan-specs DECISION_LOG 2026-11-13 "ADMIN
 * DRAWING APPROVED — BUILD IT"); prototypes/admin_five_tabs_2026-11-13/
 * SOLO-OPERATOR-AUDIT.md, fact 4: *"A queue the digest does not count fills
 * silently … repost watch (two tables), fraud queue, editorial review, pax
 * changes, social queue, Pakanta, supplier refunds, service requests, Problems
 * and email bounces."*
 *
 * ⚖ THE LIST BELOW IS THE AUDIT'S, NOT A DERIVATION — on purpose. A derived list
 * would shrink with the code; this one is the owner's requirement, so deleting a
 * queue's count fails here instead of quietly re-silencing it.
 *
 * Each queue must have, all three:
 *   1. a count source in QUEUE_DEFS (so it carries a badge — ADMIN_QUEUE_META),
 *   2. a row on Work (BASE_ROWS — where the badge is drawn),
 *   3. a named line in the morning digest (ADMIN_QUEUE_DIGEST_LINES).
 * And when every read is refused, its count is NULL, which every surface draws
 * as "couldn't count" — exercised here against a database that refuses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_QUEUE_META,
  ADMIN_QUEUE_DIGEST_LINES,
  computeDueState,
  countQueue,
  deriveQueueUrgency,
  type AdminQueueDigest,
} from '@/lib/admin/queue-counts';
import { BASE_ROWS } from '@/lib/admin/work-rows';
import { silentQueueLines, buildDigestEmail, COULD_NOT_COUNT } from '@/lib/admin/digest-content';

const SILENT_QUEUES = [
  'repost-watch',
  'fraud',
  'editorial-review',
  'pax-changes',
  'social-queue',
  'pakanta',
  'supplier-refunds',
  'service-requests',
  'problems',
  'email-bounces',
] as const;

/**
 * A Supabase client whose every read is REFUSED the way PostgREST refuses:
 * politely, with `{ data: null, error, count: null }` — it does not throw.
 * Every builder method chains; awaiting the chain resolves the refusal.
 */
function refusingClient(): any {
  const refusal = { data: null, error: { message: 'permission denied', code: '42501' }, count: null };
  const builder: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (ok: (v: unknown) => unknown) => Promise.resolve(refusal).then(ok);
      return () => builder;
    },
    apply() {
      return builder;
    },
  });
  return { from: () => builder, rpc: () => builder };
}

/**
 * A client where ONE table answers and every other refuses — the partial
 * failure a two-table count must not turn into a smaller number.
 */
function halfRefusingClient(okTable: string): any {
  const refusal = { data: null, error: { message: 'permission denied' }, count: null };
  const fine = { data: [], error: null, count: 3 };
  const chain = (answer: unknown): any => {
    const b: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') return (ok: (v: unknown) => unknown) => Promise.resolve(answer).then(ok);
        return () => b;
      },
      apply() {
        return b;
      },
    });
    return b;
  };
  return { from: (t: string) => chain(t === okTable ? fine : refusal) };
}

test('every silent queue has a count source — so it carries a badge', () => {
  const missing = SILENT_QUEUES.filter((k) => !(k in ADMIN_QUEUE_META));
  assert.deepEqual(missing, [], `no count source in QUEUE_DEFS for: ${missing.join(', ')}`);
});

test('every silent queue has a row on Work — where its badge is drawn', () => {
  const rows = new Set(BASE_ROWS.map((r) => r.key));
  const missing = SILENT_QUEUES.filter((k) => !rows.has(k));
  assert.deepEqual(missing, [], `no Work row for: ${missing.join(', ')}`);
});

test('every silent queue has a named line in the morning digest', () => {
  const lines = new Set(ADMIN_QUEUE_DIGEST_LINES.map((l) => l.key));
  const missing = SILENT_QUEUES.filter((k) => !lines.has(k));
  assert.deepEqual(missing, [], `no digest line for: ${missing.join(', ')}`);
});

test('the words people read: Music Maker, never Pakanta; supplier, never vendor', () => {
  for (const r of BASE_ROWS.filter((b) => (SILENT_QUEUES as readonly string[]).includes(b.key))) {
    assert.doesNotMatch(`${r.label} ${r.description}`, /pakanta|vendor/i, r.key);
  }
  for (const l of ADMIN_QUEUE_DIGEST_LINES) {
    assert.doesNotMatch(`${l.label} ${l.say(2)}`, /pakanta|vendor/i, l.key);
  }
});

test('⏱ no silent queue was given a guessed clock — the promise time is the owner’s', () => {
  const clocked = SILENT_QUEUES.filter((k) => ADMIN_QUEUE_META[k]?.slaHours !== null);
  assert.deepEqual(clocked, [], `a builder set an SLA on: ${clocked.join(', ')}`);
});

for (const key of SILENT_QUEUES) {
  test(`⚠ ${key}: a refused read counts as UNKNOWN, never 0`, async () => {
    const row = await countQueue(refusingClient(), key, Date.parse('2026-11-13T02:00:00Z'));
    assert.ok(row, `${key} has no count source`);
    assert.equal(row.count, null, `${key} turned a refused read into ${row.count}`);
    assert.equal(computeDueState(row, ADMIN_QUEUE_META[key]?.slaHours ?? null, Date.now()), 'unknown');
  });
}

test('⚠ a two-table count with ONE table refused is unknown — never the smaller sum', async () => {
  const now = Date.parse('2026-11-13T02:00:00Z');
  const repost = await countQueue(halfRefusingClient('vendor_image_flags'), 'repost-watch', now);
  assert.equal(repost?.count, null, 'repost watch reported the image flags alone');
  const social = await countQueue(halfRefusingClient('social_posts'), 'social-queue', now);
  assert.equal(social?.count, null, 'the social queue reported failed posts alone');
});

test('the digest names a failed count "couldn’t count" — and never prints it as 0', () => {
  const digest: AdminQueueDigest = Object.fromEntries(
    SILENT_QUEUES.map((k) => [k, { count: null, oldestAt: null }]),
  );
  const lines = silentQueueLines(digest);
  assert.equal(lines.length, SILENT_QUEUES.length, 'a failed count was skipped — a skip reads as empty');
  for (const l of lines) {
    assert.ok(l.endsWith(COULD_NOT_COUNT), `not said as unknown: ${l}`);
    assert.doesNotMatch(l, /\b0\b/, `printed as zero: ${l}`);
  }
});

test('the digest names a real count in its own words, and leaves an empty queue out', () => {
  const digest: AdminQueueDigest = {
    fraud: { count: 2, oldestAt: null },
    problems: { count: 0, oldestAt: null },
  };
  const lines = silentQueueLines(digest).filter((l) => !l.endsWith(COULD_NOT_COUNT));
  assert.deepEqual(lines, ['Fraud queue — 2 auto-suspended, need your look']);
  const email = buildDigestEmail(
    { ...digest, verify: { count: 1, oldestAt: null } },
    deriveQueueUrgency({ ...digest, verify: { count: 1, oldestAt: null } }, Date.now()),
  );
  assert.match(email.text, /Fraud queue — 2 auto-suspended, need your look/);
});

test('a trail to watch keeps its badge but is never "items waiting"', () => {
  const watch = SILENT_QUEUES.filter((k) => ADMIN_QUEUE_META[k]?.watchOnly);
  assert.deepEqual([...watch].sort(), ['pax-changes', 'supplier-refunds']);
  const digest: AdminQueueDigest = {
    'pax-changes': { count: 5, oldestAt: null },
    'supplier-refunds': { count: 4, oldestAt: null },
  };
  const urgency = deriveQueueUrgency(digest, Date.now());
  assert.equal(urgency.states['pax-changes'], 'ok', 'its badge state is still drawn');
  // The whole registry minus those two is missing from this digest, so the
  // unknown tally is "every work queue"; the two trails are not in it.
  const workQueues = Object.entries(ADMIN_QUEUE_META).filter(([, m]) => !m.watchOnly).length;
  assert.equal(urgency.unknownCount, workQueues);
  assert.equal(urgency.totalOpen, 0, 'a week of pax changes was counted as work waiting');
});
