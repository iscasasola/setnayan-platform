/**
 * Guard: a queue badge counts the rows its own page lists.
 *
 * WHAT WENT WRONG. `event_vendors.completion_status` DEFAULTS to
 * `'awaiting_vendor'` and is NOT NULL, so "unsettled" matches every row from
 * insert. `/admin/completions` always knew that and applied a second cut needing
 * the CELEBRATION DATE. The badge, added 2026-08-19, applied only the first half
 * — and its QUEUE_DEF comment claimed it "Mirrors /admin/completions exactly".
 *
 * Measured against production 2026-08-25:
 *   the old filter counted  45
 *   the shared rule counts   1   ← what the page lists
 *   44 of the 45 were weddings 109 and 115 days in the FUTURE, and because the
 *   badge aged on `created_at` it rendered RED "past SLA".
 *
 * ONE PREDICATE, TWO READERS. Both must import it; neither may re-implement it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  completionStuckReason,
  completionStuckSince,
  STUCK_AWAITING_DAYS,
} from './completions-stuck';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const code = (p: string) =>
  readFileSync(p, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

const DESK = join(WEB, 'app/admin/completions/page.tsx');
const COUNTS = join(HERE, 'queue-counts.ts');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-08-25T00:00:00Z');

test('🔴 a future celebration is not stuck — the 44 that made the badge lie', () => {
  const inDecember = { completion_status: 'awaiting_vendor', service_marked_complete_at: null, customer_confirmed_received_at: null };
  assert.equal(
    completionStuckReason(inDecember, '2026-12-12', NOW),
    null,
    'a wedding 109 days away cannot have an unsettled completion — this is the ' +
      'exact row shape that put a red 45 on the admin console',
  );
});

test('a celebration well past IS stuck, so the rule still catches real work', () => {
  assert.equal(
    completionStuckReason(
      { completion_status: 'awaiting_vendor', service_marked_complete_at: null, customer_confirmed_received_at: null },
      '2026-08-01',
      NOW,
    ),
    'vendor_overdue',
    'the rule must not have become a rule that catches nothing',
  );
});

test('⚖ an unknown celebration date never manufactures urgency', () => {
  assert.equal(
    completionStuckReason(
      { completion_status: 'awaiting_vendor', service_marked_complete_at: null, customer_confirmed_received_at: null },
      null,
      NOW,
    ),
    null,
  );
  /* …but a DISPUTED row does not wait on a date: somebody actively raised it. */
  assert.equal(
    completionStuckReason(
      { completion_status: 'disputed', service_marked_complete_at: null, customer_confirmed_received_at: null },
      null,
      NOW,
    ),
    'disputed',
  );
});

test('🕒 the clock ages from when it BECAME stuck, never from when it was typed', () => {
  const since = completionStuckSince(
    { completion_status: 'awaiting_vendor', service_marked_complete_at: null, customer_confirmed_received_at: null },
    '2026-08-01',
    'vendor_overdue',
  );
  assert.equal(
    since,
    new Date(Date.parse('2026-08-01') + STUCK_AWAITING_DAYS * DAY).toISOString(),
    'ageing on created_at is what rendered a December wedding 68 days overdue',
  );
});

test('🔴 both readers import the ONE rule, and neither re-implements it', () => {
  for (const [name, p] of [['the desk', DESK], ['the badge', COUNTS]] as const) {
    const src = code(p);
    assert.match(
      src,
      /completionStuckReason/,
      `${name} no longer uses the shared stuck rule`,
    );
    /* A local copy of either threshold means the rule has been forked again —
       which is precisely how the badge and the page came to disagree. */
    assert.ok(
      !/const\s+STUCK_(AWAITING|MARKED)_DAYS\s*=/.test(src),
      `${name} has re-declared a stuck threshold locally instead of importing it`,
    );
  }
});

test('⛔ the badge does not count through the bare filter alone', () => {
  const src = code(COUNTS);
  const i = src.indexOf("key: 'completions'");
  assert.ok(i > 0, 'the completions queue definition vanished');
  const def = src.slice(i, i + 600);
  assert.match(
    def,
    /digest:\s*countStuckCompletions/,
    'completions is counting through its coarse filter again — that filter ' +
      'matches every event_vendors row ever inserted, because the column ' +
      'defaults to awaiting_vendor',
  );
});

test('⚖ a failed count stays NULL — it must never become a reassuring zero', () => {
  const src = code(COUNTS);
  const i = src.indexOf('export async function countStuckCompletions');
  const body = src.slice(i, src.indexOf('\n}', i));
  assert.match(
    body,
    /return \{ count: null, oldestAt: null \}/,
    'the bespoke reader must degrade to null so "some counts unavailable" can ' +
      'still fire; a 0 here is indistinguishable from a clear queue',
  );
});
