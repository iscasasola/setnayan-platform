/**
 * studio-prints-money-is-unchanged.test.ts — THE WORDS AND THE DOOR ABOUT MONEY ON PRINTS ARE BYTE-IDENTICAL (2026-10-09, coordinator: "say whether the page
 * has any control that makes an ORDER or spends money — list them and do not change their behaviour or wording at all beyond wearing the one ActionButton").
 *
 * THE FINDING: Studio › Prints has NO control that makes an order, takes a payment or shows a price, and no confirm step. What touches money is
 *   · "Go Pro to print in <theme>." and the access line ("In <theme> these are samples… / With Event Hub Pro they print in…") — words;
 *   · the pass zip's door: a free couple's "Download all" is a LINK to the Event Hub Pro unlock page (`/dashboard/<id>/studio/website-pro`), which owns the
 *     price and the confirm step; the Pro couple's is the zip itself (the diamond mark);
 *   · the Pro-themed print-ready buttons, ABSENT in the store shell, a sample for a free couple (the route refuses it too: `mayServe`).
 * The one door a customer can press toward paying is the zip's link; here it is held to the same href, hook and wording.
 *
 * `studio-prints-money-is-unchanged.golden.json` is what `PrintSetDownloads` and `PassCardsPanel` said BEFORE (six access states: classic · a free theme · a
 * Pro theme as a free couple · as a Pro couple · and the last two in the store shell). This test renders them again — the shipped Details way AND the Studio
 * way (the ActionButton) — and compares every word in order, the hooks, the href and the absence of a price.
 *
 * SABOTAGE (each seen RED, then restored): the zip door pointing elsewhere · the go-Pro line reworded · the zip's word changed on the Studio button · a price
 * written into the access line · the Studio showing the Pro door in the store shell.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderSettled } from './render-settled.test-helper';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const L = '../app/dashboard/[eventId]/launch/_components';
const golden = JSON.parse(readFileSync(join(__dirname, 'studio-prints-money-is-unchanged.golden.json'), 'utf8')) as Record<string, Record<'set' | 'pass', Facts>>;
type Facts = { text: string; access: string | null; goPro: boolean; zipDoor: boolean; proDoorHrefs: number; printReady: boolean; passesThemed: boolean; peso: boolean };

const STATES: Array<[string, string, boolean, boolean]> = [
  ['classic · free couple', 'house', false, false],
  ['free theme (Galeriya) · free couple', 'galeriya', false, false],
  ['Pro theme · free couple (sample)', 'abaca', false, false],
  ['Pro theme · Pro couple (print-ready)', 'abaca', true, false],
  ['Pro theme · free couple · store shell', 'abaca', false, true],
  ['Pro theme · Pro couple · store shell', 'abaca', true, true],
];

/** What a customer reads and what the page hooks say — the same extraction the golden was recorded with. */
function facts(markup: string): Facts {
  const text = markup.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&rsquo;|&#x27;|&#39;/g, '’').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  return {
    text,
    access: /data-prints-access="([^"]*)"/.exec(markup)?.[1] ?? null,
    goPro: /data-prints-go-pro/.test(markup),
    zipDoor: /data-pass-cards-zip-pro/.test(markup),
    proDoorHrefs: (markup.match(/href="\/dashboard\/E1\/studio\/website-pro"/g) ?? []).length,
    printReady: /data-prints-print-ready/.test(markup),
    passesThemed: /data-prints-passes=""/.test(markup),
    peso: /₱|PHP|\bUSD\b/.test(markup),
  };
}

async function panels(theme: string, ownsPro: boolean, storeShell: boolean): Promise<Record<'set' | 'pass', Facts>> {
  const { PrintSetDownloads, PassCardsPanel } = await import(`${L}/maker-prints`);
  const { formatFor } = await import('./print-pieces');
  const input = {
    eventId: 'E1',
    slug: 'rosa-ben',
    theme,
    ownsPro,
    storeShell,
    formats: { pass: formatFor('pass', null)!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! },
    passDesign: undefined,
    passCardsZip: 'passes.zip',
  };
  const extra = {};
  const set = await renderSettled(React.createElement(PrintSetDownloads as never, { input, ...extra } as never));
  const pass = await renderSettled(React.createElement(PassCardsPanel as never, { input, ...extra } as never));
  return { set: facts(set), pass: facts(pass) };
}

test('1 · the Prints panels say and link what they said before — the shipped Details way, to the byte', async () => {
  assert.equal(Object.keys(golden).filter((k) => k !== '_about').length, STATES.length, 'the golden’s states changed');
  for (const [label, theme, ownsPro, storeShell] of STATES) {
    assert.deepEqual(await panels(theme, ownsPro, storeShell), golden[label], `${label}: the shipped Details’ Prints panels changed`);
  }
});

/**
 * ⚙ 2026-10-17 (owner *"ok on prints"*, DECISION_LOG "PRINTS: ONE SETTINGS SHEET, ONE DOWNLOAD PER PIECE, VIEW AS ▾ ON GUEST PRINTS, ALL
 * GUESTS ◆, EVERYTHING ◆"): Studio › Prints no longer draws these two panels — its all-in-one files are each guest print's "All guests ◆"
 * and the one "Download everything ◆". What touches money there is held here instead: every ◆ is the SAME door — a LINK to the one
 * Event Hub Pro unlock page (a tap opens the centred note first, whose "Event Hub Pro" follows that link) — for a free couple on the
 * web; the file itself for a Pro couple; nothing in the store shell. No price, no order, no confirm step.
 */
async function studioMoney(theme: string, ownsPro: boolean, storeShell: boolean): Promise<{ text: string; doors: number; proDoorHrefs: number; marks: string[]; peso: boolean }> {
  const { PrintPieceEditor, PrintEverythingStudio, DigitalTicketEditor, freePrintParts } = await import(`${L}/maker-prints`);
  const { formatFor } = await import('./print-pieces');
  const input = {
    eventId: 'E1', slug: 'rosa-ben', theme, ownsPro, storeShell, passCardsZip: 'passes.zip',
    formats: { pass: formatFor('pass', null)!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! },
    passGuests: [{ id: '00000000-0000-4000-8000-000000000101', name: 'Ana Reyes', reply: 'attending' as const }],
  };
  const html = await renderSettled(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(PrintPieceEditor as never, { key: 'pass', input, piece: 'pass', studio: true } as never),
      React.createElement(DigitalTicketEditor as never, { key: 'ticket', input } as never),
      React.createElement(PrintEverythingStudio as never, { key: 'all', input } as never),
      ...(freePrintParts as (...a: unknown[]) => Array<{ key: string; editor: React.ReactNode }>)('E1', 'rosa-ben', input, true)
        .filter((f) => f.key === 'qr-codes' || f.key === 'seating-pack')
        .map((f) => React.createElement(React.Fragment, { key: f.key }, f.editor)),
    ),
  );
  return {
    text: facts(html).text,
    doors: (html.match(/data-print-all-in-one-pro=""/g) ?? []).length,
    proDoorHrefs: (html.match(/href="\/dashboard\/E1\/studio\/website-pro"/g) ?? []).length,
    marks: [...new Set([...html.matchAll(/data-paid-mark="([^"]+)"/g)].map((m) => m[1]!))].sort(),
    peso: /₱|PHP|\bUSD\b/.test(html),
  };
}

test('2 · …and Studio’s ◆ files are each the ONE door for a free couple, the file for a Pro couple, nothing in the store shell', async () => {
  for (const [label, theme, ownsPro, storeShell] of STATES) {
    const m = await studioMoney(theme, ownsPro, storeShell);
    assert.equal(m.peso, false, `${label}: a price on Studio › Prints`);
    assert.doesNotMatch(m.text, /\b(?:Buy|Checkout|Pay now|Confirm|Order)\b/, `${label}: an order or confirm step on Studio › Prints`);
    if (storeShell && !ownsPro) {
      assert.equal(m.doors + m.proDoorHrefs, 0, `${label}: the store shell shows the unlock door`);
      assert.deepEqual(m.marks, [], `${label}: a Pro mark in the store shell`);
    } else if (ownsPro) {
      assert.equal(m.doors + m.proDoorHrefs, 0, `${label}: a Pro couple is sent to the unlock page`);
      assert.deepEqual(m.marks, ['unlocked'], `${label}: a Pro couple’s files are not ◆ unlocked`);
    } else {
      /* Every guest's pass · every ticket (the zip) · everything · every guest's QR · every place card: five doors, one page. */
      assert.equal(m.doors, 5, `${label}: an all-in-one file is not the ◆ door`);
      assert.equal(m.proDoorHrefs, 5, `${label}: a ◆ door leads somewhere other than the one unlock page`);
      assert.deepEqual(m.marks, ['try'], `${label}: a free couple is shown a padlock, or no ◆`);
    }
  }
});

test('3 · no price, no order, no confirm step on these panels — and the free couple’s zip is a LINK to the one unlock page', async () => {
  for (const [label, theme, ownsPro, storeShell] of STATES) {
    {
      const p = await panels(theme, ownsPro, storeShell);
      assert.equal(p.set.peso || p.pass.peso, false, `${label}: a price is on the Prints panel`);
      assert.doesNotMatch(p.set.text + p.pass.text, /\b(?:Buy|Checkout|Pay now|Confirm|Order)\b/, `${label}: an order or confirm step is on the Prints panel`);
    }
  }
  const free = await panels('abaca', false, false);
  /* 2 since 2026-10-16 (owner: "EVERY 'DOWNLOAD ALL' IS EVENT HUB PRO"): the zip AND the Printed ticket batch — the SAME one unlock page. */
  assert.equal(free.pass.proDoorHrefs, 2, 'a free couple’s zip and ticket batch are not the door to the Event Hub Pro unlock');
  assert.equal(free.pass.zipDoor, true);
  const shell = await panels('abaca', false, true);
  assert.equal(shell.pass.proDoorHrefs, 0, 'the store shell shows the unlock door');
  const pro = await panels('abaca', true, false);
  assert.equal(pro.pass.proDoorHrefs, 0, 'a Pro couple is sent to the unlock page');
});
