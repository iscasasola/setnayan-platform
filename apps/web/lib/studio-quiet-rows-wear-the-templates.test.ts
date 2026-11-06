/**
 * studio-quiet-rows-wear-the-templates.test.ts — RESTORE · RESET… · ABOUT ARE HOUSE ROWS WITH THE APPROVED BUTTONS.
 *
 * Owner, 2026-10-08, with a picture of Studio › Info's last rows (Restore greyed like faded text; "Reset…" in a
 * gold-brown fill): *"we better fix the buttons here as well"*. Template: `INTERACTION_RULES.md` § 9, kind 9 (the
 * approved gallery § 9 "Action button": main · second · quiet · delete; a button that cannot be used yet is grey).
 *
 *   (1) ONE ACTION BUTTON — the house `ActionButton` (`components/action-button.tsx`, the button rule): Restore is its
 *       neutral tone, Reset… its danger tone; WAITING (new, additive) = grey and `aria-disabled` and STILL a button
 *       (its pill and a line kept, full opacity — never the fade), a press does nothing; `disabled` keeps the look
 *       it had; and no second file exports an `ActionButton`.
 *   (2) THE ROWS, RENDERED — each a house row: its name, one quiet line, the action at the right; Restore and Reset…
 *       the SAME size; About has no button; with nothing to restore, Restore is the waiting button.
 *   (3) NOTHING ELSE CHANGED — Restore runs the draft bar's own restore (only when there is something to restore),
 *       Reset… only opens the draft bar's confirm; no request, no new handler.
 *
 * Mutations seen RED (2026-10-08), each restored: a second `ActionButton` file → (1); the waiting look turned back
 * into the fade (`opacity: 0.35`) → (1); a waiting button still running its handler → (1); "Reset…" given the
 * neutral tone → (2); the two buttons given different widths → (2)+(3); a button on About → (2)+(3); Restore callable
 * with nothing to restore → (3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
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
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
/** Draw a component with a test's props. */
const h = (C: unknown, props: Record<string, unknown> | null = null, ...kids: React.ReactNode[]) => React.createElement(C as React.FC<Record<string, unknown>>, props, ...kids);

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
const classOf = (html: string, marker: string) => new RegExp(`<button[^>]*${marker}[^>]*class="([^"]*)"`).exec(html)?.[1] ?? '';

test('(1) ONE action button: Restore is its neutral tone, Reset… its danger tone; waiting is grey and still a button — and no second ActionButton exists', async () => {
  const { ActionButton } = await import('../components/action-button');
  // Neutral and danger, drawn by the house button (icon + word, the word also its name).
  const neutral = await paint(h(ActionButton, { tone: 'neutral', icon: h('svg'), label: 'Restore' }));
  assert.match(neutral, /^<button type="button" aria-label="Restore" title="Restore" class="ab ab-neutral" data-tone="neutral"><svg><\/svg><span class="lbl">Restore<\/span><\/button>$/);
  assert.match(await paint(h(ActionButton, { tone: 'danger', icon: h('svg'), label: 'Reset…' })), /class="ab ab-danger" data-tone="danger"/);
  // THE CLAIM — waiting: announced, NOT the native disabled, marked for its own look, and a press does nothing.
  let pressed = 0;
  const waiting = await paint(h(ActionButton, { tone: 'neutral', icon: h('svg'), label: 'Restore', waiting: true, onClick: () => (pressed += 1) }));
  assert.match(waiting, /^<button type="button" aria-disabled="true" data-waiting="" aria-label="Restore"/);
  assert.doesNotMatch(waiting, / disabled=""/, 'a waiting button left a screen reader’s path');
  assert.equal(pressed, 0);
  const src = read('components/action-button.tsx');
  assert.match(src, /onClick=\{waiting \? undefined : p\.onClick\}/, 'a waiting button still runs its handler');
  assert.match(src, /type=\{waiting \? 'button' : \(p\.type \?\? 'button'\)\}/, 'a waiting submit still posts its form');
  // Its look, in the stylesheet: a grey fill and word, a line, FULL opacity — after the tone, main and disabled rules.
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const at = css.indexOf(':is(button, a).ab[data-waiting],');
  assert.ok(at > 0, 'the waiting look is not in the stylesheet');
  const rule = css.slice(at, css.indexOf('}', at));
  assert.match(rule, /opacity: 1;/, 'a waiting button is faded (it reads as text, not as a button)');
  assert.match(rule, /color: color-mix\(in srgb, rgb\(var\(--color-ink\)\) 45%, transparent\);/);
  assert.match(rule, /background: color-mix\(in srgb, rgb\(var\(--color-ink\)\) 6%, transparent\);/);
  assert.match(rule, /border-color: color-mix\(in srgb, rgb\(var\(--color-ink\)\) 10%, transparent\);/, 'a waiting button lost its line');
  assert.match(rule, /:is\(button, a\)\.ab\.ab-main\[data-waiting\]/, 'a waiting MAIN button keeps its fill');
  for (const earlier of [":is(button, a).ab.ab-neutral {", ":is(button, a).ab.ab-main {", ".ab:disabled, .ab[aria-disabled='true']"]) {
    assert.ok(css.indexOf(earlier) > 0 && css.indexOf(earlier) < at, `the waiting look is written before \`${earlier}\` and would lose to it`);
  }
  // `disabled` keeps the look it had: nobody who passes it today changes.
  assert.match(css, /\.ab:disabled, \.ab\[aria-disabled='true'\] \{ opacity: 0\.35; cursor: not-allowed; transform: none; \}/);
  // THERE IS ONE: no other file under app/ or components/ exports an `ActionButton`.
  const makers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && /export (?:const|function|default function|class) ActionButton\b|export \{[^}]*\bActionButton\b[^}]*\}(?! from)/.test(stripComments(readFileSync(full, 'utf8')))) makers.push(full.slice(WEB.length + 1));
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'components'));
  assert.deepEqual(makers, ['components/action-button.tsx'], 'a second ActionButton exists — one of them would win by accident');
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
  // The actions, through the house button: Restore = neutral, Reset… = danger — the SAME width (and the button's one
  // 40-px height), each the row's last thing (its right edge).
  const btn = (r: { html: string }) => /<button type="button"[^>]*class="(ab [^"]*)" data-tone="([a-z]+)"[^>]*>[\s\S]*?<span class="lbl">([^<]+)<\/span><\/button><\/div>/.exec(r.html);
  const restore = btn(rows[0]!);
  const reset = btn(rows[1]!);
  assert.ok(restore && reset, 'anti-vacuity: the two buttons were not found at their rows’ right end');
  assert.deepEqual([restore[2], restore[3]], ['neutral', 'Restore']);
  assert.deepEqual([reset[2], reset[3]], ['danger', 'Reset…'], 'Reset… is not the danger tone, or lost its "…" (it opens a confirm)');
  const size = (c: string) => c.split(' ').filter((x) => /^!?(w-|h-|min-|px-)/.test(x)).sort().join(' ');
  assert.equal(size(restore[1]!), size(reset[1]!), 'Restore and Reset… are not the same size');
  assert.equal(size(restore[1]!), '!px-0 w-[104px]');
  assert.doesNotMatch(html, /terracotta|gild|opacity-40/, 'a quiet row is back on the gold fill or the faded look');
  for (const r of rows.slice(0, 2)) assert.match(r.html, /<svg[^>]*lucide/, `${r.key}’s button has no mark (the button rule: icon + word)`);
  assert.equal(count(rows[2]!.html, /<button/g), 0, 'About has a button');
  assert.equal(count(html, /<button/g), 2);
  assert.doesNotMatch(html, /aria-disabled|data-waiting/, 'Restore waits although there is something to restore');
  // With nothing to restore: the WAITING button — announced, still a button, never the native disabled.
  const none = await drawRows({ canRestore: false });
  assert.match(none, /<button type="button" aria-disabled="true" data-waiting="" aria-label="Restore" title="Restore" class="ab ab-neutral w-\[104px\] !px-0" data-tone="neutral">/);
  assert.doesNotMatch(none, /opacity-40| disabled=""/);
  // Outside a Maker that holds a draft there is nothing to restore or reset: only About.
  const bare = await drawRows(null);
  assert.equal(count(bare, /<button/g), 0);
  assert.match(bare, /Made with Setnayan/);
});

test('(3) nothing else changed: Restore runs the draft bar’s own restore, Reset… only opens its confirm — no request', () => {
  const src = read(TOOLS);
  const rows = src.slice(src.indexOf('export function StudioQuietRows()'), src.indexOf('export const STUDIO_LOOK_LABEL'));
  assert.ok(rows.length > 400, 'anti-vacuity: StudioQuietRows was not found');
  assert.match(rows, /waiting=\{!draft\.canRestore\} onClick=\{\(\) => draft\.canRestore && draft\.restore\(\)\}/, 'Restore can run with nothing to restore');
  assert.match(src, /import \{ ActionButton \} from '@\/components\/action-button';/, 'the quiet rows draw a button that is not the house one');
  assert.match(rows, /onClick=\{\(\) => window\.dispatchEvent\(new Event\(MAKER_OPEN_RESET_EVENT\)\)\}/, 'Reset… no longer opens the draft bar’s one confirm');
  assert.doesNotMatch(rows, /makerSave|hubDraftAction|fetch\(|router|studioDraftKeep/, 'a quiet row asks the server by itself');
  assert.doesNotMatch(rows, /terracotta|STUDIO_QUIET_BUTTON|className="[^"]*opacity/, 'a quiet row hand-makes its button again');
  assert.equal(count(rows, /<ActionButton\b/g), 2);
  assert.equal(count(rows, /className=\{QUIET_ACTION\}/g), 2, 'the two buttons do not share one size');
  // Drawn where it was: at the foot of Studio › Info, and nowhere else.
  assert.equal(count(read(`${L}/maker-details.tsx`), /<StudioTool part="quiet" \/>/g), 1);
});
