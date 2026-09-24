/**
 * the-board-card-reads-are-honest.test.ts
 *
 * ⚖ Owner-approved 2026-09-24 (collection template): the private strip on each
 * Planning card says what needs you — and **unknown ≠ zero**. The reads that
 * feed it used to turn a refused query into zeros in two places: the helpers
 * (`data ?? []` after an unread `error`, a `catch {}` that kept the zero-seeded
 * map) and the launcher (`.catch(() => new Map())`). A card then said nothing
 * needed you, off a read that never completed — this codebase's signature
 * defect (`apps/web/app/vendor-dashboard/reads-are-honest.test.ts`).
 *
 * Executed against a fake client whose queries RESOLVE with `{ error }` — the
 * way supabase actually fails — because a `.catch()` never sees that shape.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readChecklistItems, fetchChecklistItems } from './checklist';
import {
  fetchEventDecisionCounts,
  fetchEventUnreadCounts,
  readEventDecisionCounts,
  readEventUnreadCounts,
} from './event-decisions';
import { stripComments } from './strip-comments';

type Result = { data: unknown; error: unknown };

/** A chainable query that resolves to `result` whatever is chained on it. */
function query(result: Result) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'is', 'not']) q[m] = () => q;
  q.then = (ok: (r: Result) => unknown, bad?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(ok, bad);
  return q;
}

function client(tables: Record<string, Result>, rpc: Result = { data: [], error: null }) {
  return {
    from: (t: string) => query(tables[t] ?? { data: [], error: null }),
    rpc: () => Promise.resolve(rpc),
  } as never;
}

const REFUSED = { data: null, error: { code: '42501', message: 'permission denied' } };

test('checklist: a refused read is null — an empty checklist is []', async () => {
  assert.equal(await readChecklistItems(client({ event_checklist_items: REFUSED }), 'e1'), null);
  assert.deepEqual(
    await readChecklistItems(client({ event_checklist_items: { data: [], error: null } }), 'e1'),
    [],
  );
  // The page-rendering wrapper keeps its graceful `[]` for its other callers.
  assert.deepEqual(await fetchChecklistItems(client({ event_checklist_items: REFUSED }), 'e1'), []);
});

test('decisions: EITHER refused query makes the whole answer unknown', async () => {
  const ok = { data: [{ event_id: 'e1' }], error: null };
  assert.equal(await readEventDecisionCounts(client({ orders: REFUSED, vendor_proposals: ok }), ['e1']), null);
  assert.equal(await readEventDecisionCounts(client({ orders: ok, vendor_proposals: REFUSED }), ['e1']), null);
  const both = await readEventDecisionCounts(client({ orders: ok, vendor_proposals: ok }), ['e1', 'e2']);
  assert.deepEqual(both && Object.fromEntries(both), {
    e1: { pay: 1, approve: 1 },
    e2: { pay: 0, approve: 0 },
  });
  // The wrapper still degrades for its other caller, and still counts what DID read.
  const wrapped = await fetchEventDecisionCounts(client({ orders: REFUSED, vendor_proposals: ok }), ['e1']);
  assert.deepEqual(Object.fromEntries(wrapped), { e1: { pay: 0, approve: 1 } });
});

test('unread: a refused RPC is null, never an empty map', async () => {
  assert.equal(await readEventUnreadCounts(client({}, REFUSED)), null);
  const ok = await readEventUnreadCounts(client({}, { data: [{ event_id: 'e1', unread_count: 2 }], error: null }));
  assert.deepEqual(ok && Object.fromEntries(ok), { e1: 2 });
  assert.equal((await fetchEventUnreadCounts(client({}, REFUSED))).size, 0);
});

test('the board reads the honest ones, and turns null into "couldn’t load" on the card', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = stripComments(readFileSync(join(here, '../app/dashboard/(launcher)/page.tsx'), 'utf8'));
  assert.match(src, /await readChecklistItems\(supabase, e\.event_id\)/);
  assert.match(src, /readEventDecisionCounts\(\s*supabase,[\s\S]{0,80}?\)\.catch\(\(\) => null\)/);
  assert.match(src, /readEventUnreadCounts\(supabase\)\.catch\(\(\) => null\)/);
  assert.doesNotMatch(
    src,
    /fetchEventDecisionCounts|fetchEventUnreadCounts|fetchChecklistItems/,
    'the board went back to a read that turns a refusal into zeros',
  );
  // null summary → the card's couldn't-load row (never on an invited card).
  assert.match(src, /if \(stance === 'invited'\) return undefined;\s*if \(summary === null\) return \{ count: null \};/);
  // a failed checklist read → the ring's couldn't-load, not a vanished ring.
  assert.match(src, /pct: ringUnknown \? null : showRing/);
  const mounts = src.match(/progressFailed=\{progressFailed\.has\(event\.event_id\)\}/g) ?? [];
  assert.equal(mounts.length, 5, 'a shelf does not pass its failed-progress flag to its cards');
});
