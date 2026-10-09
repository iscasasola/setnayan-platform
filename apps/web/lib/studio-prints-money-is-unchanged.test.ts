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

async function panels(theme: string, ownsPro: boolean, storeShell: boolean, studio: boolean): Promise<Record<'set' | 'pass', Facts>> {
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
  const extra = studio ? { studio: true } : {};
  const set = await renderSettled(React.createElement(PrintSetDownloads as never, { input, ...extra } as never));
  const pass = await renderSettled(React.createElement(PassCardsPanel as never, { input, ...extra } as never));
  return { set: facts(set), pass: facts(pass) };
}

test('1 · the Prints panels say and link what they said before — the shipped Details way, to the byte', async () => {
  assert.equal(Object.keys(golden).filter((k) => k !== '_about').length, STATES.length, 'the golden’s states changed');
  for (const [label, theme, ownsPro, storeShell] of STATES) {
    assert.deepEqual(await panels(theme, ownsPro, storeShell, false), golden[label], `${label}: the shipped Details’ Prints panels changed`);
  }
});

test('2 · …and the Studio way (the ActionButton) says and links exactly the same: every word in order, the Pro door, the hooks', async () => {
  for (const [label, theme, ownsPro, storeShell] of STATES) {
    const now = await panels(theme, ownsPro, storeShell, true);
    assert.deepEqual(now, golden[label], `${label}: Studio › Prints says or links something else than before`);
  }
});

test('3 · no price, no order, no confirm step on these panels — and the free couple’s zip is a LINK to the one unlock page', async () => {
  for (const [label, theme, ownsPro, storeShell] of STATES) {
    for (const studio of [false, true]) {
      const p = await panels(theme, ownsPro, storeShell, studio);
      assert.equal(p.set.peso || p.pass.peso, false, `${label}: a price is on the Prints panel`);
      assert.doesNotMatch(p.set.text + p.pass.text, /\b(?:Buy|Checkout|Pay now|Confirm|Order)\b/, `${label}: an order or confirm step is on the Prints panel`);
    }
  }
  const free = await panels('abaca', false, false, true);
  assert.equal(free.pass.proDoorHrefs, 1, 'a free couple’s zip is not the door to the Event Hub Pro unlock');
  assert.equal(free.pass.zipDoor, true);
  const shell = await panels('abaca', false, true, true);
  assert.equal(shell.pass.proDoorHrefs, 0, 'the store shell shows the unlock door');
  const pro = await panels('abaca', true, false, true);
  assert.equal(pro.pass.proDoorHrefs, 0, 'a Pro couple is sent to the unlock page');
});
