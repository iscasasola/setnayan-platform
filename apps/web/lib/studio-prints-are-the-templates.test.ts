/**
 * studio-prints-are-the-templates.test.ts — THE CONTROLS ON STUDIO › PRINTS THAT HAVE MOVED ARE THE TEMPLATES' (2026-10-09; `INTERACTION_RULES.md` § 9). The pattern
 * is `studio-egifts-are-the-templates` / `setup-controls-are-the-templates`: RENDER the page's pieces in their states and read what is drawn, then read the
 * source of what draws it.
 *
 * control → kind (this commit):
 *   Save · Classic (PDF) / Save · <theme> (PDF) / Sample (JPG) / Whole set / Every guest's pass / Save PDF (free prints)  → Action button (`ActionButton`, via
 *       `PrintSaveButton variant="action"`: the same fetch → share sheet / download, the same states — "Preparing…" (a waiting button, still a button) ·
 *       "Tap to save" · the plain error line · "Saved.")
 *   the pass zip, "Download all" (a Pro couple: the file; a free couple: the door to the Event Hub Pro unlock)         → Action button (the diamond in the icon's place)
 *   a piece's name · its sizes · its size ▾                                                                              → Form row (`ChosenRow` with its small line) / Form row
 *   every include switch (Parents · Opening line · E-Gifts · … 12)                                                       → Switch (`SwitchRow`, posting through the print words form)
 *   the seat plan's 3D · 2D · List                                                                                       → Dropdown (`ChosenRow`) — three choices
 *   Event Hub QR code · Always printed                                                                                   → Form row (a fact shown, `FactRow`)
 *   Save (the print words form)                                                                                          → Action button (the row's one filled step)
 *
 * NOT MOVED YET, and why (reported, not hidden): the Menu editor (its bare inputs, ⋯ menu and black Save post natively and the route answers with a 303 — a full
 * page load); the poster's photo upload; the pass card's look (ticket style); "Changed since you printed" (a status line); Kindly reply's reply-to select and typed
 * line, and the parents' cards — each is a field posted by the SAME print words form in TWO doors (Details › Words and the Finer Details switch), kept one by
 * `same-field.ts`, so a redrawn door needs the same two-door store the thank-you words got, and the Words door cannot be left drawn the old way beside it.
 *
 * SABOTAGE (each seen RED, then restored): a Studio save drawn with the old `button-primary` · a Studio save as a bare `<a download>` · an include switch with its own
 * track · the size ▾ as a bare PickMenu · a hand colour in a Studio part · a static import of a lazy Prints file into a first-load Maker file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderSettled } from './render-settled.test-helper';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const tagsOf = (m: string, tag: string) => [...m.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((x) => x[0]);

async function input(theme: string, ownsPro: boolean, storeShell = false) {
  const { formatFor } = await import('./print-pieces');
  return { eventId: 'E1', slug: 'rosa-ben', theme, ownsPro, storeShell, formats: { pass: formatFor('pass', null)!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! } };
}

test('1 · every Save on Studio › Prints is the ONE ActionButton — a button of the template, never a hand-made link or the old chip/primary look', async () => {
  const { PrintPieceEditor, PrintSetDownloads, PassCardsPanel, freePrintParts } = await import(`../${L}/maker-prints`);
  const states: Array<[string, boolean]> = [['house', false], ['galeriya', false], ['abaca', false], ['abaca', true]];
  for (const [theme, pro] of states) {
    const i = await input(theme, pro);
    const drawn = await renderSettled(
      React.createElement(
        React.Fragment,
        null,
        ...(['invitation', 'details', 'pass', 'entourage', 'poster', 'story-poster', 'card'] as const).map((k) => React.createElement(PrintPieceEditor as never, { key: k, input: i, piece: k, studio: true } as never)),
        React.createElement(PrintSetDownloads as never, { key: 'set', input: i, studio: true } as never),
        React.createElement(PassCardsPanel as never, { key: 'pass-cards', input: i, studio: true } as never),
        ...freePrintParts('E1', 'rosa-ben', undefined, true).map((f: { key: string; editor: React.ReactNode }) => React.createElement('div', { key: f.key }, f.editor)),
      ),
    );
    const saves = [...drawn.matchAll(/<span data-print-save="[^"]*"[^>]*>[\s\S]*?<\/span>/g)].length;
    assert.ok(saves >= 18, `${theme}/${pro}: only ${saves} saves drawn — the pieces were not all read`);
    assert.doesNotMatch(drawn, /button-primary|button-secondary|<a\b[^>]*\bdownload=/, `${theme}/${pro}: a Studio save is the old look or a bare download link`);
    assert.doesNotMatch(drawn, /sn-press inline-flex h-9 items-center rounded-md bg-cream/, `${theme}/${pro}: the old chip is drawn`);
    /* Every save button (`<span data-print-save>` wraps ONE ActionButton) is the template's, with its tone. */
    const buttons = tagsOf(drawn, 'button').filter((b) => /class="ab /.test(b));
    assert.ok(buttons.length >= saves, `${theme}/${pro}: a save is not an ActionButton`);
    assert.equal((drawn.match(/<span data-print-save=/g) ?? []).length, saves);
    for (const b of buttons) assert.match(b, /data-tone="(?:brand|neutral)"/, 'a save has a tone of its own making');
    /* ONE filled forward step per row: a piece's saves hold at most one main. */
    for (const row of drawn.matchAll(/data-print-piece-saves="[^"]*">([\s\S]*?)<\/div>/g)) {
      assert.ok(((row[1] ?? '').match(/data-main=""/g) ?? []).length <= 1, `${theme}/${pro}: a row has two filled buttons`);
    }
  }
});

test('2 · a piece’s head is ONE Form row: its name and sizes on the left, its size ▾ (the house dropdown) on the right', async () => {
  const { PrintPieceEditor } = await import(`../${L}/maker-prints`);
  const i = await input('house', false);
  const inv = await renderSettled(React.createElement(PrintPieceEditor as never, { input: i, piece: 'invitation', studio: true } as never));
  assert.match(inv, /data-form-row-kind="chosen"[\s\S]*?Invitation[\s\S]*?5 × 7 in or A5[\s\S]*?data-print-format-picker=""/, 'the invitation’s head is not the Form row with its size ▾');
  assert.match(inv, /aria-haspopup="listbox"/, 'the size ▾ is not the house dropdown');
  /* A piece with one size has the row without a dropdown. */
  const ent = await renderSettled(React.createElement(PrintPieceEditor as never, { input: i, piece: 'entourage', studio: true } as never));
  assert.match(ent, /data-form-rows="print-head"/, 'the entourage’s head is not a Form row');
  assert.doesNotMatch(ent, /data-print-format-picker/, 'a piece with one size draws a size ▾');
  /* The shipped Details is untouched. */
  const shipped = await renderSettled(React.createElement(PrintPieceEditor as never, { input: i, piece: 'invitation' } as never));
  assert.doesNotMatch(shipped, /data-form-row/, 'the shipped Details draws Form rows');
});

test('3 · every include switch is the Form row’s switch — a switch button on the one track, no track of its own', async () => {
  const { StudioIncludeSwitch } = await import(`../${L}/studio-tools`);
  for (const on of [true, false]) {
    const m = await renderSettled(React.createElement(StudioIncludeSwitch as never, { form: 'details-print-words', name: 'inc_x', label: 'Opening line', on, tip: 'Words.' } as never));
    const sw = tagsOf(m, 'button').filter((b) => /role="switch"/.test(b));
    assert.equal(sw.length, 1);
    assert.match(sw[0]!, /data-form-row-switch=""/);
    assert.match(m, /class="sn-switch /, 'the switch is not drawn with the one track');
    assert.doesNotMatch(m, /h-6 w-11/, 'the old 44 × 24 track is drawn');
    assert.equal((m.match(/<input[^>]*type="checkbox"/g) ?? []).length, 1, 'more than the one carrier checkbox');
  }
  const src = read(`${L}/studio-tools.tsx`);
  const parts = src.slice(src.indexOf('export function StudioPrintHead('), src.indexOf('export type StudioToolProps'));
  assert.ok(parts.length > 1500, 'the Studio Prints parts moved — re-read this guard');
  assert.doesNotMatch(parts, /<select\b|<textarea\b|type="checkbox"|type="radio"|<PickMenu\b/, 'a Studio Prints part draws a bare control');
  assert.doesNotMatch(parts, /\bbg-(?:terracotta|mulberry|gild|gold|success|emerald|green|red|amber)|\btext-(?:terracotta|mulberry)|\bborder-(?:terracotta|mulberry)|#[0-9a-fA-F]{3,8}\b|\bstyle=\{/, 'a Studio Prints part writes a colour of its own');
  assert.equal((parts.match(/<ChosenRow\b/g) ?? []).length, 1, 'the seat plan’s kind is not the one dropdown');
  assert.match(parts, /<SwitchRow[\s\S]{0,400}fieldName=\{name\}\s+formId=\{form\}/, 'the include switch does not post through the words form');
});

test('4 · the Save button waits as a button, and a failure says so in the plain line — never the look of success', () => {
  const src = read(`${L}/print-save-button.tsx`);
  const action = src.slice(src.indexOf("if (variant === 'action') {"), src.indexOf('const base ='));
  assert.ok(action.length > 600, 'the action branch moved');
  assert.match(action, /waiting=\{state\.k === 'working'\}/, 'Preparing… is not a waiting button');
  assert.match(action, /state\.k === 'error' \? \([\s\S]{0,200}role="alert"[\s\S]{0,200}\{state\.message\}/, 'an error is not said');
  assert.match(action, /'Tap to save'/);
  assert.match(action, /state\.via === 'share' \? 'Saved\.' : 'Sent to your downloads\.'/);
  assert.doesNotMatch(action, /button-primary|button-secondary|bg-|text-terracotta|text-mulberry/, 'the action branch writes a look of its own');
  /* One click handler for both looks: the fetch → share / download is not copied. */
  assert.equal((src.match(/printFetch\(href/g) ?? []).length, 1);
  assert.match(src, /const onClick = \(ev: React\.MouseEvent<HTMLAnchorElement>\) => \{\s*ev\.preventDefault\(\);\s*void run\(\);/);
});

test('5 · FIRST LOAD: nothing a first-load Maker file imports statically is a lazy Prints piece, a template, or the Studio writes’ context', () => {
  /* Prints' client pieces ride the `maker-details` chunk through `details-lazy.tsx` (`next/dynamic`) and the one `StudioTool` door — never a door of their own. */
  for (const f of ['maker-prints.tsx', 'maker-details.tsx', 'details-lazy.tsx', 'maker-shell.tsx', 'details-workspace.tsx', 'soft-post.tsx']) {
    const src = read(`${L}/${f}`).replace(/^import type [^;]*;$/gm, '');
    assert.doesNotMatch(
      src.replace(/import\(\/\*[^*]*\*\/ '[^']*'\)/g, ''),
      /from '\.\/(?:studio-tools|print-save-button|print-choice-picker|print-fetch-context|studio-actions-context)'|from '@\/app\/_components\/form-row'|from '@\/components\/action-button'|from '@\/app\/_components\/switch-track'/,
      `${f} imports a lazy Prints piece or a template statically`,
    );
  }
  const maker = read(`${L}/maker-prints.tsx`);
  assert.match(maker, /import \{ StudioTool \} from '\.\/details-lazy';/, 'Prints reaches its Studio parts through the one lazy door');
  const lazy = readFileSync(join(WEB, `${L}/details-lazy.tsx`), 'utf8');
  assert.match(lazy, /export const StudioTool = dynamic\(/);
});
