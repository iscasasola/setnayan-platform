/**
 * 📍 A BOOKED SUPPLIER PICKS THEIR CHAPTERS — the rules, EXECUTED (owner 2026-11-04, DECISION_LOG "CHAPTERS: THE
 * SUPPLIER PICKS, AND THE HOST CAN ALSO PICK FOR THEM": *"They can pick and we can also pick for them"*).
 *
 * The database half (who may ask, the lock's pass, the fixed facts) is
 * `tests/db/a-supplier-asks-for-their-chapters.db.test.ts`. Here:
 *   1 · what a pick may send (the same refusals the database makes, plus "nothing would change");
 *   2 · the supplier's own Where row: what they are on, what waits, and the trade's usual chapters as a PREFILL only;
 *   3 · a lock refusal is said in the database's own words, and the host's row then offers a request;
 *   4 · the wiring: the one accept path applies a Where request through `apply_supplier_where` (never a raw block
 *       write), the supplier's ask goes through `supplier_ask_where`, the host's ask through `host_ask_supplier_where`,
 *       the host's notice is the in-app-only `supplier_where_asked` and is NOT on the email allowlist, and the supplier
 *       picks in ONE dropdown (`ChosenRow`, the shared PickMenu), never a pill row;
 *   5 · the admin event page shows each supplier's Where.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripComments } from './strip-comments';
import {
  adminWhereLine,
  isLockedRefusal,
  supplierOwnWhere,
  whereAskRefusalWords,
  whereAskVerdict,
  whereRefusalWords,
  type WhereChapter,
} from './supplier-where';
import { waitingWords, buildSupplierDay } from './supplier-schedule';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(here, '..', rel), 'utf8'));

const CH: WhereChapter[] = [
  { blockId: 'p', name: 'Preparation', location: null, startAt: '2099-11-07T06:00:00Z', tags: ['photo'], kind: 'pre_ceremony' },
  { blockId: 'c', name: 'Ceremony', location: 'San Agustin', startAt: '2099-11-07T10:00:00Z', tags: [], kind: 'ceremony' },
  { blockId: 'r', name: 'Reception', location: null, startAt: '2099-11-07T17:00:00Z', tags: [], kind: 'reception' },
];
const KEYS = CH.map((c) => c.blockId);

test('1 · a pick sends only a real change of real chapters, with at least one', () => {
  assert.deepEqual(whereAskVerdict({ picked: ['r', 'p'], current: ['p'], chapterIds: KEYS }), { ok: true, ids: ['p', 'r'] }, 'time order, never tap order');
  assert.equal(whereAskVerdict({ picked: [], current: ['p'], chapterIds: KEYS }).ok, false);
  assert.equal((whereAskVerdict({ picked: [], current: ['p'], chapterIds: KEYS }) as { reason: string }).reason, 'keep_one');
  assert.equal((whereAskVerdict({ picked: ['p'], current: ['p'], chapterIds: KEYS }) as { reason: string }).reason, 'unchanged');
  assert.equal((whereAskVerdict({ picked: ['gone'], current: [], chapterIds: KEYS }) as { reason: string }).reason, 'not_a_chapter');
  // Every refusal the database names has its own words — never the bare code, never "sent".
  for (const code of ['unchanged', 'keep_one', 'not_a_chapter', 'no_chapters', 'everywhere', 'gone', 'not_booked', 'no_shop', 'not_yours', 'not_allowed']) {
    const words = whereAskRefusalWords(`whereask:${code}: x`);
    assert.doesNotMatch(words, /whereask|didn.t send/, `whereask:${code} has no words of its own`);
  }
  assert.match(whereAskRefusalWords('boom'), /didn.t send/);
});

test('2 · the supplier’s own Where: on now, waiting, and the trade’s usual chapters only as a prefill', () => {
  const bookings = [
    { vendorId: 'photo', category: 'photographer', status: 'contracted', label: 'Lumen' },
    { vendorId: 'coord', category: 'planner_coordinator', status: 'contracted', label: 'Pin' },
    { vendorId: 'quote', category: 'florist', status: 'quoted', label: 'Fleur' },
  ];
  const rows = supplierOwnWhere({ bookings, chapters: CH, requests: [], tradeDefault: () => ['c', 'r'] });
  assert.deepEqual(rows.map((r) => r.vendorId), ['photo'], 'a coordinator or an unbooked quote got a Where row');
  assert.deepEqual(rows[0]!.picked, ['p']);
  assert.deepEqual(rows[0]!.draft, ['p'], 'a supplier already on a chapter was prefilled from their trade');
  assert.equal(rows[0]!.fromTrade, false);
  assert.equal(rows[0]!.label, null, 'one booking needs no name on the row');

  // On no chapter: the trade's usual chapters start the dropdown — a draft, never sent by itself.
  const fresh = supplierOwnWhere({
    bookings: [{ vendorId: 'cater', category: 'catering', status: 'deposit_paid', label: null }],
    chapters: CH,
    requests: [],
    tradeDefault: () => ['r', 'gone'],
  })[0]!;
  assert.deepEqual(fresh.picked, []);
  assert.deepEqual(fresh.draft, ['r'], 'the prefill kept a chapter that is not on this event');
  assert.equal(fresh.fromTrade, true);

  // A request waiting: the dropdown shows what they asked; only their own open to_host request counts.
  const waiting = supplierOwnWhere({
    bookings: [bookings[0]!],
    chapters: CH,
    requests: [
      { suggestion_id: 's0', kind: 'where', status: 'declined', direction: 'to_host', where_vendor_id: 'photo', proposed_block_ids: ['c'] },
      { suggestion_id: 's1', kind: 'where', status: 'open', direction: 'to_supplier', where_vendor_id: 'photo', proposed_block_ids: ['c'] },
      { suggestion_id: 's2', kind: 'where', status: 'open', direction: 'to_host', where_vendor_id: 'photo', proposed_block_ids: ['p', 'r'] },
    ],
  })[0]!;
  assert.deepEqual(waiting.waiting, { suggestionId: 's2', ids: ['p', 'r'], names: 'Preparation, Reception' });
  assert.deepEqual(waiting.draft, ['p', 'r']);

  // Their day never lists a Where request as "A suggestion" on some moment.
  const day = buildSupplierDay({
    blocks: [],
    myBookingIds: ['photo'],
    tasks: [],
    requests: [
      {
        suggestion_id: 's2', block_id: null, kind: 'where', proposed_label: null, proposed_start_at: null, proposed_end_at: null,
        proposed_parent_block_id: null, proposed_crew: null, note: 'Asks to work Preparation, Reception', status: 'open', created_at: '2099-01-01T00:00:00Z',
      },
    ],
  });
  assert.equal(day.otherWaiting.length, 0, 'a Where request was drawn as a stray suggestion');
  assert.equal(waitingWords({ kind: 'where', proposed_label: null }, null), 'Your chapters');
});

test('3 · a lock refusal is said in the database’s words; other refusals keep theirs', () => {
  const pg = "Lumen Studio isn't taking changes. Send them a request instead.";
  assert.equal(isLockedRefusal(pg), true);
  assert.equal(whereRefusalWords(pg), pg);
  assert.equal(isLockedRefusal('a_booked_supplier_needs_a_chapter: keep'), false);
  assert.match(whereRefusalWords('a_booked_supplier_needs_a_chapter: keep'), /at least 1 chapter/);
});

test('4 · the wiring: one accept path, the three doors, an in-app-only notice, one dropdown', () => {
  const decide = read('lib/schedule-suggestion-decide.server.ts');
  const whereBranch = decide.match(/suggestion\.kind === 'where'\) \{([\s\S]*?)\} else if/)?.[1] ?? '';
  assert.match(whereBranch, /rpc\('apply_supplier_where'/, 'the accept path does not apply a Where request through its one door');
  assert.doesNotMatch(whereBranch, /from\('event_schedule_blocks'\)/, 'the accept path writes a Where request straight onto the blocks');

  const actions = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const whereAsk = actions.match(/if \(request === 'where'\) \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
  assert.match(whereAsk, /rpc\('supplier_ask_where'/, 'the supplier’s pick does not go through supplier_ask_where');
  assert.match(whereAsk, /settleAfterAsking\(/, 'the supplier’s pick skips the host’s Auto-agree / accept path');
  assert.match(whereAsk, /where: \{/, 'the host is not told with the Where notice');

  const notify = read('lib/schedule-request-notify.server.ts');
  const whereEmit = notify.match(/if \(input\.where\) \{([\s\S]*?)continue;/)?.[1] ?? '';
  assert.match(whereEmit, /type: 'supplier_where_asked'/, 'the host’s Where notice is not the in-app-only type');
  const emit = read('lib/notification-emit.ts');
  const allow = emit.match(/EMAIL_ENABLED_TYPES[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? '';
  assert.ok(allow.length > 0, 'could not find the email allowlist');
  assert.doesNotMatch(allow, /supplier_where_asked/, 'the Where notice is emailed — owner rule: no new emails');

  const hostRow = read('app/dashboard/[eventId]/vendors/_components/booked-where.tsx');
  assert.match(hostRow, /rpc\('host_ask_supplier_where'/, 'a locked supplier’s row has no way to send them a request');
  assert.match(hostRow, /rpc\('set_supplier_where'/, 'the host’s direct pick is gone');

  const view = read('app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule.tsx');
  const row = view.match(/function SupplierWhereRow\([\s\S]*?\n\}\n/)?.[0] ?? '';
  assert.ok(row, 'the supplier’s Where row is gone');
  assert.equal((row.match(/<ChosenRow/g) ?? []).length, 1, 'the supplier’s Where is not ONE dropdown');
  assert.match(row, /picked=\{draft\}/, 'the supplier’s Where dropdown is not a multi-pick');
  assert.match(row, /request: 'where'/, 'the supplier’s Where row does not send a Where request');
  assert.match(view, /<SupplierWhereRow /, 'the supplier’s Where row is not mounted on their Schedule');
});

test('5 · the admin event page shows each supplier’s Where, honestly', () => {
  assert.equal(adminWhereLine({ vendorId: 'photo', chapters: CH, openAsks: [] }), 'Where: Preparation');
  assert.equal(adminWhereLine({ vendorId: 'nobody', chapters: CH, openAsks: [] }), 'Where: no chapter yet');
  assert.equal(adminWhereLine({ vendorId: 'photo', chapters: null, openAsks: [] }), 'Where: could not be read');
  assert.equal(adminWhereLine({ vendorId: 'coord', category: 'planner_coordinator', chapters: CH, openAsks: [] }), 'Where: every chapter');
  assert.equal(
    adminWhereLine({
      vendorId: 'photo',
      chapters: CH,
      openAsks: [{ suggestion_id: 's', kind: 'where', status: 'open', direction: 'to_host', where_vendor_id: 'photo', proposed_block_ids: ['c', 'r'] }],
    }),
    'Where: Preparation · asked Ceremony, Reception, waiting for the host',
  );
  const page = read('app/admin/events/[eventId]/page.tsx');
  assert.match(page, /adminWhereLine\(/, 'the admin event page does not compute each supplier’s Where');
  assert.match(page, /data-admin-supplier-where=/, 'the admin event page does not draw each supplier’s Where');
});
