/**
 * ✨ A DESKTOP STACKS ANIMATE — A PHONE KEEPS ONE PHASE (owner 2026-10-07, answer 3 "A" on
 * `MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md`: "On desktop, Style stacks … and Animate stacks Build in · Action ·
 * Build out"; the doc's build plan, PR 3: "Guarded by a test that the phone still renders one phase at a time").
 *
 *   1 · THE PHONE: ONE PHASE — `StageAnimate` as a phone draws it (and as every first render draws it: the desk's
 *       stack is handed in only by a client store whose server answer is null) is the four rows of ONE phase under
 *       ONE Build in | Action | Build out bar; nothing of the stack is in it. Sabotage: the store's server answer
 *       made the stack → red.
 *   2 · THE DESKTOP: THREE, UNDER ONE BAR — `DeskAnimateStack` draws the bar once and Build in, Action and Build out
 *       each as its own section, each that phase's own rows (`AnimateRows` with `phase`, `bare` — no second bar), in
 *       the phone's order and words. Sabotage: a section drawing its own bar → red.
 *   3 · HANDED IN ONLY WHILE THE COLUMNS ARE ON — the stack is set by `useDeskAnimate(desk)` in the toolbar (whose
 *       `desk` is a desktop's width; the toolbar is drawn there only with the columns on) and taken back on unmount;
 *       a one-phase page (`only`) keeps its four rows. Sabotage: `!p.only` dropped → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const PANEL = `../${L}/stage-panel`;
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));

const noop = () => {};
const props = {
  move: { in: { value: 'calm', onPick: noop }, out: { value: 'calm', onPick: noop } },
  plays: { value: 'scroll', onPick: noop },
  inFx: { fade: true },
  outFx: { blur: true },
  onIn: noop,
  onOut: noop,
  does: { value: 'still', options: [{ key: 'still', label: 'Still' }, { key: 'drift', label: 'Drift' }], onPick: noop },
  leaves: { value: 'scroll', options: [{ key: 'scroll', label: 'As it scrolls away' }], onPick: noop },
};
const count = (html: string, re: RegExp) => [...html.matchAll(re)].length;

test('1 · the phone (and every first render) draws ONE phase under ONE bar', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageAnimate } = await import(`${PANEL}/stage-animate`);
  const { setDeskAnimateStack } = await import(`${PANEL}/store`);
  const { DeskAnimateStack } = await import(`${PANEL}/desk`);
  for (const handedIn of [false, true]) {
    /* Even with the stack handed in, a first render is the phone's: the store's server answer is null. */
    setDeskAnimateStack(handedIn ? DeskAnimateStack : null);
    const html = renderToStaticMarkup(React.createElement(StageAnimate, props));
    assert.equal(count(html, /data-stage-phases="animate"/g), 1, 'not one Build in | Action | Build out bar');
    assert.equal(count(html, /data-stage-animate="/g), 1, 'more than one phase drawn');
    assert.doesNotMatch(html, /data-desk-(?:phase|animate-stack)/, 'the desktop’s stack reached a phone’s render');
  }
  setDeskAnimateStack(null);
  const store = read(`${L}/stage-panel/store.ts`);
  assert.match(store, /useSyncExternalStore\(subscribe, \(\) => deskAnimate, \(\) => null\)/, 'the stack’s server answer is not null');
});

test('2 · a desktop draws the three phases stacked under the one bar, each its own rows', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DeskAnimateStack } = await import(`${PANEL}/desk`);
  const html = renderToStaticMarkup(React.createElement(DeskAnimateStack, props));
  assert.equal(count(html, /data-stage-phases="animate"/g), 1, 'the stack has not exactly one bar');
  const sections = [...html.matchAll(/<section[^>]*data-desk-phase="(in|act|out)"[^>]*aria-label="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(sections, ['in:Build in', 'act:Action', 'out:Build out'], 'the phases are not stacked in the phone’s order and words');
  /* Each section is that phase's own rows, and none draws a bar of its own. */
  for (const k of ['in', 'act', 'out']) {
    const at = html.indexOf(`data-desk-phase="${k}"`);
    const next = html.indexOf('<section', at + 1);
    const body = html.slice(at, next < 0 ? undefined : next);
    assert.equal(count(body, /data-stage-animate="/g), 1, `${k}: not one phase's rows`);
    assert.match(body, new RegExp(`data-stage-animate="${k}"`), `${k}: the section draws another phase`);
    assert.doesNotMatch(body, /data-stage-phases=/, `${k}: a section draws its own bar`);
  }
  /* Build in's chips and Build out's are each phase's own effects. */
  assert.match(html, /data-stage-effects="in"/);
  assert.match(html, /data-stage-effects="out"/);
  assert.match(html, /data-stage-does=""/);
});

test('3 · handed in only while a desktop’s toolbar is, and never for a one-phase page', () => {
  const animate = read(`${L}/stage-panel/stage-animate.tsx`);
  assert.match(animate, /const Stack = useDeskAnimateStack\(\);\s*return Stack && !p\.only && !p\.bare \? <Stack \{\.\.\.p\} \/> : <AnimateRows \{\.\.\.p\} \/>;/);
  const desk = read(`${L}/stage-panel/desk.tsx`);
  assert.match(desk, /export function useDeskAnimate\(desk: boolean\): void \{\s*useEffect\(\(\) => \{\s*if \(!desk\) return;\s*setDeskAnimateStack\(DeskAnimateStack\);\s*return \(\) => setDeskAnimateStack\(null\);/);
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /const desk = useIsDesktop\('lg'\);[\s\S]{0,200}useDeskAnimate\(desk\);/);
  /* The stack's sections are bare rows of their own phase. */
  assert.match(desk, /<AnimateRows \{\.\.\.p\} phase=\{k\} bare /);
});
