/**
 * the-march-wears-the-templates.test.ts — STUDIO › WEDDING MARCH: ITS BUTTONS, ITS TOAST AND ITS RETRY ARE THE TEMPLATES', ITS SAVES ARE THE ONES IT ALWAYS SENT
 * (2026-10-09; `INTERACTION_RULES.md` § 9).
 *
 * control → kind:
 *   "Put the sections back in their usual order"  → Action button (`ActionButton`, quiet)
 *   "Retry" on "The march couldn't load"           → Action button (quiet) — the page's own problem line
 *   the toast and its Undo                         → Messages: toast (`PeekToast` with its one action — peeks from the top, leaves by itself)
 *   the Not-walking sheet's ✕                      → Action button (icon-only) — a ✕ is a mark everyone reads the same way
 *   dragging a name, a walk, a section              → NOT a template control (the drag surface; keyboard drag stays)
 *   the tray's names (chips)                        → NOT a template control (they are dragged)
 * NOT MOVED, and why: the tray's "+N more" (its words and its showing are set by hand by the fit pass — `march-tray-fits-without-scrolling`) and the sheet's
 * dark backdrop (the sheet hides itself while a name is lifted out of it, so the drag lands on the march behind it).
 *
 * SAVES: `lib/march-posts-the-same.golden.json` is what the march sent BEFORE (recorded from the real component in Chromium; the browser run of before and after:
 * identical calls for the reset, the Undo, a thrown save and the lab). One change on purpose: a refusal the server worded in DATABASE words was PRINTED in the toast;
 * it is now the page's own sentence (`plainRefusal`).
 *
 * SABOTAGE (each seen RED, then restored): the reset as a hand-made button · the old hand-made toast back · the Undo patch changed · the reset's patch changed · the
 * lab calling the real door · a raw refusal printed · the retry as a hand-made button · a static import of a template into a first-load file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { planSectionsDefault } from './march-drag';
import { isPlainSentence, plainRefusal } from '../app/dashboard/[eventId]/guests/_components/plain-refusal';

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
const golden = JSON.parse(readFileSync(join(__dirname, 'march-posts-the-same.golden.json'), 'utf8')) as Record<string, { calls: Array<{ action: string; fields: Record<string, string> }>; toast: string }>;
const tags = (m: string, tag: string) => [...m.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((x) => x[0]);

async function march(over: Record<string, unknown> = {}) {
  const { MarchMaker } = await import(`../${L}/details-march`);
  const { labMarchSections } = await import('../app/dev/details-lab/march-fixture');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const m = labMarchSections();
  return renderToStaticMarkup(React.createElement(MarchMaker as never, { eventId: 'E1', sections: m.sections, printed: [...m.printed].reverse(), out: m.out, ...over } as never));
}

test('1 · every button on the march is the ActionButton — the reset, and the retry of the page’s own problem line', async () => {
  const moved = await march();
  const buttons = tags(moved, 'button');
  assert.ok(buttons.length >= 1, 'the sections’ reset is not offered on a moved march');
  for (const b of buttons) assert.match(b, /class="ab /, `a hand-made button on the march: ${b.slice(0, 80)}`);
  assert.match(moved, /data-march-sections-default=""[^>]*>\s*<button[^>]*class="ab ab-neutral quiet/, 'the reset is not the quiet ActionButton');
  const unread = await march({ draftUnread: true });
  assert.match(unread, /data-march-failed=""[\s\S]*data-march-retry=""[^>]*>\s*<button[^>]*class="ab ab-neutral quiet/, 'the retry is not the ActionButton');
  assert.match(unread, /The march couldn’t load/);
  /* An unmoved march offers no reset. */
  const { labMarchSections } = await import('../app/dev/details-lab/march-fixture');
  const m = labMarchSections();
  assert.doesNotMatch(await march({ printed: m.printed }), /data-march-sections-default/ , 'a march in the usual order offers a reset');
});

test('2 · the toast is the template’s (PeekToast, one Undo action) — no hand-made strip, and the drag ignores a press on it', () => {
  const src = read(`${L}/details-march.tsx`);
  assert.match(src, /<PeekToast\s+key=\{toast\.id\}\s+tone=\{toast\.refused \? 'bad' : 'ok'\}[\s\S]{0,300}action=\{toast\.undo \? \{ label: 'Undo', onPress: undo \} : undefined\}/);
  assert.doesNotMatch(src, /data-march-toast|data-march-undo|bg-ink px-3\.5 py-2\.5 text-cream|toastTimer/, 'the hand-made toast is back');
  assert.equal((src.match(/closest\('\[data-peek-toast\]'\)/g) ?? []).length, 2, 'the drag no longer ignores a press on the toast');
  const tray = read(`${L}/details-march-tray.tsx`);
  assert.match(tray, /<ActionButton tone="neutral" quiet iconOnly icon=\{X\} label="Close" onClick=\{\(\) => setAll\(false\)\} \/>/, 'the sheet’s ✕ is not the ActionButton');
});

test('3 · the march’s saves are the ones it always sent (the recorded golden): the reset, the Undo — and nothing in the lab', async () => {
  const { labMarchSections } = await import('../app/dev/details-lab/march-fixture');
  const m = labMarchSections();
  const plan = planSectionsDefault(m.sections, [...m.printed].reverse());
  assert.ok(plan && plan.ok);
  const reset = golden.reset!.calls[0]!;
  assert.deepEqual(reset.fields, { intent: 'save', patch: JSON.stringify({ march: [plan!.steps] }) }, 'the reset sends another patch than it did');
  assert.equal(golden.undo!.calls[0]!.fields.patch, JSON.stringify({ marchUndo: true }));
  assert.deepEqual(golden.lab!.calls, [], 'the lab called an action');
  assert.equal(golden.reset!.toast, 'The sections are back in their usual orderUndo');
  const src = read(`${L}/details-march.tsx`);
  assert.match(src, /commit\(\{ sections: plan\.sections, printed: plan\.printed, out: plan\.out \?\? shownOut \}, \{ march: \[plan\.steps\] \}/);
  assert.match(src, /commit\(toast\.before, \{ marchUndo: true \}/);
  assert.match(src, /fd\.set\('intent', 'save'\);\s*fd\.set\('patch', JSON\.stringify\(patch\)\);/);
});

test('4 · a refusal in database words is never printed: the page says its own sentence — the lab can show it (?refuse=1)', () => {
  const src = read(`${L}/details-march.tsx`);
  assert.match(src, /reason: plainRefusal\(r\.error, DID_NOT_GO\)/, 'the server’s words are printed raw again');
  assert.equal(plainRefusal('new row violates row-level security policy for table "events"', 'x'), 'x');
  assert.ok(isPlainSentence('That did not go through — nothing was changed.'));
  /* The lab: a drop lands locally, never through the real door — and with ?refuse=1 it throws database words the page turns into its sentence. */
  assert.match(src, /\(lab \? labStep\(\) : draftStep\(eventId, patch\)\)\.catch\(\(\) => \(\{ ok: false as const, reason: DID_NOT_GO \}\)\)/);
  assert.match(src, /get\('refuse'\) === '1'\s*\? Promise\.reject\(new Error\('relation "events" does not exist'\)\)\s*: Promise\.resolve\(LAB_SAVED\)/);
  assert.equal(golden.refusedRaw!.toast.includes('violates'), true, 'the golden no longer records what the page used to print');
  /* Both labs set the flag. */
  assert.match(read('app/dev/details-lab/details-lab-node.tsx'), /march: marchLab \|\| studioLab \? \{ \.\.\.labMarchSections\(one\('march'\)\), lab: true \}/);
});

test('5 · FIRST LOAD: the march and the templates it wears are lazy — no first-load Maker file imports them', () => {
  const lazy = readFileSync(join(WEB, `${L}/details-lazy.tsx`), 'utf8');
  assert.match(lazy, /export const MarchMaker = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/details-march'\)/);
  for (const f of ['details-your-event-parts.tsx', 'maker-details.tsx', 'maker-shell.tsx', 'details-workspace.tsx']) {
    const src = read(`${L}/${f}`).replace(/^import type [^;]*;$/gm, '');
    assert.doesNotMatch(src, /from '\.\/details-march(?:-tray)?'|from '@\/app\/_components\/toast\/peek-toast'|from '@\/components\/action-button'/, `${f} imports the march or a template statically`);
  }
});
