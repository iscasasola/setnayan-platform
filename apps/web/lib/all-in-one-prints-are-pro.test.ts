/**
 * all-in-one-prints-are-pro.test.ts — EVERY "DOWNLOAD ALL" IS EVENT HUB PRO; ONE AT A TIME IS FREE (owner 2026-10-16, DECISION_LOG
 * "PRINTS: ONE AT A TIME IS FREE — EVERY 'DOWNLOAD ALL' IS EVENT HUB PRO"; verbatim: *"Yes — Whole set (PDF) and Every guest's pass
 * (PDF) become Pro. Each piece's own PDF, and each guest's own pass one at a time, stay free."*).
 *
 *   1 · THE SERVER REFUSES: `/api/hub-print` is CALLED (its own GET, the I/O stood in for) — a free event asking for every guest's
 *       passes or the whole set gets 403 with the words, in Classic too, before anything is drawn; a Pro event (an internal host's
 *       counts — `printOwnsPro` is `eventSkuActive`) goes on to draw; ONE guest's pass and a piece's own PDF go on for a free event.
 *   2 · THE PAGE MARKS THEM: on Studio › Prints every all-in-one file is the zip's ◆ pattern — a free couple: the door to the one
 *       unlock page (never a page jump: the centred note); a Pro couple: the file, ◆ unlocked; the store shell without it: nothing —
 *       and the one-guest pass is a plain free Save.
 *
 * SABOTAGE (each seen RED, then restored — see the PR): the route's refusal removed · the refusal asking `printReady` (a theme rule)
 * instead of the event's Pro · the Event pass's all-guests file drawn as a plain save · one guest's pass treated as all-in-one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderSettled } from './render-settled.test-helper';
import { isAllInOnePrint } from './print-pieces';

(globalThis as unknown as { React: unknown }).React = React;

/* ── The route's I/O, stood in for: who is asking, whether the event owns Pro, and a spy on the first drawing read. ── */
const state = { ownsPro: false, drew: 0 };
{
  const Mod = require('node:module');
  const load = Mod._load;
  const stubs: Record<string, unknown> = {
    'server-only': {},
    'client-only': {},
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'host' } } }) } }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({}) },
    '@/lib/host-gate': { getHostUserId: async () => 'host' },
    '@/lib/request-platform': { isStoreShellRequest: async () => false },
  };
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request in stubs) return stubs[request];
    if (request === '@/lib/print-set.server') {
      const real = load.call(this, request, ...rest) as Record<string, unknown>;
      return {
        ...real,
        printOwnsPro: async () => state.ownsPro,
        readPrintEvent: async () => ({ event_id: EVENT, slug: 'rosa-ben', invite_theme: 'house', print_details: null }),
        loadPrintSet: async () => {
          state.drew += 1;
          return null; // → 404 "Event not found." — proof the request got PAST the gate, without drawing anything.
        },
        printInputsVersion: async () => null,
      };
    }
    return load.call(this, request, ...rest);
  };
}
const EVENT = '11111111-2222-4333-8444-555555555555';
const GUEST = '00000000-0000-4000-8000-000000000101';

async function ask(path: string, ownsPro: boolean): Promise<{ status: number; text: string; drew: boolean }> {
  const { GET } = await import('../app/api/hub-print/[piece]/route');
  state.ownsPro = ownsPro;
  state.drew = 0;
  const piece = path.split('?')[0]!;
  const res = await GET(new Request(`https://x.test/api/hub-print/${path}`), { params: Promise.resolve({ piece }) });
  return { status: res.status, text: await res.text(), drew: state.drew > 0 };
}

test('the rule: every guest’s passes and the whole set are all-in-one; a piece, one pass and the set’s sample are not', () => {
  assert.equal(isAllInOnePrint('passes', 'print'), true);
  assert.equal(isAllInOnePrint('set', 'print'), true);
  assert.equal(isAllInOnePrint('set', 'sample'), false, 'the whole set’s watermarked sample sheet stays free');
  assert.equal(isAllInOnePrint('pass', 'print'), false, 'one guest’s pass is the Event pass piece — free');
  for (const k of ['invitation', 'entourage', 'details', 'menu', 'poster', 'story-poster', 'card']) assert.equal(isAllInOnePrint(k, 'print'), false);
});

test('1 · the server refuses the all-in-one files to a free event — Classic too — and serves them to a Pro event', async () => {
  for (const path of [
    `passes?event=${EVENT}&mode=print&theme=house&pass_format=calling-card`,
    `passes?event=${EVENT}&mode=print&theme=house&pass_format=phone-card`,
    `set?event=${EVENT}&mode=print&theme=house`,
  ]) {
    const free = await ask(path, false);
    assert.equal(free.status, 403, `${path}: a free event is not refused`);
    assert.match(free.text, /Event Hub Pro/, `${path}: the refusal does not say why`);
    assert.doesNotMatch(free.text, /₱|PHP\s?\d/, 'a price in the refusal');
    assert.equal(free.drew, false, `${path}: something was drawn before the refusal`);
    const pro = await ask(path, true);
    assert.notEqual(pro.status, 403, `${path}: a Pro event is refused`);
    assert.equal(pro.drew, true, `${path}: a Pro event does not reach the drawing`);
  }
});

test('1b · …and ONE guest’s pass, a piece’s own PDF and the set’s sample stay free', async () => {
  for (const path of [
    `pass?event=${EVENT}&mode=print&theme=house&pass_format=train&pass_guest=${GUEST}`,
    `invitation?event=${EVENT}&mode=print&theme=house`,
    `set?event=${EVENT}&mode=sample&theme=house`,
  ]) {
    const free = await ask(path, false);
    assert.notEqual(free.status, 403, `${path}: a free event is refused a free file`);
    assert.equal(free.drew, true, `${path}: a free event does not reach the drawing`);
  }
});

test('2 · Studio › Prints marks every all-in-one file with the zip’s ◆ pattern; one guest’s pass is a plain free Save', async () => {
  const L = '../app/dashboard/[eventId]/launch/_components';
  const { PrintPieceEditor, PrintSetDownloads, PassCardsPanel } = await import(`${L}/maker-prints`);
  const { formatFor } = await import('./print-pieces');
  const draw = async (ownsPro: boolean, storeShell: boolean) => {
    const input = {
      eventId: 'E1', slug: 'rosa-ben', theme: 'house', ownsPro, storeShell,
      formats: { pass: formatFor('pass', 'train')!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! },
      passGuests: [{ id: GUEST, name: 'Ana Reyes', reply: 'attending' as const }, { id: '00000000-0000-4000-8000-000000000102', name: 'Ben Cruz', reply: 'pending' as const }],
    };
    const pass = await renderSettled(React.createElement(PrintPieceEditor as never, { input, piece: 'pass', studio: true } as never));
    const set = await renderSettled(React.createElement(PrintSetDownloads as never, { input, studio: true } as never));
    const cards = await renderSettled(React.createElement(PassCardsPanel as never, { input, studio: true } as never));
    return { pass, set, cards };
  };
  const free = await draw(false, false);
  /* A free couple: the all-guests file, the whole set, every guest's ticket and the printed batch are the ◆ door — nothing to save. */
  assert.match(free.pass, /data-print-all-in-one-pro=""[\s\S]*?Every guest’s pass \(PDF\)/, 'a free couple is handed every guest’s pass');
  assert.doesNotMatch(free.pass, /data-print-save="rosa-ben-passes\.pdf"/, 'a free couple can save every guest’s pass');
  assert.doesNotMatch(free.set, /data-print-save="rosa-ben-(?:set|passes)\.pdf"/, 'a free couple can save the whole set or every ticket');
  assert.equal((free.set.match(/data-print-all-in-one-pro=""/g) ?? []).length, 2, 'the whole set and every ticket are not the ◆ door');
  assert.match(free.cards, /data-pass-cards-print=""[\s\S]*?data-print-all-in-one-pro=""/, 'the printed ticket batch is not the ◆ door');
  for (const h of [free.pass, free.set, free.cards]) {
    assert.match(h, /data-paid-mark="try"/, 'a free couple is not shown ◆ PRO');
    assert.doesNotMatch(h, /data-paid-mark="locked"/, 'a padlock');
  }
  /* …one guest's pass is a plain Save — free — named for the guest, in the size picked. */
  assert.match(free.pass, /data-print-one-pass=""[\s\S]*?Ana Reyes[\s\S]*?data-print-save="rosa-ben-pass-ana-reyes\.pdf"/, 'one guest’s pass is not a free Save');
  /* A Pro couple (an internal host's event reads as owned): the files themselves, ◆ unlocked. */
  const pro = await draw(true, false);
  assert.match(pro.pass, /data-print-save="rosa-ben-passes\.pdf"/, 'a Pro couple cannot save every guest’s pass');
  assert.match(pro.set, /data-print-save="rosa-ben-set\.pdf"/);
  assert.match(pro.pass, /data-paid-mark="unlocked"/);
  assert.doesNotMatch(pro.pass + pro.set + pro.cards, /data-print-all-in-one-pro/, 'a Pro couple is sent to the unlock page');
  /* The store shell without Pro: no door, no file — the purchase hint is absent. */
  const shell = await draw(false, true);
  assert.doesNotMatch(shell.pass + shell.set + shell.cards, /data-print-all-in-one-pro|rosa-ben-passes\.pdf|rosa-ben-set\.pdf|data-paid-mark/);
  assert.match(shell.pass, /data-print-one-pass=""/, 'one guest’s pass is gone from the store shell too');
});
