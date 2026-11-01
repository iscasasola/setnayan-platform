/**
 * 📍 WHERE A SUPPLIER GOES — the rules, EXECUTED (owner 2026-11-01, DECISION_LOG "MANY VENUES PER EVENT; SUPPLIERS
 * PICK THEIR CHAPTERS; COORDINATORS ARE EVERYWHERE"; `lib/supplier-where.ts`).
 *
 * The database half (two venues book · `set_supplier_where` refuses) is `tests/db/many-venues-and-where.db.test.ts`.
 * Here: what a Team row says and what a save may do, through the REAL `bookedView` where a row is concerned, and the
 * notice a booked supplier gets — down to the one action that sends it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripComments } from './strip-comments';
import { VENUE_TBA } from './schedule-chapters';
import { teamRows, type TeamRowFacts } from './your-team-rows';
import { bookedView, type BookedFacts } from './booked-rows';
import {
  WHERE_WORDS,
  chapterVenue,
  coveredKeyOf,
  inHouseWhere,
  supplierWhere,
  whereChangeNotice,
  whereChaptersFrom,
  whereSaveVerdict,
  type WhereChapter,
} from './supplier-where';

const here = dirname(fileURLToPath(import.meta.url));
const src = (...p: string[]) => stripComments(readFileSync(join(here, '..', ...p), 'utf8'));

const CH: WhereChapter[] = [
  { blockId: 'prep', name: 'Preparation', location: 'Sample Hotel', startAt: '2099-12-18T06:00:00Z', tags: ['venue-a'] },
  { blockId: 'cer', name: 'Ceremony', location: null, startAt: '2099-12-18T14:00:00Z', tags: ['venue-b', 'photo'] },
  { blockId: 'rec', name: 'Reception', location: null, startAt: '2099-12-18T18:00:00Z', tags: ['venue-a', 'photo'] },
];
const VENUES = new Map([
  ['venue-a', 'Sample Hotel'],
  ['venue-b', 'Sample Parish'],
]);

test('chapters are the TOP-LEVEL blocks, in time order; a moment is never a chapter', () => {
  const out = whereChaptersFrom([
    { block_id: 'rec', label: 'Reception', start_at: '2099-12-18T18:00:00Z', responsible_vendor_ids: ['x'] },
    { block_id: 'm1', parent_block_id: 'rec', label: 'First dance', start_at: '2099-12-18T19:00:00Z' },
    { block_id: 'cer', label: 'Ceremony', start_at: '2099-12-18T14:00:00Z', location: '  ' },
  ]);
  assert.deepEqual(out.map((c) => c.blockId), ['cer', 'rec']);
  assert.equal(out[0]!.location, null, 'a blank venue is no venue');
});

test('the venue follows the chapter: typed, else a booked venue that picked it, else Venue TBA', () => {
  assert.equal(chapterVenue(CH[0]!, VENUES), 'Sample Hotel');
  assert.equal(chapterVenue(CH[1]!, VENUES), 'Sample Parish', 'the second venue hosts the ceremony');
  assert.equal(chapterVenue({ ...CH[1]!, tags: ['photo'] }, VENUES), VENUE_TBA);
});

test('🔒 COORDINATORS NEED NONE: on every chapter, no dropdown, and a save is refused', () => {
  assert.deepEqual(supplierWhere({ vendorId: 'coord', groupId: 'coordinator', booked: true, chapters: CH, venues: VENUES }), { kind: 'everywhere' });
  // Even with no chapters, or the read refused, a coordinator is still everywhere — never "needs a chapter".
  assert.equal(supplierWhere({ vendorId: 'coord', groupId: 'coordinator', booked: true, chapters: [], venues: VENUES }).kind, 'everywhere');
  const v = whereSaveVerdict({ groupId: 'coordinator', booked: true, picked: ['rec'], chapterIds: ['rec'] });
  assert.equal(v.ok, false);
  assert.equal(!v.ok && v.reason, 'everywhere');
  // By the stored category too — what the database checks.
  assert.equal(whereSaveVerdict({ groupId: null, category: 'planner_coordinator', booked: false, picked: [], chapterIds: [] }).ok, false);
});

test('🔒 BOOKED WITHOUT WHERE IS REFUSED — while the event has chapters; before booking it may be empty', () => {
  const ids = CH.map((c) => c.blockId);
  const refused = whereSaveVerdict({ groupId: 'cake', booked: true, picked: [], chapterIds: ids });
  assert.equal(refused.ok, false);
  assert.equal(!refused.ok && refused.reason, 'keep_one');
  assert.equal(!refused.ok && refused.words, WHERE_WORDS.keepOne);
  assert.equal(whereSaveVerdict({ groupId: 'cake', booked: false, picked: [], chapterIds: ids }).ok, true, 'on the quote it may be empty');
  assert.equal(whereSaveVerdict({ groupId: 'cake', booked: true, picked: [], chapterIds: [] }).ok, true, 'no chapter exists yet');
  assert.equal(whereSaveVerdict({ groupId: 'cake', booked: true, picked: ['gone'], chapterIds: ids }).ok, false, 'only this event’s chapters');
  const ok = whereSaveVerdict({ groupId: 'cake', booked: true, picked: ['rec', 'rec'], chapterIds: ids });
  assert.deepEqual(ok.ok && ok.ids, ['rec']);
});

test('the Team row: booked on none says "Needs at least 1 chapter" and counts; picked says the names; refused says so', () => {
  const team: TeamRowFacts[] = [
    { vendorId: 'photo', name: 'Sample Photo', service: 'Photo', logoUrl: null, status: 'contracted', lockRequestState: null, lockRequestExpiresAt: null, inBuild: false, lockGroupId: null, lockBlocked: null, inquiryStatus: null, threadId: null, pricePhp: 1000, depositStep: null, reviewStatus: null, quoteWaitingOnCouple: false },
    { vendorId: 'cake', name: 'Sample Cakes', service: 'Cake', logoUrl: null, status: 'contracted', lockRequestState: null, lockRequestExpiresAt: null, inBuild: false, lockGroupId: null, lockBlocked: null, inquiryStatus: null, threadId: null, pricePhp: 1000, depositStep: null, reviewStatus: null, quoteWaitingOnCouple: false },
    { vendorId: 'coord', name: 'Sample Coordinator', service: 'Coordinator', logoUrl: null, status: 'contracted', lockRequestState: null, lockRequestExpiresAt: null, inBuild: false, lockGroupId: null, lockBlocked: null, inquiryStatus: null, threadId: null, pricePhp: 1000, depositStep: null, reviewStatus: null, quoteWaitingOnCouple: false },
  ];
  const facts: BookedFacts[] = [
    { vendorId: 'photo', groupId: 'photography', own: true, shopId: null, pricePhp: 1000, threadId: null, moneyMoved: false, lockRequestExpiresAt: null },
    { vendorId: 'cake', groupId: 'cake', own: true, shopId: null, pricePhp: 1000, threadId: null, moneyMoved: false, lockRequestExpiresAt: null },
    { vendorId: 'coord', groupId: 'coordinator', own: true, shopId: null, pricePhp: 1000, threadId: null, moneyMoved: false, lockRequestExpiresAt: null },
  ];
  const rows = teamRows(team, { eventId: 'e', lockHandshakeEnabled: true });
  const view = bookedView({ rows, facts, money: null, chapters: CH });
  const by = new Map(view.booked.map((b) => [b.vendorId, b.where]));
  const photo = by.get('photo');
  assert.equal(photo?.kind, 'set');
  assert.equal(photo?.kind === 'set' && photo.names, 'Ceremony, Reception');
  assert.equal(photo?.kind === 'set' && photo.needsOne, false);
  const cake = by.get('cake');
  assert.equal(cake?.kind === 'set' && cake.needsOne, true);
  assert.equal(by.get('coord')?.kind, 'everywhere');
  assert.equal(view.needWhere, 1, 'only the cake needs a chapter — never the coordinator');
  // The options read "Chapter · Venue", the venue following the chapter.
  assert.deepEqual(photo?.kind === 'set' && photo.options.map((o) => o.label), ['Preparation · Sample Hotel', 'Ceremony · ' + VENUE_TBA, 'Reception · ' + VENUE_TBA]);

  assert.equal(bookedView({ rows, facts, money: null, chapters: null }).booked[0]!.where?.kind, 'unread', 'a refused read is said');
  assert.equal(bookedView({ rows, facts, money: null, chapters: null }).needWhere, 0, 'a refused read never counts as "needs a chapter"');
  assert.equal(bookedView({ rows, facts, money: null, chapters: [] }).booked[1]!.where?.kind, 'no_chapters');
  assert.equal(bookedView({ rows, facts, money: null }).booked[0]!.where, null, 'nobody asked → not drawn');
});

test('IN-HOUSE starts on its venue’s chapters; a change of its own sticks; a dangling id is dropped', () => {
  const follows = inHouseWhere([{ key: 'catering', label: 'Catering' }], {}, ['prep', 'rec'], CH);
  assert.deepEqual(follows, [{ key: 'catering', label: 'Catering', picked: ['prep', 'rec'], followsVenue: true }]);
  const changed = inHouseWhere([{ key: 'cake', label: 'Cake' }], { cake: ['rec', 'gone'] }, ['prep', 'rec'], CH);
  assert.deepEqual(changed[0]!.picked, ['rec']);
  assert.equal(changed[0]!.followsVenue, false);
  assert.equal(inHouseWhere([{ key: 'coordinator', label: 'Coordinator' }], {}, ['rec'], CH).length, 0, 'a coordinator is everywhere');
  assert.equal(coveredKeyOf({ label: 'Food Truck', groupId: null }), 'label:food_truck');
  assert.match(coveredKeyOf({ label: '!!!' }), /^[a-z0-9_:]{1,64}$/);
});

test('🔒 A WHERE CHANGE NOTIFIES — a booked supplier whose chapters changed; never before booking, never on no change', () => {
  const n = whereChangeNotice({ booked: true, before: ['rec'], after: ['cer', 'rec'], hostName: 'Sample Couple', afterNames: ['Ceremony', 'Reception'] });
  assert.ok(n, 'a booked supplier is told');
  assert.match(n!.title, /Sample Couple changed where you go/);
  assert.match(n!.body, /Ceremony, Reception/);
  assert.match(n!.body, /price doesn’t change by itself/, 'the price never changes by itself — said');
  assert.equal(whereChangeNotice({ booked: false, before: [], after: ['rec'], hostName: 'x', afterNames: ['Reception'] }), null, 'on the quote: nobody to tell');
  assert.equal(whereChangeNotice({ booked: true, before: ['rec', 'cer'], after: ['cer', 'rec'], hostName: 'x', afterNames: [] }), null, 'order is not a change');
  assert.match(whereChangeNotice({ booked: true, before: null, after: ['rec'], hostName: 'x', afterNames: ['Reception'], inHouse: 'Cake' })!.body, /^Cake: /);
});

test('🔒 the ONE action sends it: the database’s before/after reach the notifier, which emits the in-app type', () => {
  const action = src('app', 'dashboard', '[eventId]', 'vendors', '_actions', 'supplier-where.ts');
  assert.match(action, /\.rpc\('set_supplier_where'/, 'the one writer is the database door');
  assert.match(action, /notifySupplierWhereChanged\(\{[\s\S]*?booked: r\.booked,[\s\S]*?before: r\.before,[\s\S]*?after: r\.after/, 'the saved before/after are what decide the notice');
  const notify = src('lib', 'supplier-where-notify.server.ts');
  assert.match(notify, /whereChangeNotice\(/);
  assert.match(notify, /type: 'supplier_where_changed'/);
  const emails = src('lib', 'notification-emit.ts');
  const allow = emails.slice(emails.indexOf('EMAIL_ENABLED_TYPES'), emails.indexOf(']', emails.indexOf('EMAIL_ENABLED_TYPES')));
  assert.doesNotMatch(allow, /supplier_where_changed/, 'in the app only — never on the email allowlist');
});
