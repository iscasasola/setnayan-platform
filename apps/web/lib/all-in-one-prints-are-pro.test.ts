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
 * 🗂 2026-10-17 (DECISION_LOG "PRINTS: ONE SETTINGS SHEET, ONE DOWNLOAD PER PIECE, VIEW AS ▾ ON GUEST PRINTS, ALL GUESTS ◆,
 * EVERYTHING ◆"): the Guest QR sheet, the place-card pack and Everything are all-in-one files too; every guest print's "All guests"
 * wears the ◆ pattern, and its Download (one guest) is a plain free Save. "Pass for ▾" is retired — View as ▾ picks the guest.
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
  /* 2026-10-17: every guest's QR, every place card and Everything — the sheet's on-screen picture stays free. */
  assert.equal(isAllInOnePrint('qr-codes', 'sample'), true, 'the QR sheet’s PDF (asked with no mode) is not all-in-one');
  assert.equal(isAllInOnePrint('qr-codes', 'print'), true);
  assert.equal(isAllInOnePrint('qr-codes', 'screen'), false, 'the QR sheet’s picture is refused');
  assert.equal(isAllInOnePrint('seating-pack', 'print'), true);
  assert.equal(isAllInOnePrint('everything', 'print'), true);
  assert.equal(isAllInOnePrint('guest-registry', 'print'), false, 'the registry is not a guest’s file — it stays free');
});

test('1 · the server refuses the all-in-one files to a free event — Classic too — and serves them to a Pro event', async () => {
  for (const path of [
    `passes?event=${EVENT}&mode=print&theme=house&pass_format=calling-card`,
    `passes?event=${EVENT}&mode=print&theme=house&pass_format=phone-card`,
    `set?event=${EVENT}&mode=print&theme=house`,
    `everything?event=${EVENT}&mode=print&theme=house`,
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

test('1c · every guest’s QR in one file is refused to a free event; its on-screen picture is not', async () => {
  const free = await ask(`qr-codes?event=${EVENT}`, false);
  assert.equal(free.status, 403, 'a free event is handed every guest’s QR');
  assert.match(free.text, /Every guest’s QR in one file is Event Hub Pro/);
  const picture = await ask(`qr-codes?event=${EVENT}&mode=screen`, false).catch(() => ({ status: 0, text: '', drew: false }));
  assert.notEqual(picture.status, 403, 'the QR sheet’s picture is refused to a free event');
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

test('2 · Studio › Prints marks every all-in-one file with the zip’s ◆ pattern; one guest’s file is a plain free Download', async () => {
  const L = '../app/dashboard/[eventId]/launch/_components';
  const { PrintPieceEditor, PrintEverythingStudio, DigitalTicketEditor, PrintSetDownloads, PassCardsPanel, freePrintParts } = await import(`${L}/maker-prints`);
  const { formatFor } = await import('./print-pieces');
  const draw = async (ownsPro: boolean, storeShell: boolean) => {
    const input = {
      eventId: 'E1', slug: 'rosa-ben', theme: 'house', ownsPro, storeShell,
      formats: { pass: formatFor('pass', 'train')!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! },
      passGuests: [{ id: GUEST, name: 'Ana Reyes', reply: 'attending' as const }, { id: '00000000-0000-4000-8000-000000000102', name: 'Ben Cruz', reply: 'pending' as const }],
      passCardsZip: 'rosa-ben-tickets.zip',
    };
    const pass = await renderSettled(React.createElement(PrintPieceEditor as never, { input, piece: 'pass', studio: true } as never));
    const everything = await renderSettled(React.createElement(PrintEverythingStudio as never, { input } as never));
    const ticket = await renderSettled(React.createElement(DigitalTicketEditor as never, { input } as never));
    const free = (freePrintParts as (...a: unknown[]) => Array<{ key: string; editor: React.ReactNode }>)('E1', 'rosa-ben', input, true);
    const day = await renderSettled(React.createElement(React.Fragment, null, ...free.filter((f) => f.key === 'qr-codes' || f.key === 'seating-pack').map((f) => React.createElement(React.Fragment, { key: f.key }, f.editor))));
    /* The shipped Details (the flag off) — its own all-in-one buttons, the same ◆ pattern. */
    const set = await renderSettled(React.createElement(PrintSetDownloads as never, { input } as never));
    const cards = await renderSettled(React.createElement(PassCardsPanel as never, { input } as never));
    const shippedDay = await renderSettled(React.createElement(React.Fragment, null, ...(freePrintParts as (...a: unknown[]) => Array<{ key: string; editor: React.ReactNode }>)('E1', 'rosa-ben', input).filter((f) => f.key === 'qr-codes' || f.key === 'seating-pack').map((f) => React.createElement(React.Fragment, { key: f.key }, f.editor))));
    return { pass, everything, ticket, day, set, cards, shippedDay };
  };
  const free = await draw(false, false);
  /* A free couple: All guests (pass · ticket · QR · place cards), Everything and the shipped all-in-one files are the ◆ door. */
  for (const [k, h] of Object.entries({ pass: free.pass, ticket: free.ticket, everything: free.everything })) {
    assert.match(h, /data-print-all-in-one-pro=""/, `${k}: a free couple is handed the all-in-one file`);
    assert.match(h, /data-paid-mark="try"/, `${k}: a free couple is not shown ◆ PRO`);
    assert.doesNotMatch(h, /data-paid-mark="locked"/, 'a padlock');
  }
  assert.equal((free.day.match(/data-print-all-in-one-pro=""/g) ?? []).length, 2, 'every guest’s QR and every place card are not the ◆ door');
  assert.doesNotMatch(free.pass + free.everything + free.day, /data-print-save="rosa-ben-(?:passes|everything|qr-codes|seating-pack)\.pdf"|data-print-save="rosa-ben-tickets\.zip"/, 'a free couple can save an all-in-one file');
  assert.equal((free.set.match(/data-print-all-in-one-pro=""/g) ?? []).length, 2, 'shipped: the whole set and every ticket are not the ◆ door');
  assert.match(free.cards, /data-pass-cards-print=""[\s\S]*?data-print-all-in-one-pro=""/, 'shipped: the printed ticket batch is not the ◆ door');
  assert.equal((free.shippedDay.match(/data-print-all-in-one-pro=""/g) ?? []).length, 2, 'shipped: every guest’s QR and the pack are not the ◆ door');
  /* …one guest's file is a plain Download — free — named for the guest, in the size picked. */
  assert.match(free.pass, /data-print-save="rosa-ben-pass-ana-reyes\.pdf"/, 'one guest’s pass is not a free Download');
  assert.match(free.ticket, /data-print-save="rosa-ben-ticket-ana-reyes\.png"/, 'one guest’s ticket is not a free Download');
  assert.match(free.day, /data-print-save="rosa-ben-qr-ana-reyes\.png"/, 'one guest’s QR is not a free Download');
  assert.match(free.day, /data-print-save="rosa-ben-place-card-ana-reyes\.pdf"/, 'one guest’s place card is not a free Download');
  /* A Pro couple (an internal host's event reads as owned): the files themselves, ◆ unlocked. */
  const pro = await draw(true, false);
  assert.match(pro.pass, /data-print-save="rosa-ben-passes\.pdf"/, 'a Pro couple cannot save every guest’s pass');
  assert.match(pro.everything, /data-print-save="rosa-ben-everything\.pdf"/, 'a Pro couple cannot save everything');
  assert.match(pro.ticket, /data-print-save="rosa-ben-tickets\.zip"/);
  assert.match(pro.day, /data-print-save="rosa-ben-qr-codes\.pdf"[\s\S]*data-print-save="rosa-ben-seating-pack\.pdf"/);
  assert.match(pro.pass, /data-paid-mark="unlocked"/);
  assert.doesNotMatch(Object.values(pro).join(''), /data-print-all-in-one-pro/, 'a Pro couple is sent to the unlock page');
  /* The store shell without Pro: no door, no file — the purchase hint is absent; one guest's file stays. */
  const shell = await draw(false, true);
  assert.doesNotMatch(Object.values(shell).join(''), /data-print-all-in-one-pro|rosa-ben-(?:passes|set|everything|qr-codes|seating-pack)\.pdf|data-paid-mark/);
  assert.match(shell.pass, /data-print-save="rosa-ben-pass-ana-reyes\.pdf"/, 'one guest’s pass is gone from the store shell too');
});
