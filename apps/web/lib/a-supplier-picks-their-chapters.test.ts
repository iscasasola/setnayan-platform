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
  whereNoticeTarget,
  whereNoticeUrl,
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

/* ── The owner's four answers on #7260 (2026-11-04) ───────────────────────────────────────────────────────────────── */

test('6 · Time TBA goes last everywhere — one rule for every Where dropdown and the supplier’s day', async () => {
  const { whereChaptersFrom, chapterDayKey } = await import('./supplier-where');
  const rows = [
    { block_id: 'tba', parent_block_id: null, label: 'Send-off', start_at: '2099-11-07T00:00:00Z', time_tba: true },
    { block_id: 'cer', parent_block_id: null, label: 'Ceremony', start_at: '2099-11-07T15:00:00Z', time_tba: false },
    { block_id: 'prep', parent_block_id: null, label: 'Preparation', start_at: '2099-11-07T10:00:00Z' },
    { block_id: 'next', parent_block_id: null, label: 'Day two', start_at: '2099-11-08T09:00:00Z' },
  ];
  assert.deepEqual(whereChaptersFrom(rows).map((c) => c.blockId), ['prep', 'cer', 'tba', 'next'], 'a TBA chapter was not after its day’s timed chapters');
  // The supplier's day sorts by the very same key.
  const day = buildSupplierDay({
    blocks: rows.map((r) => ({ ...r, end_at: null, location: null, spot: null, time_tba: r.time_tba === true, is_optional: false, responsible_vendor_ids: [], created_at: null, updated_at: null })),
    myBookingIds: [],
    tasks: [],
    requests: [],
  });
  assert.deepEqual(day.chapters.map((c) => c.block_id), ['prep', 'cer', 'tba', 'next']);
  assert.match(read('lib/supplier-schedule.ts'), /chapterDayKey\(/, 'the supplier’s day keeps a second ordering rule of its own');
  assert.equal(chapterDayKey({ startAt: '2099-11-07T00:00:00Z', timeTba: true }) > chapterDayKey({ startAt: '2099-11-07T23:59:00Z' }), true);
  // Every caller reads the flag, so the rule can see it.
  for (const f of ['app/admin/events/[eventId]/page.tsx', 'app/vendor-dashboard/clients/[eventId]/page.tsx', 'app/dashboard/[eventId]/schedule/page.tsx']) {
    const src = read(f);
    const call = src.slice(src.indexOf('whereChaptersFrom('), src.indexOf('whereChaptersFrom(') + 700);
    assert.match(call + src, /time_tba/, `${f} sorts its Where chapters without the Time-TBA flag`);
  }
});

test('7 · OK on the notice is the SAME action as OK in the Requests sheet', () => {
  const ok = read('app/_components/notifications/where-notice-ok.tsx');
  assert.match(ok, /resolveScheduleSuggestion\(fd\)/, 'the notice’s OK does not post the Requests sheet’s action');
  assert.match(ok, /fd\.set\('decision', 'accept'\)/);
  assert.doesNotMatch(ok, /rpc\(|from\('event_schedule/, 'the notice’s OK writes on its own — a second copy of what OK means');
  assert.doesNotMatch(ok, /return_to/, 'marking it read leaves the page');
  const list = read('app/_components/notifications/notifications-list.tsx');
  assert.match(list, /whereNoticeTarget\(n\.type, n\.related_url\)/, 'the notice list does not offer OK on a Where notice');
  assert.match(list, /<WhereNoticeOk /);
  // The link names the request, and nothing else gets an OK.
  const url = whereNoticeUrl('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');
  assert.deepEqual(whereNoticeTarget('supplier_where_asked', url), {
    eventId: '11111111-1111-4111-8111-111111111111',
    suggestionId: '22222222-2222-4222-8222-222222222222',
  });
  assert.equal(whereNoticeTarget('schedule_change_requested', url), null, 'another notice got a Where OK');
  assert.equal(whereNoticeTarget('supplier_where_asked', '/dashboard/x/schedule?sheet=requests'), null, 'an OK with no request to answer');
  const notify = read('lib/schedule-request-notify.server.ts');
  assert.match(notify, /relatedUrl: whereNoticeUrl\(input\.eventId, input\.where\.suggestionId\)/, 'the Where notice does not name its request');
});

test('8 · the host picked for them: "Answered by the host", never "Not approved"; the locked ask carries a note', () => {
  const view = read('app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule.tsx');
  assert.match(view, /r\.status === 'answered_by_host'\s*\?\s*'Answered by the host'/, 'the supplier reads the host’s own pick as a refusal');
  const hostRow = read('app/dashboard/[eventId]/vendors/_components/booked-where.tsx');
  assert.match(hostRow, /p_note: note\.trim\(\) \|\| null/, 'the host’s request to a locked supplier carries no note');
  assert.match(hostRow, /data="where-locked-ask-note"/, 'there is no place to type the note');
  assert.match(hostRow, /maxLength=\{200\}/, 'the note is not one line');
});
