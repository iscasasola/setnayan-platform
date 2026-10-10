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
import { RSVP_SHEET_SELECTOR, readRsvpLook, rsvpCardGroundOn, rsvpLookCss, rsvpLookRules } from './rsvp-look';

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
  assert.match(box, /<RsvpWidget\b[\s\S]*?lines=\{rsvpScreenLayout\(readRsvpLook\(event\.rsvp_ask_config\), 'rsvp'\)\}\s*\/>/);
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
  assert.deepEqual(sheet.map((r) => r.selector), ['[data-rsvp-line="question"][data-rsvp-line]', '[data-rsvp-line="yes"][data-rsvp-line]', '[data-rsvp-line="hint"][data-rsvp-line]', '[data-rsvp-line="a:n1"][data-rsvp-line]', '[data-rsvp-group="g1"]']);
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

test('5 · the Maker says so where the couple sets them: one quiet line under the form card’s Background and its Animate', () => {
  const L = 'app/dashboard/[eventId]/launch/_components';
  const ROWS = stripComments(readFileSync(join(WEB, `${L}/rsvp-line-look.tsx`), 'utf8'));
  const PANEL = stripComments(readFileSync(join(WEB, `${L}/maker-rsvp-ask.tsx`), 'utf8'));
  /* The controller's sentence, word for word. */
  assert.match(ROWS, /export const RSVP_SHEET_KEEPS_LINE = 'Inside the Event Hub, the reply sheet keeps its own paper and its own way of opening\.';/);
  /* Background: row 3, under the tiles (row 1) and the card's own line (row 2) — the FORM's card only; a refusal is said first. */
  assert.match(PANEL, /\{status \? \(\s*<div data-rsvp-row="3"[^>]*>\{status\}<\/div>\s*\) : lookCard === 'rsvp' \? \(\s*<p data-rsvp-row="3" data-rsvp-sheet-note=""[^>]*>\s*\{RSVP_SHEET_KEEPS_LINE\}\s*<\/p>\s*\) : null\}/);
  /* Animate: handed to the toolbar's own Animate, which draws it in row 3 while that row is free. */
  assert.match(PANEL, /note=\{typeof moves !== 'string' && moves\.card === 'rsvp' \? RSVP_SHEET_KEEPS_LINE : null\}/);
  const ANIMATE = stripComments(readFileSync(join(WEB, `${L}/stage-panel/stage-animate.tsx`), 'utf8'));
  assert.match(ANIMATE, /\) : note \? \(\s*<p className=\{`\$\{SP_ROWS_ROW\} row-start-3 [^`]*`\} data-stage-animate-note="">\s*\{note\}\s*<\/p>\s*\) : null\}/);
});
