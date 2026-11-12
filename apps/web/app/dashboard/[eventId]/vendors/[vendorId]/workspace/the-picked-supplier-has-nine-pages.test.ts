/**
 * 🪞 THE HOST'S PICKED SUPPLIER HAS NINE PAGES — in the supplier's order, opening on Chat, ending on Report, and no page
 * is ever blank (owner 11 Nov 2026: *"Clients side is not fixed also. There is also no report."*; the supplier's side is
 * PR #7483, held by `vendor-dashboard/clients/[eventId]/the-picked-client-has-nine-pages.test.ts`).
 *
 *   1. The order is DERIVED from the supplier's menu (`PICKED_CLIENT_PAGES`), with Inspiration where the supplier has Hub:
 *      Chat · Details · Quotation · Payment · Forms · Schedule · Files · Inspiration · Report — never hand-copied, so
 *      the two can never drift. The words of every shared page are the supplier's own.
 *   2. A door that names no page opens the menu's FIRST page: Chat with a conversation, Details without one (a Chat
 *      that can only be blank is not offered). Every old `?tab=` still lands.
 *   3. Report is on every menu, and it is the host's shipped Report a problem — the Disputes form (`NewFlagForm`, action
 *      `fileForceMajeureFlag`) drawn open and about this supplier; the (+)'s rows follow this menu's order too.
 *   4. Quotation and Forms never render nothing: each card hands back the page's empty line where it used to return
 *      null, and the empty line is one sentence plus the one action (ask in the chat) — none without a chat.
 *
 * SABOTAGE (11 Nov 2026, each run once — break → red → restore → green):
 *   · `{ id: 'report', … }` moved above Inspiration in PICKED_SUPPLIER_PAGES → 1 RED;
 *   · `defaultPickedSupplierPage` returning 'details' → 2 RED;
 *   · `if (proposals.length === 0) return null;` back in VendorProposalsCard → 4 RED;
 *   · `if (questionnaire.rows.length === 0) return null;` back in SupplierQuestionsCard → 4 RED;
 *   · (11 Nov, the approved prototype) Inspiration's line deleted from PICKED_SUPPLIER_WHO → 5 RED.
 *   5. Every page but Chat opens with the approved prototype's "Who can do what" strip; the host's (+) phone picker is
 *      "Photos & files" like the supplier's; the empty lines are the prototype's words.
 *
 * Run: cd apps/web && npx tsx --test 'app/dashboard/*\/vendors/*\/workspace/the-picked-supplier-has-nine-pages.test.ts'
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import { NEGOTIATE_GROUP, PLUS_ROW_PAGE, hostPlusRows } from '@/lib/chat-plus';
import { PICKED_CLIENT_PAGES } from '@/app/vendor-dashboard/clients/[eventId]/_components/picked-client-menu';
import {
  PICKED_SUPPLIER_PAGES,
  PICKED_SUPPLIER_PAGE_IDS,
  defaultPickedSupplierPage,
  pickedSupplierMenuFor,
  visiblePickedSupplierPage,
  type PickedSupplierPage,
} from './_components/picked-supplier-menu';
import { PickedSupplierEmpty } from './_components/picked-supplier-empty';

(globalThis as unknown as { React: unknown }).React = React;

/* ── `server-only` shim (the shape of lib/a-crew-tag-reaches-the-suppliers-day.test.ts) — the cards are server code ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const CjsModule = (createRequire(import.meta.url)('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = join(process.cwd(), '__server_only_stub_picked_supplier__.js');
{
  const stub = new CjsModule(SERVER_ONLY_STUB);
  stub.filename = SERVER_ONLY_STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[SERVER_ONLY_STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SERVER_ONLY_STUB;
    return originalResolve.call(this, request, ...rest);
  };
}

let SupplierQuestionsCard: typeof import('./_components/supplier-questions-card').SupplierQuestionsCard;
let SupplierFormsCard: typeof import('./_components/supplier-forms-card').SupplierFormsCard;
let VendorProposalsCard: typeof import('./_components/vendor-proposals-card').VendorProposalsCard;
before(async () => {
  ({ SupplierQuestionsCard } = await import('./_components/supplier-questions-card'));
  ({ SupplierFormsCard } = await import('./_components/supplier-forms-card'));
  ({ VendorProposalsCard } = await import('./_components/vendor-proposals-card'));
});

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

const MENUS = [
  pickedSupplierMenuFor({ quote: true, chat: true }),
  pickedSupplierMenuFor({ quote: true, chat: false }),
  pickedSupplierMenuFor({ quote: false, chat: true }),
  pickedSupplierMenuFor({ quote: false, chat: false }),
];

test('1 · the order is the supplier’s, Inspiration where the supplier has Hub — derived, never hand-copied', () => {
  const mirrored = PICKED_CLIENT_PAGES.map((p) => (p.id === 'hub' ? 'inspiration' : p.id));
  assert.deepEqual(PICKED_SUPPLIER_PAGES.map((p) => p.id), mirrored, 'the host’s picked supplier no longer follows the supplier’s menu');
  assert.deepEqual([...PICKED_SUPPLIER_PAGE_IDS], mirrored, 'the page ids and the menu disagree');
  assert.deepEqual(
    PICKED_SUPPLIER_PAGES.map((p) => p.label),
    ['Chat', 'Details', 'Quotation', 'Payment', 'Forms', 'Schedule', 'Files', 'Inspiration', 'Report'],
  );
  for (const p of PICKED_SUPPLIER_PAGES) {
    const theirs = PICKED_CLIENT_PAGES.find((c) => c.id === p.id);
    if (theirs) assert.equal(p.label, theirs.label, `'${p.id}' is called something else on the supplier’s side`);
  }
  assert.equal(PICKED_SUPPLIER_PAGES.at(-1)!.id, 'report', 'Report is not the last page');
});

test('2 · a door that names no page opens the first one: Chat with a conversation, Details without', () => {
  const full = MENUS[0]!;
  const noChat = MENUS[1]!;
  assert.equal(defaultPickedSupplierPage(full), 'chat');
  assert.equal(defaultPickedSupplierPage(noChat), 'details');
  for (const menu of MENUS) assert.equal(defaultPickedSupplierPage(menu), menu[0]!.id, 'the default page is not the first tab');
  assert.equal(visiblePickedSupplierPage(null, full), 'chat');
  assert.equal(visiblePickedSupplierPage(undefined, full), 'chat');
  assert.equal(visiblePickedSupplierPage('nonsense', full), 'chat');
  assert.equal(visiblePickedSupplierPage(null, noChat), 'details');
  assert.equal(visiblePickedSupplierPage('chat', noChat), 'details', 'a Chat that can only be blank was drawn');
  // Every old door still lands where it meant.
  const lands: Array<[string, PickedSupplierPage]> = [
    ['details', 'details'], ['overview', 'details'], ['call', 'chat'], ['quote', 'quote'], ['quotation', 'quote'],
    ['payments', 'payments'], ['payment', 'payments'], ['forms', 'forms'], ['form', 'forms'], ['schedule', 'schedule'],
    ['files', 'files'], ['documents', 'files'], ['inspiration', 'inspiration'], ['report', 'report'], ['disputes', 'report'],
  ];
  for (const [tab, page] of lands) assert.equal(visiblePickedSupplierPage(tab, full), page, `?tab=${tab}`);
  // Quotation for a supplier the host added themselves (no quote can come) → the first page, never a blank Quotation.
  assert.equal(visiblePickedSupplierPage('quote', MENUS[3]!), 'details');
});

test('3 · Report is on every menu, and it is the shipped Report a problem about THIS supplier', () => {
  for (const menu of MENUS) assert.equal(menu.at(-1)?.id, 'report', 'a picked supplier without Report');
  const ws = read('page.tsx');
  assert.match(ws, /report: <ReportSupplierPage eventId=\{eventId\} eventVendorId=\{ev\.vendor_id\} supplierName=\{displayName\} \/>/);
  const page = read('_components/report-supplier-page.tsx');
  assert.match(page, /<NewFlagForm eventId=\{eventId\} supplier=\{\{ id: eventVendorId, name: supplierName \}\}/, 'Report is not the shipped Disputes form');
  const parts = stripComments(readFileSync(join(HERE, '..', '..', '..', 'disputes', '_components', 'dispute-parts.tsx'), 'utf8'));
  assert.match(parts, /action=\{fileForceMajeureFlag\}/, 'the form no longer files through the shipped action');
  assert.match(parts, /<input type="hidden" name="event_vendor_id" value=\{supplier\.id\} \/>/, 'the report is not pinned to the supplier');
  // The host's (+) rows sit under pages of THIS menu, in its order, Report last.
  const order = PICKED_SUPPLIER_PAGES.map((p) => p.id as string);
  for (const canLogPayment of [true, false]) {
    // 🤝 The Negotiate group (12 Nov) heads the (+) above every page — it is not a page of this menu (chat-plus.test 8 holds it first).
    const ranks = hostPlusRows({ canLogPayment })
      .filter((r) => PLUS_ROW_PAGE[r.key] !== NEGOTIATE_GROUP)
      .map((r) => order.indexOf(PLUS_ROW_PAGE[r.key] as string));
    assert.ok(ranks.every((r) => r >= 0), 'a host (+) row sits under a page the picked supplier does not have');
    for (let i = 1; i < ranks.length; i++) assert.ok(ranks[i]! >= ranks[i - 1]!, 'the host’s (+) runs against its menu’s order');
    assert.equal(hostPlusRows({ canLogPayment }).at(-1)!.key, 'report');
  }
});

/** A stand-in client whose every read answers "nothing": the empty case, the one that used to draw a blank page. */
function emptyClient(): SupabaseClient {
  const chain: Record<string, unknown> = {};
  const answer = { data: [], error: null };
  for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit']) chain[m] = () => chain;
  chain.maybeSingle = async () => ({ data: null, error: null });
  chain.single = async () => ({ data: null, error: null });
  chain.then = (ok: (v: unknown) => unknown, no?: (e: unknown) => unknown) => Promise.resolve(answer).then(ok, no);
  return { from: () => chain } as unknown as SupabaseClient;
}

test('4 · Quotation and Forms never render nothing — the line and its one action', async () => {
  const LINE = React.createElement('p', null, 'EMPTY-LINE');
  const ids = { supabase: emptyClient(), eventId: 'e1', eventVendorId: 'v1', vendorProfileId: 'p1', shopName: 'Lumière' };
  // Forms: no questions asked, no form sent → the forms card holding the line; then the forms card → the line.
  const q = (await SupplierQuestionsCard({ ...ids, whenEmpty: LINE })) as React.ReactNode;
  assert.equal(q, LINE, 'the questions card draws nothing instead of the page’s empty line');
  const f = (await SupplierFormsCard({ ...ids, whenEmpty: LINE })) as React.ReactNode;
  assert.equal(f, LINE, 'the forms card draws nothing instead of the page’s empty line');
  // Quotation: no shop to send one → the line (the read path is the request-scoped client; held by source below).
  assert.equal(await VendorProposalsCard({ eventId: 'e1', marketplaceVendorId: null, displayName: 'Lumière', whenEmpty: LINE }), LINE);
  const proposals = read('_components/vendor-proposals-card.tsx');
  const body = proposals.slice(proposals.indexOf('export async function VendorProposalsCard'), proposals.indexOf('return (', proposals.indexOf('export async function VendorProposalsCard')));
  assert.doesNotMatch(body, /return null;/, 'VendorProposalsCard returns nothing again — the blank Quotation');
  assert.match(body, /if \(proposals\.length === 0\) return whenEmpty;/);
  const questions = read('_components/supplier-questions-card.tsx');
  const qFn = questions.slice(questions.indexOf('export async function'), questions.indexOf('\n}\n', questions.indexOf('export async function')));
  assert.doesNotMatch(qFn, /return null;/, 'the questions card returns nothing again — the blank Forms');
  // (the forms card's only other `return null` is inside a media link's map — a missing file, not the page)
  assert.match(read('_components/supplier-forms-card.tsx'), /if \(ids\.length === 0\) return whenEmpty;/, 'the forms card returns nothing again — the blank Forms');
  // The page hands each card its line: Quotation's, and Forms' only after BOTH the questions and the forms are empty.
  const ws = read('page.tsx');
  assert.match(ws, /whenEmpty=\{quotationEmpty\}/, 'the Quotation page hands its card no empty line');
  assert.match(ws, /whenEmpty=\{formsCardFor\(ev\.marketplace_vendor_id, formsEmpty\)\}\s*>\s*\{formsCardFor\(ev\.marketplace_vendor_id, null\)\}/);
  assert.match(ws, /\{formsPage \?\? \(/, 'the Forms page no longer draws the composed forms');
  // The line: one sentence and one action that opens the chat — and no action without a chat.
  const withChat = renderToStaticMarkup(React.createElement(PickedSupplierEmpty, { page: 'quote', line: 'No quotation from Lumière yet.', ask: 'Ask for one in the chat' }));
  assert.match(withChat, /No quotation from Lumière yet\./);
  assert.match(withChat, /data-picked-supplier-empty-ask=""[^>]*>Ask for one in the chat ›</);
  assert.match(withChat, /min-h-11/, 'the action is under the 44-px floor');
  const noChat = renderToStaticMarkup(React.createElement(PickedSupplierEmpty, { page: 'forms', line: 'No forms from Lumière yet.', ask: null }));
  assert.match(noChat, /No forms from Lumière yet\./);
  assert.doesNotMatch(noChat, /data-picked-supplier-empty-ask/, 'an action with no chat to open — a dead control');
});

test('5 · every page but Chat opens with who can do what — the approved prototype’s strip — and the (+) is its mirror', async () => {
  const { PICKED_SUPPLIER_WHO, PickedSupplierWho } = await import('./_components/picked-supplier-who');
  // One line per page, Chat excepted (both sides write) — a new page cannot ship without saying who does what on it.
  assert.deepEqual(
    Object.keys(PICKED_SUPPLIER_WHO).sort(),
    PICKED_SUPPLIER_PAGE_IDS.filter((p) => p !== 'chat').sort(),
    'a picked-supplier page has no who-can-do-what line',
  );
  for (const [page, w] of Object.entries(PICKED_SUPPLIER_WHO)) {
    const html = renderToStaticMarkup(React.createElement(PickedSupplierWho, { page: page as never, supplierName: 'Lumière' }));
    assert.match(html, /Who can do what/, `${page}: the strip lost its heading`);
    assert.ok(html.includes(`You · <b class="font-bold">${w.you}</b>`), `${page}: no "You ·" pill`);
    assert.ok(html.includes(`Lumière · <b class="font-bold">${w.them}</b>`), `${page}: no supplier pill`);
    assert.doesNotMatch(w.note('Lumière'), /proposed|not built|today/i, `${page}: the ⓘ describes something the page does not do`);
  }
  // The workspace wraps every non-blank page but Chat in the strip — a blank page stays blank (never a lone strip).
  const ws = read('page.tsx');
  assert.match(
    ws,
    /page === 'chat' \|\| body == null \? \(\s*body\s*\) : \(\s*<div className="space-y-4">\s*<PickedSupplierWho page=\{page\} supplierName=\{displayName\} \/>\s*\{body\}/,
    'the pages are not each topped by the strip',
  );
  assert.match(ws, /bodies=\{pickedPages\}/, 'the shell draws the pages without the strip');
  // The (+): ONE phone picker named like the supplier's — "Photos & files" — and the empty lines are the prototype's.
  const host = hostPlusRows({ canLogPayment: true });
  assert.equal(host.find((r) => r.key === 'file')?.label, 'Photos & files', 'the host’s phone picker is not named like the supplier’s');
  assert.ok(!host.some((r) => r.label === 'File' || r.label === 'Photo'), 'a second phone picker on the host’s (+)');
  assert.match(ws, /No quote from \$\{displayName\} yet\. A quote is sent inside your conversation\./);
  assert.match(ws, /\$\{displayName\} hasn’t sent you a form yet\. Their questions land here when they do\./);
});
