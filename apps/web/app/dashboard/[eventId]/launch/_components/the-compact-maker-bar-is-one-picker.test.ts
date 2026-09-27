/**
 * the-compact-maker-bar-is-one-picker.test.ts — owner, 2026-09-27, on the
 * compact Maker bar showing "● Invitation ▾" + "Logo ▾": *"combine them in 1
 * dropdown"* (DECISION_LOG: "THE COMPACT MAKER BAR IS ONE PICKER, NOT TWO").
 *
 * What the couple sees, held by EXECUTING the pure picker model:
 *   · the button names where they are — "Invitation" on a stage, "Logo" on a page;
 *   · the list is two labelled groups: Stages (Save the Date · Invitation · On
 *     the Day · Post Event, live-today dot kept) then Pages (Details · Logo ·
 *     Hero · Reveal · Love Story · RSVP, and Prints & Tickets, which the old
 *     Pages picker also listed — collapsing the bar must not hide a door);
 *   · a pick hands back the very `MAKER_BAR` item the full row's button presses.
 *
 * And, by source (no DOM in this runner): the compact nav mounts ONE PickMenu
 * fed by that model, and PickMenu draws a group as `role="group"` with its name,
 * the heading never a button — so arrow keys and first focus skip it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import { MAKER_BAR, makerPlaceItem, makerPlacePick } from './maker-bar';
import { pickRuns } from '../../website/editor/_components/pick-menu-place';

const HERE = dirname(fileURLToPath(import.meta.url));
const STAGES = PUBLIC_STAGE_ORDER.map((p) => PUBLIC_STAGE_LABELS[p]);
const PAGES = ['Details', 'Logo', 'Hero', 'Reveal', 'Love Story', 'RSVP', 'Prints & Tickets'];

const labelOf = (m: ReturnType<typeof makerPlacePick>) => m.options.find((o) => o.key === m.value)?.label;

test('on a stage, the one picker says the stage — with the live-today dot', () => {
  const m = makerPlacePick({ stage: 'rsvp', liveStage: 'rsvp', openTool: null, hasWork: true });
  assert.equal(m.value, 'rsvp');
  assert.equal(labelOf(m), 'Invitation');
  assert.equal(m.options.find((o) => o.key === 'rsvp')?.dot, true);
  assert.deepEqual(m.options.filter((o) => o.dot).map((o) => o.key), ['rsvp'], 'one dot, on the live stage');
});

test('on a page, the one picker says the page, not the stage behind it', () => {
  const m = makerPlacePick({ stage: 'rsvp', liveStage: 'rsvp', openTool: 'logo', hasWork: true });
  assert.equal(m.value, 'logo');
  assert.equal(labelOf(m), 'Logo');
  // The RSVP page is its own key — never mistaken for the Invitation stage (`rsvp`).
  const r = makerPlacePick({ stage: 'rsvp', liveStage: null, openTool: 'rsvp-page', hasWork: true });
  assert.equal(labelOf(r), 'RSVP');
  // A selection that is not a bar page falls back to the stage.
  assert.equal(makerPlacePick({ stage: 'event', liveStage: null, openTool: 'nope', hasWork: true }).value, 'event');
});

test('the list is two labelled groups — Stages, then Pages — in the bar’s own words', () => {
  const m = makerPlacePick({ stage: 'save_the_date', liveStage: null, openTool: null, hasWork: true });
  const runs = pickRuns(m.options);
  assert.deepEqual(
    runs.map((r) => r.group),
    ['Stages', 'Pages'],
  );
  assert.deepEqual(runs[0]!.options.map((o) => o.label), STAGES);
  assert.deepEqual(STAGES, ['Save the Date', 'Invitation', 'On the Day', 'Post Event']);
  assert.deepEqual(runs[1]!.options.map((o) => o.label), PAGES);
  // Every door on the full row is in the one picker.
  assert.deepEqual(new Set(m.options.map((o) => o.key)), new Set(MAKER_BAR.map((i) => i.key)));
});

test('a pick hands back the SAME item the full row presses; pages stay shut to a non-couple', () => {
  const m = makerPlacePick({ stage: 'rsvp', liveStage: null, openTool: null, hasWork: true });
  for (const o of m.options) {
    const item = makerPlaceItem(o.key, true);
    assert.equal(item, MAKER_BAR.find((i) => i.key === o.key), `${o.key} must be the bar's own item`);
  }
  assert.equal(makerPlaceItem('event', false)?.key, 'event', 'anyone can move between stages');
  assert.equal(makerPlaceItem('logo', false), null, 'a page is the couple’s alone');
  assert.equal(makerPlaceItem('nope', true), null);
  const shut = makerPlacePick({ stage: 'rsvp', liveStage: null, openTool: null, hasWork: false });
  assert.ok(shut.options.filter((o) => o.group === 'Pages').every((o) => o.disabledNote));
  assert.ok(shut.options.filter((o) => o.group === 'Stages').every((o) => !o.disabledNote));
});

test('the compact nav mounts ONE picker fed by that model; the wide row is untouched', () => {
  const shell = stripComments(readFileSync(join(HERE, 'maker-shell.tsx'), 'utf8'));
  const start = shell.indexOf('if (compact) {');
  const compact = shell.slice(start, shell.indexOf('</nav>', start));
  assert.ok(start > 0, 'found the compact bar');
  assert.equal((compact.match(/<PickMenu\b/g) ?? []).length, 1, 'the compact bar has exactly one picker');
  assert.match(compact, /dataAttr="data-maker-place-pick"/);
  assert.match(compact, /value=\{place\.value\}/);
  assert.match(compact, /options=\{place\.options\}/);
  assert.match(compact, /const item = makerPlaceItem\(key, hasWork\);\s*if \(item\) onPress\(item\);/);
  assert.match(shell, /const place = makerPlacePick\(\{/);
  // The full row still draws a button per item.
  const wide = shell.slice(shell.indexOf('</nav>', start));
  assert.match(wide, /data-maker-bar-item=\{item\.key\}/);
});

test('PickMenu draws a group as a named role="group" whose heading is not a button', () => {
  const pm = stripComments(readFileSync(resolve(HERE, '../../website/editor/_components/pick-menu.tsx'), 'utf8'));
  const group = /<li\s[^>]*role="group"[\s\S]*?<\/li>/.exec(pm)?.[0] ?? '';
  assert.match(group, /aria-label=\{run\.group\}/, 'the group is announced by name');
  const heading = /<p aria-hidden[^>]*>\s*\{run\.group\}\s*<\/p>/.exec(group)?.[0];
  assert.ok(heading, 'a visible heading, hidden from the tree (the group already names it)');
  // The group's own markup holds no button — its options come from renderOption.
  assert.doesNotMatch(group, /<button/, 'a focusable heading would be reached by the arrow keys');
  assert.match(group, /\{run\.options\.map\(renderOption\)\}/);
  assert.match(pm, /pickRuns\(options\)/, 'runs come from the tested helper');
  // Arrow keys and first focus only ever reach option buttons.
  assert.match(pm, /querySelectorAll<HTMLButtonElement>\('button:not\(\[disabled\]\)'\)/);
});
