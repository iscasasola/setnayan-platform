/**
 * the-messages-fold-left-no-control-behind.test.ts — 🔒 THE EVENT LIST IS THE MESSAGES, AND EVERY CONTROL THE MESSAGES
 * FOLD HELD STILL HAS A HOME; A BOOKED-OUTSIDE CUSTOMER HOLDS THEIR ONE-TIME CODE.
 *
 * Owner 2026-10-28 (DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE", "SUPPLIER CUSTOMERS
 * ARE LISTED BY EVENT, NOT BY PERSON", "THREE KINDS OF CHAT"): Customers › People lists one row per event and each row
 * opens its chat full screen — so the separate Messages fold went. What only it held:
 *
 *   the per-chat archive toggle      → each chat's ⋮ menu ("Archive this chat") + Unarchive in "Archived and closed chats"
 *   the Archived list (+ its pager)  → "Archived and closed chats" at the foot of People (`opage`)
 *   declined / released / withdrawn  → the same fold, each saying why — no chat becomes unreachable
 *   the won/lost roll-up             → the same fold (`InquiryOutcomesRollup`)
 *
 * And the outside booking's one-time code: Linked / Code sent / Not linked from `vendor_locked_qr_tokens.block_id`
 * (migration `locked_qr_names_its_outside_booking`), "Send their code" opening the shipped maker with the booking
 * named, offered right after Add (the import comes back with `?block=`).
 *
 * Sabotage log (2026-10-28, each reverted): `messages` put back in FOLD_KEYS → 1 red · the `archive=` prop dropped from
 * the supplier thread's ⋮ → 2 red · `others` filtered to archived only → 3 red · a refused codes read mapped to
 * `{ state: 'none' }` → 5 red · `block_id` dropped from the insert → 6 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { foldsOf, CUSTOMER_SEGMENTS } from './segments';
import { CUSTOMER_LANDINGS } from './anchors';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const VD = join(HERE, '..');
const code = (...rel: string[]) => stripComments(readFileSync(join(VD, ...rel), 'utf8'));
const PAGE = code('customers', 'page.tsx');
const MORE = code('customers', '_components', 'people-more.tsx');
const THREAD = code('messages', '[threadId]', 'page.tsx');
const MENU = stripComments(readFileSync(join(VD, '..', '_components', 'chat-thread-menu.tsx'), 'utf8'));

test('1 · Messages is not a fold any more, on any view — and its landing is People’s own list', () => {
  for (const seg of CUSTOMER_SEGMENTS) assert.ok(!foldsOf(seg).includes('messages'), `Messages is a fold on ${seg} again`);
  assert.doesNotMatch(PAGE, /MessagesSurface|key: 'messages'/, 'the Messages fold is back on the Customers page');
  assert.equal(existsSync(join(VD, 'messages', 'surface.tsx')), false, 'the retired Messages surface came back');
  assert.deepEqual(CUSTOMER_LANDINGS.messages, { seg: 'people', fold: null, anchor: '#customers' }, 'a Messages link does not land on the list');
  assert.match(PAGE, /<div id="customers" className="min-w-0 scroll-mt-24" data-customers-people="">/, 'People has no #customers list to land on');
});

test('2 · archive moved INTO the chat — ⋮ › Archive this chat / Move back to your list, the shipped actions', () => {
  assert.match(MENU, /archive\?: \{ archived: boolean; returnTo: string \} \| null;/);
  assert.match(MENU, /<form action=\{archive\.archived \? unarchiveThread : archiveThread\}>/, 'the chat menu does not post the shipped archive actions');
  assert.match(MENU, /Archive this chat/);
  assert.match(MENU, /Move back to your list/);
  assert.match(THREAD, /<ChatThreadMenu[\s\S]{0,200}archive=\{threadArchive\}/, 'the supplier’s chat does not offer Archive');
  // ⚠ Unread → no archive item at all (never one that claims the wrong state).
  assert.match(THREAD, /const threadArchive = archiveMarkError\s*\?\s*null/, 'a refused archive read still offers an archive item');
});

test('3 · every chat not on the list is reachable — archived and closed, each saying why, Unarchive on the archived', async () => {
  // The page lists EVERY thread that is not a row — not only the archived ones.
  assert.match(PAGE, /const others: OtherChat\[\] = threads\s*\.filter\(\(t\) => !listedThreads\.has\(t\.thread_id\)\)/, 'a closed chat has no home');
  for (const why of ['Archived', 'They withdrew', 'They booked someone else', 'You turned it down', 'An older chat on this event']) {
    assert.ok(PAGE.includes(`'${why}'`), `a chat no longer says why it is here: ${why}`);
  }
  assert.match(PAGE, /<OtherChatsFold\b[\s\S]{0,300}rollup=\{<InquiryOutcomesRollup rollup=\{outcomeRollup\} \/>\}/, 'the won/lost roll-up has no home');
  assert.match(PAGE, /const othersPage = paginate\(others, search\.opage\)/, 'the other chats are not paged');
  // Rendered: each opens its chat, the archived one carries the shipped Unarchive.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { OtherChatsFold } = await import('./_components/people-more');
  const items = [
    { threadId: 'ta', title: 'Bea’s Birthday (Nov 28)', why: 'Archived', archived: true },
    { threadId: 'td', title: 'Carlo’s Wedding (Jan 9, 2027)', why: 'You turned it down', archived: false },
  ];
  const html = renderToStaticMarkup(
    React.createElement(OtherChatsFold, {
      paged: { items, page: 1, pageCount: 1, total: 2, start: 1, end: 2 },
      keepParams: '',
      returnTo: '/vendor-dashboard/customers?door=talking',
    } as never),
  );
  assert.match(html, /href="\/vendor-dashboard\/messages\/ta"/);
  assert.match(html, /href="\/vendor-dashboard\/messages\/td"/, 'a closed chat does not open');
  assert.equal((html.match(/aria-label="Unarchive conversation"/g) ?? []).length, 1, 'Unarchive is not on exactly the archived chat');
  assert.match(MORE, /<ListPager paged=\{paged\} param="opage"/);
});

test('4 · an archived chat leaves Talking / Holding — never a row that waits on the shop, never a booking', () => {
  const at = PAGE.indexOf('const archivedOff = new Set<string>();');
  const block = PAGE.slice(at, PAGE.indexOf('const listed = derived.filter', at));
  assert.ok(at > 0 && block.length > 40, 'the archive split is gone');
  assert.match(block, /if \(r\.lane !== 'talking' && r\.lane !== 'holding'\) continue;/, 'an archive can hide a customer who is waiting, booked or done');
});

test('5 · their one-time code: Not linked · Code sent · Linked — and a refused read is never "Not linked"', async () => {
  // The page: ONE read for the page's outside rows, keyed by block; refused → every row `unread`.
  assert.match(PAGE, /\.from\('vendor_locked_qr_tokens'\)[\s\S]{0,200}\.in\('block_id', pageBlockIds\)/, 'the codes are not read for the outside rows');
  assert.match(PAGE, /code: codesMeasured \? \(codeByBlock\.get\(c\.blockId\) \?\? \(\{ state: 'none' \} as const\)\) : \(\{ state: 'unread' \} as const\)/, 'a refused codes read shows a state');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { OutsideClientRows } = await import('./_components/people-more');
  const c = (blockId: string, code: unknown) => ({ blockId, name: blockId, startDate: '2026-10-17', endDate: '2026-10-17', schedule: 'Main team', contact: null, note: null, code });
  const items = [
    c('b-none', { state: 'none' }),
    c('b-sent', { state: 'sent', token: 'tok', madeAt: '2026-09-20T03:00:00Z' }),
    c('b-linked', { state: 'linked', usedAt: '2026-10-01T03:00:00Z' }),
    c('b-unread', { state: 'unread' }),
  ];
  const html = renderToStaticMarkup(
    React.createElement(OutsideClientRows, {
      paged: { items, page: 1, pageCount: 1, total: 4, start: 1, end: 4 },
      incomplete: false,
      keepParams: '',
      removeBlock: async () => {},
      headed: false,
      nowMs: Date.UTC(2026, 9, 2, 2),
      openBlock: 'b-none',
    } as never),
  );
  const row = (id: string) => {
    const at = html.indexOf(`data-outside-code="${id === 'b-none' ? 'none' : id === 'b-sent' ? 'sent' : id === 'b-linked' ? 'linked' : 'unread'}"`);
    assert.ok(at > -1, `${id} row is missing`);
    return html.slice(at, html.indexOf('data-outside-row', at + 10) > 0 ? html.indexOf('data-outside-row', at + 10) : html.length);
  };
  assert.match(row('b-none'), />Not linked</);
  assert.match(row('b-none'), /href="\/vendor-dashboard\/invite\?mode=locked&amp;date=2026-10-17&amp;block=b-none"[^>]*>[\s\S]*Send their code/, 'Not linked does not offer Send their code (with the booking named)');
  assert.match(row('b-sent'), />Code sent</);
  assert.match(row('b-sent'), /href="\/vendor-dashboard\/invite\?mode=locked&amp;issued=tok&amp;block=b-sent"/, 'Code sent does not offer the same code again');
  assert.match(row('b-linked'), />Linked</);
  assert.doesNotMatch(row('b-linked'), /Send their code|Send again/, 'a used code offers another');
  const unread = row('b-unread');
  assert.doesNotMatch(unread, /Not linked|Send their code/, 'a refused read claims "Not linked"');
  assert.match(unread, /couldn(&#x27;|’|&rsquo;)t check their one-time code/, 'a refused read does not say so');
});

test('6 · the code names its booking end to end — offered right after Add, carried by the maker, stored on the token', () => {
  const CAL = code('calendar', 'actions.ts');
  assert.match(CAL, /const newBlock = \(data as \{ block_id\?: string \} \| null\)\?\.block_id \?\? null;/, 'Add does not hand back the new booking');
  assert.match(CAL, /if \(block\) params\.set\('block', block\);/, 'People is not told which booking was just added');
  assert.match(PAGE, /openBlock=\{search\.block \?\? null\}/, 'the new booking’s row does not open with its code');
  assert.match(PAGE, /: search\.block\s*\? 'booked'/, 'a new outside booking does not open the Booked door');
  const GEN = code('invite', '_components', 'locked-qr-generator.tsx');
  assert.match(GEN, /\{blockId \? <input type="hidden" name="block_id" value=\{blockId\} \/> : null\}/, 'the maker drops the booking');
  const ISSUE = code('invite', 'actions.ts');
  assert.match(ISSUE, /block_id: blockId,/, 'the code is stored without its booking');
  assert.match(ISSUE, /const fail: \(reason: string\) => never = \(reason\) => failTo\(reason, blockId\);/, 'a refusal forgets the booking');
});
