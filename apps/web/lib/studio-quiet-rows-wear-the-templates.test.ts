/**
 * studio-quiet-rows-wear-the-templates.test.ts — RESTORE · RESET… · ABOUT ARE HOUSE ROWS WITH THE APPROVED BUTTONS.
 *
 * Owner, 2026-10-08, with a picture of Studio › Info's last rows (Restore greyed like faded text; "Reset…" in a
 * gold-brown fill): *"we better fix the buttons here as well"*. Template: `INTERACTION_RULES.md` § 9, kind 9 (the
 * approved gallery § 9 "Action button": main · second · quiet · delete; a button that cannot be used yet is grey).
 *
 *   (1) THE ACTION BUTTON — second = white, a hairline, ink words, a full pill; delete = the DANGER token; waiting =
 *       grey and `aria-disabled` and STILL a button (its shape and line kept — never faded text), and a press on it
 *       does nothing; the app's one press.
 *   (2) THE ROWS, RENDERED — each a house row: its name, one quiet line, the action at the right; Restore and Reset…
 *       the SAME width and height; About has no button; with nothing to restore, Restore is the waiting button.
 *   (3) NOTHING ELSE CHANGED — Restore runs the draft bar's own restore (only when there is something to restore),
 *       Reset… only opens the draft bar's confirm; no request, no new handler.
 *
 * Mutations seen RED (2026-10-08), each restored: "Reset…" back on the gold `terracotta-700` family → (1)+(2); the
 * waiting look turned back into faded text (`opacity-40`, no `aria-disabled`) → (1); a press on a waiting button
 * still running its handler → (1); the two buttons given different widths → (2); a button on About → (2); Restore
 * callable with nothing to restore → (3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  /* `studio-tools.tsx` imports the draft door (a server action file): its server-only marks are not for a test run. */
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const TOOLS = `${L}/studio-tools.tsx`;
const BUTTON = 'app/_components/action-button.tsx';
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
/** Draw a component with a test's props. */
const h = (C: unknown, props: Record<string, unknown> | null = null, ...kids: React.ReactNode[]) => React.createElement(C as React.FC<Record<string, unknown>>, props, ...kids);

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
const classOf = (html: string, marker: string) => new RegExp(`<button[^>]*${marker}[^>]*class="([^"]*)"`).exec(html)?.[1] ?? '';

test('(1) the action button: second is white with a hairline, delete is the danger token, waiting is grey and still a button', async () => {
  const { ActionButton, actionButtonClass } = await import('../app/_components/action-button');
  const second = await paint(h(ActionButton, { tone: 'second', size: 'row' }, 'Restore'));
  assert.match(second, /^<button type="button" data-action-button="second" class="[^"]*">Restore<\/button>$/);
  const c2 = classOf(second, 'data-action-button="second"');
  for (const cls of ['rounded-full', 'border', 'border-ink/15', 'bg-white', 'text-ink', 'h-10', 'sn-press', 'sn-press-ring']) assert.ok(c2.split(' ').includes(cls), `the second button lost ${cls}`);
  // Delete: the danger token for its words and its line — never the gold family the old "Reset…" wore.
  const del = classOf(await paint(h(ActionButton, { tone: 'delete', size: 'row' }, 'Reset…')), 'data-action-button="delete"');
  for (const cls of ['rounded-full', 'border', 'border-danger-700/40', 'bg-white', 'text-danger-700']) assert.ok(del.split(' ').includes(cls), `the delete button lost ${cls}`);
  assert.doesNotMatch(del, /terracotta|mulberry|gild/, 'the delete button is painted with a colour by name');
  // THE CLAIM — waiting: grey, announced, and STILL A BUTTON (its pill and a line kept), not faded text.
  const off = await paint(h(ActionButton, { tone: 'second', size: 'row', disabled: true, onClick: () => {} }, 'Restore'));
  assert.match(off, /^<button type="button" data-action-button="off" aria-disabled="true"/);
  const co = classOf(off, 'data-action-button="off"');
  for (const cls of ['rounded-full', 'border', 'bg-ink/[0.06]', 'text-ink/45', 'h-10']) assert.ok(co.split(' ').includes(cls), `a waiting button lost ${cls}`);
  assert.doesNotMatch(co, /opacity-/, 'a waiting button is faded (it reads as text, not as a button)');
  assert.doesNotMatch(off, / disabled=""/, 'a waiting button left the page for a screen reader');
  // …and a press on it does nothing.
  const src = read(BUTTON);
  assert.match(src, /aria-disabled=\{disabled \|\| undefined\}\s*onClick=\{disabled \? undefined : onClick\}/, 'a waiting button still runs its handler');
  // The four tones the gallery draws, and its two sizes.
  assert.match(actionButtonClass('main'), /bg-sn-accent text-sn-on-accent/);
  assert.match(actionButtonClass('quiet'), /text-sn-accent/);
  assert.match(actionButtonClass('second', 'full'), /h-12 min-w-\[112px\]/);
  assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b|mulberry|terracotta|\btext-white\b/, 'the action button writes a colour for the accent');
});

async function drawRows(draft: { canRestore: boolean } | null): Promise<string> {
  const { StudioQuietRows } = await import(`../${TOOLS}`);
  const { MakerContext } = await import(`../${L}/maker-context`);
  const value = draft ? { draft: { canRestore: draft.canRestore, restore: () => {}, count: 0 } } : {};
  return paint(React.createElement(MakerContext.Provider, { value: value as never }, h(StudioQuietRows)));
}

test('(2) the rows, rendered: name · one quiet line · the action at the right — Restore and Reset… one size; About has no button', async () => {
  const html = await drawRows({ canRestore: true });
  assert.match(html, /^<div data-studio-quiet="" data-form-rows="quiet"/, 'the rows lost the mark the form’s skin reads');
  // Three house rows, each with its name and its line.
  const rows = [...html.matchAll(/data-studio-quiet-row="([a-z]+)" data-form-row="[a-z]+"[\s\S]*?(?=<div data-studio-quiet-row|$)/g)].map((m) => ({ key: m[1], html: m[0] }));
  assert.deepEqual(rows.map((r) => r.key), ['restore', 'reset', 'about']);
  const words = (r: { html: string }) => [/class="block text-\[15px\][^"]*">([^<]+)</.exec(r.html)?.[1], /data-form-row-line=""[^>]*>([^<]+)</.exec(r.html)?.[1]];
  assert.deepEqual(rows.map(words), [['Restore', 'Back to what guests see now'], ['Reset', 'Start this stage over'], ['About', 'Made with Setnayan']]);
  // The actions: Restore = second, Reset… = delete — the SAME width and height, each the row's last thing (right edge).
  const restore = classOf(rows[0]!.html, 'data-action-button="second"');
  const reset = classOf(rows[1]!.html, 'data-action-button="delete"');
  assert.ok(restore && reset, 'anti-vacuity: the two buttons were not found');
  const size = (c: string) => c.split(' ').filter((x) => /^(w-|h-|min-h-|min-w-)/.test(x)).sort().join(' ');
  assert.equal(size(restore), size(reset), 'Restore and Reset… are not the same width and height');
  assert.match(size(restore), /h-10 .*w-\[104px\]/);
  assert.match(rows[1]!.html, />Reset…<\/button>/, 'Reset lost its "…" (it opens a confirm)');
  assert.doesNotMatch(reset, /terracotta|gild/, '"Reset…" is back in the gold-brown fill');
  assert.match(reset, /text-danger-700/);
  for (const r of rows.slice(0, 2)) assert.match(r.html, /<\/span><button type="button" data-action-button="[a-z]+"[^>]*>[^<]+<\/button><\/div>/, `${r.key}’s action is not at the row’s right end`);
  assert.equal(count(rows[2]!.html, /<button/g), 0, 'About has a button');
  assert.equal(count(html, /<button/g), 2);
  // With nothing to restore: the WAITING button — grey, aria-disabled, still a button.
  const none = await drawRows({ canRestore: false });
  assert.match(none, /<button type="button" data-action-button="off" aria-disabled="true" class="[^"]*bg-ink\/\[0\.06\][^"]*w-\[104px\]"[^>]*>Restore<\/button>/);
  assert.doesNotMatch(none, /opacity-40|disabled=""/);
  // Outside a Maker that holds a draft there is nothing to restore or reset: only About.
  const bare = await drawRows(null);
  assert.equal(count(bare, /<button/g), 0);
  assert.match(bare, /Made with Setnayan/);
});

test('(3) nothing else changed: Restore runs the draft bar’s own restore, Reset… only opens its confirm — no request', () => {
  const src = read(TOOLS);
  const rows = src.slice(src.indexOf('export function StudioQuietRows()'), src.indexOf('export const STUDIO_LOOK_LABEL'));
  assert.ok(rows.length > 400, 'anti-vacuity: StudioQuietRows was not found');
  assert.match(rows, /disabled=\{!draft\.canRestore\} onClick=\{\(\) => draft\.canRestore && draft\.restore\(\)\}/, 'Restore can run with nothing to restore');
  assert.match(rows, /onClick=\{\(\) => window\.dispatchEvent\(new Event\(MAKER_OPEN_RESET_EVENT\)\)\}/, 'Reset… no longer opens the draft bar’s one confirm');
  assert.doesNotMatch(rows, /makerSave|hubDraftAction|fetch\(|router|studioDraftKeep/, 'a quiet row asks the server by itself');
  assert.doesNotMatch(rows, /terracotta|STUDIO_QUIET_BUTTON|className="[^"]*opacity/, 'a quiet row hand-makes its button again');
  assert.equal(count(rows, /<ActionButton\b/g), 2);
  assert.equal(count(rows, /className=\{QUIET_ACTION\}/g), 2, 'the two buttons do not share one size');
  // Drawn where it was: at the foot of Studio › Info, and nowhere else.
  assert.equal(count(read(`${L}/maker-details.tsx`), /<StudioTool part="quiet" \/>/g), 1);
});
