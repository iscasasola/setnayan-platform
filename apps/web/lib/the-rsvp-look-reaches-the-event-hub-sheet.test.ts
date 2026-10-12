/**
 * 🎨 A LOOK SET ON THE MAKER'S RSVP STAGE REACHES THE EVENT HUB'S OWN REPLY SHEET — the dead setting this closes
 * (controller 2026-10-10).
 *
 * A guest replies in TWO places: the invitation's reply page (the first reply — the key gate sends an unanswered
 * guest there) and the Event Hub's own reply sheet (`site-body.tsx`: changing a reply later, and every guest of a
 * "no reply needed" event). Until this, only the first drew any of what the stage sets: each line's Font · Colour ·
 * Size · Build in, and (since 5b) the lines a couple added, their order and their groups — live in the Maker, never
 * seen by a guest on the sheet.
 *
 *   1. THE SHEET DRAWS THE SAME TWO THINGS, FROM THE SAME READER — the list (`lines`, `rsvpScreenLayout`) and the one
 *      `<style>` (`RsvpLookStyle`), from the config the page already holds: no new read;
 *   2. NOTHING STORED = NOTHING GAINED — the style is not an empty tag, it is nothing; nor is another screen's look,
 *      nor a card ground the sheet shows as its own paper;
 *   3. WHAT IS GAINED WHEN A LOOK IS STORED — one `<style data-rsvp-look="rsvp">`: the form's lines, added lines and
 *      groups, as on the reply page;
 *   4. THE CARD ON THE SHEET, IN ONE PLACE (`rsvpCardGroundOn`): Plain = the sheet's own paper · Frosted = that paper
 *      as glass · None is shown as Plain — and the card's Build in is not drawn there. The reply page is unchanged;
 *   5. THE MAKER SAYS SO where the couple sets them: one quiet line under the form card's Background and its Animate.
 *
 * THE WHOLE PAGE, BYTE FOR BYTE: the real guest page has a record of its own — the real `SiteBody` drawn for a fixture
 * invitation, recorded at `origin/main` 64746f064 with no page file touched (the fixture-render guard of the guest
 * page, commit 7ae4c46d8; it draws this sheet). Laid over this change before it was committed, that record held —
 * and the same page drawn with only another screen's look, or the card set to None with a Build in, was that record
 * too. Once both are on one branch it holds this for good. (Its file is not named here on purpose: that guard reads
 * every file of the app for its own name, to prove no page imports the fixture.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { RSVP_SHEET_KEEPS, RSVP_SHEET_SELECTOR, readRsvpLook, rsvpCardGroundOn, rsvpLookCss, rsvpLookRules, rsvpSheetKeepsLine } from './rsvp-look';

(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;
const WEB = join(__dirname, '..');
const HUB = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/site-body.tsx'), 'utf8'));
const BOARD = ['#111111', '#222222', '#333333', '#444444', '#555555'];

async function sheetStyle(config: unknown): Promise<string> {
  const { RsvpLookStyle } = await import('../app/[slug]/_components/rsvp-look-style');
  return renderToStaticMarkup(h(RsvpLookStyle, { config, board: BOARD, parts: ['rsvp'], surface: 'sheet' }));
}

test('1 · the sheet is handed the list and the look — from the config the page already holds, by the one reader', () => {
  const at = HUB.indexOf('<div data-rsvp-form>');
  const end = HUB.indexOf('</RsvpSheet>', at);
  assert.ok(at > 0 && end > at, 'anti-vacuity: the reply sheet’s form box was not found');
  const box = HUB.slice(at, end);
  assert.match(box, /<RsvpWidget\b[\s\S]*?lines=\{rsvpScreenLayout\(readRsvpLook\(event\.rsvp_ask_config\), 'rsvp'\)\}\s*pictures=\{rsvpPictures\}\s*\/>/);
  assert.match(box, /\/>\s*(?:\{\s*\}\s*)?<RsvpLookStyle config=\{event\.rsvp_ask_config\} board=\{celebrationColours\(boardSwatches\(event\.role_palette\)\)\} parts=\{RSVP_SHEET_PARTS\} surface="sheet" \/>\s*<\/div>/, 'the look is not mounted after the card, inside the card’s own box');
  assert.match(HUB, /const RSVP_SHEET_PARTS = \['rsvp'\] as const;/);
  /* Once each on the whole page — and nothing is read for them that the page did not already hold. */
  assert.equal((HUB.match(/<RsvpLookStyle\b/g) ?? []).length, 1);
  assert.equal((HUB.match(/rsvpScreenLayout\(/g) ?? []).length, 1);
  assert.equal((HUB.match(/<RsvpWidget\b/g) ?? []).length, 1);
});

test('2 · nothing stored = nothing gained: no tag at all', async () => {
  for (const config of [null, undefined, {}, { words: { question: 'Coming?' }, oneAtATime: true }, { look: {} }, { look: { lines: {}, card: {} } }, { look: { later: true } }]) {
    assert.equal(await sheetStyle(config), '', JSON.stringify(config));
  }
  /* A look of ANOTHER screen is nothing here; nor is a card ground the sheet shows as its own paper, nor the card's Build in. */
  assert.equal(await sheetStyle({ look: { lines: { 'yesnote.heading': { s: 120 }, 'nonote.message': { c: '#aa0011' }, 'pass.save': { s: 110 } } } }), '');
  assert.equal(await sheetStyle({ look: { card: { rsvp: { g: 'none', w: 'plain', i: { fade: true }, v: 'quick' }, nonote: { g: 'frost' }, yesnote: { g: 'frost' } } } }), '');
  /* A list with no look of its own is drawn by the card, not by a style. */
  assert.equal(await sheetStyle({ look: { added: { rsvp: [{ id: 'n1', k: 'm', t: 'Kindly reply' }] }, order: { rsvp: ['no', 'yes'] }, groups: { rsvp: [{ id: 'g1', of: ['yes', 'no'] }] } } }), '');
});

const STORED = {
  look: {
    lines: { 'rsvp.question': { c: '#AA0011', s: 120 }, 'rsvp.yes': { f: 'cinzel' }, 'rsvp.hint': { i: { fade: true } }, 'a:n1': { s: 85 }, 'yesnote.heading': { s: 132 } },
    card: { rsvp: { g: 'none', w: 'frost', i: { fade: true } } },
    added: { rsvp: [{ id: 'n1', k: 'm', t: 'Kindly reply' }] },
    groups: { rsvp: [{ id: 'g1', of: ['yes', 'no'], g: 'frost' }] },
  },
};

test('3 · what a guest’s page gains when a look IS stored: one style — the form’s lines, added lines and groups, as on the reply page', async () => {
  const html = await sheetStyle(STORED);
  assert.match(html, /^<style data-rsvp-look="rsvp">[^<]*<\/style>$/);
  const sheet = rsvpLookRules(readRsvpLook(STORED), ['rsvp'], BOARD, 'sheet');
  const door = rsvpLookRules(readRsvpLook(STORED), ['rsvp'], BOARD);
  assert.deepEqual(sheet.map((r) => r.selector), ['[data-rsvp-line="question"][data-rsvp-line]', '[data-rsvp-line="yes"][data-rsvp-line],[data-rsvp-wears="yes"]', '[data-rsvp-line="hint"][data-rsvp-line]', '[data-rsvp-line="a:n1"][data-rsvp-line]', '[data-rsvp-group="g1"]']);
  /* Every one of them is the reply page's own rule, word for word: a line and a group look the same in both places. */
  for (const rule of sheet) assert.deepEqual(rule, door.find((r) => r.selector === rule.selector), rule.selector);
  /* The reply page draws one thing more — its door's card; the sheet draws none of that card. */
  assert.deepEqual(door.filter((r) => !sheet.some((s) => s.selector === r.selector)).map((r) => r.selector), ['div:has(>[data-door-header])']);
});

test('4 · the card on the sheet, in one place: Plain is its own paper, Frosted its paper as glass, None is shown as Plain — and no Build in', () => {
  assert.equal(rsvpCardGroundOn('sheet', undefined), 'plain');
  assert.equal(rsvpCardGroundOn('sheet', 'none'), 'plain', 'a sheet with no ground over the invitation cannot be read');
  assert.equal(rsvpCardGroundOn('sheet', 'frost'), 'frost');
  /* The reply page: as stored. */
  assert.deepEqual([undefined, 'none', 'frost'].map((g) => rsvpCardGroundOn('door', g as never)), ['plain', 'none', 'frost']);
  const on = (card: Record<string, unknown>) => rsvpLookRules(readRsvpLook({ look: { card: { rsvp: card } } }), ['rsvp'], BOARD, 'sheet');
  assert.deepEqual(on({ g: 'none' }), []);
  assert.deepEqual(on({ i: { fade: true, move: 'below' }, v: 'cinematic' }), [], 'the card’s Build in is drawn on the sheet');
  const frosted = on({ g: 'frost', i: { fade: true } });
  assert.equal(RSVP_SHEET_SELECTOR, '[data-rsvp-sheet]');
  assert.deepEqual(frosted.map((r) => [r.selector, r.moves]), [['[data-rsvp-sheet]', false], ['[data-rsvp-sheet]>div:first-of-type', false]]);
  assert.match(frosted[0]!.rules, /^background:var\(--sn-glass-bg\)!important;border-color:var\(--sn-glass-line\)!important;backdrop-filter:var\(--sn-glass-blur\)!important;/);
  assert.doesNotMatch(rsvpLookCss(readRsvpLook({ look: { card: { rsvp: { g: 'frost', i: { fade: true } } } } }), ['rsvp'], BOARD, 'sheet'), /animation|@keyframes/);
  /* The sheet names itself for every guest, and the band that holds its title is its first block. */
  const SHEET = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/rsvp-sheet.tsx'), 'utf8'));
  assert.match(SHEET, /data-rsvp-sheet\s+className="sn-rsvp-sheet [^"]*bg-paper[^"]*"\s*>\s*<div className="sticky top-0 [^"]*bg-paper\/95[^"]*">/);
  /* A page that is NOT a sheet is asked the usual way and is unchanged: the two reply pages pass no surface. */
  for (const page of ['app/[slug]/invite/reply/page.tsx', 'app/[slug]/invite/enter/page.tsx']) assert.doesNotMatch(stripComments(readFileSync(join(WEB, page), 'utf8')), /surface=/);
});

/** The stage's panel, drawn for the form's card on one tool, with a stored config (the harness of the four-rows guard). */
async function cardPanel(tool: 'bg' | 'animate', current: Record<string, unknown>): Promise<string> {
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
  const { MakerRsvpSettings } = await import('../app/dashboard/[eventId]/launch/_components/maker-rsvp-ask');
  return renderToStaticMarkup(
    h(MakerRsvpSettings as React.FC<Record<string, unknown>>, {
      eventId: 'e-1',
      current,
      drafted: false,
      replyBy: { date: '2026-11-18', isDefault: false },
      replyByOwn: { deadline: '2026-11-18', pricingMode: 'final_only' },
      requests: { count: null, list: null },
      scene: 'form',
      picked: { tool, part: 'rsvp', line: null },
      celebration: { ownsPro: false, storeShell: false, colours: BOARD },
    }),
  );
}
const said = (html: string, attr: string) => new RegExp(`<p [^>]*${attr}=""[^>]*>([^<]*)</p>`).exec(html)?.[1]?.replace(/&#x27;/g, '’') ?? null;

test('5 · the Maker says so where the couple sets them — and says only what is TRUE for the Background picked', async () => {
  /* 🔑 THE PROPERTY, not a phrase: the line claims "its own paper" exactly while the sheet's ground IS its own paper
     by the one mapping (`rsvpCardGroundOn`), and always says the sheet opens its own way. Change the mapping (say,
     Frosted no longer glass on the sheet) and the sentence follows it; change a word and this still holds. */
  for (const ground of [undefined, 'none', 'frost'] as const) {
    const line = rsvpSheetKeepsLine(ground);
    const ownPaper = rsvpCardGroundOn('sheet', ground) === 'plain';
    assert.equal(line.includes('its own paper'), ownPaper, `${ground ?? 'plain'}: the line says the sheet keeps its paper, and the sheet ${ownPaper ? 'does' : 'does not'}`);
    assert.ok(line.includes('its own way of opening'), `${ground ?? 'plain'}: the line does not say the sheet opens its own way`);
    assert.ok(line.startsWith('Inside the Event Hub, the reply sheet keeps '));
    /* …and it is what the panel DRAWS for that stored Background: under the tiles (row 3 of Background), and in
       Animate's row 3 — the same sentence in both, from the card's stored ground. */
    const current = ground ? { look: { card: { rsvp: { g: ground } } } } : {};
    const bg = await cardPanel('bg', current);
    assert.equal(said(bg, 'data-rsvp-sheet-note'), line, `Background, ${ground ?? 'plain'} stored`);
    assert.match(bg, /<p data-rsvp-row="3" data-rsvp-sheet-note=""/);
    assert.equal(said(await cardPanel('animate', current), 'data-stage-animate-note'), line, `Animate, ${ground ?? 'plain'} stored`);
  }
  /* Two sentences, and they differ only by the paper: the shorter is the longer with "its own paper and " cut out —
     no new word (the controller's wording, pending the owner's look). */
  assert.equal(RSVP_SHEET_KEEPS.paperAndOpening.replace('its own paper and ', ''), RSVP_SHEET_KEEPS.opening);
  assert.equal(RSVP_SHEET_KEEPS.paperAndOpening, 'Inside the Event Hub, the reply sheet keeps its own paper and its own way of opening.');
  /* 4 rows, filled from row 1: under Animate the line gives its row up while Move or Size is on (they need row 3 for
     their side and their way) — and a refusal is said before it. */
  const moving = await cardPanel('animate', { look: { card: { rsvp: { i: { move: 'below' } } } } });
  assert.equal(said(moving, 'data-stage-animate-note'), null);
  assert.match(moving, /data-stage-needs="in"/);
  const L = 'app/dashboard/[eventId]/launch/_components';
  const PANEL = stripComments(readFileSync(join(WEB, `${L}/maker-rsvp-ask.tsx`), 'utf8'));
  assert.match(PANEL, /\{status \? \(\s*<div data-rsvp-row="3"[^>]*>\{status\}<\/div>\s*\) : lookCard === 'rsvp' \? \(/, 'a refused save is not said before the line, or the line is on a note’s card');
});
