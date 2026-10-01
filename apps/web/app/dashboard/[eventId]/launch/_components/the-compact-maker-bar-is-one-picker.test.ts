/**
 * the-compact-maker-bar-is-one-picker.test.ts — owner, 2026-09-27, on the
 * compact Maker bar showing "● Invitation ▾" + "Logo ▾": *"combine them in 1
 * dropdown"* (DECISION_LOG: "THE COMPACT MAKER BAR IS ONE PICKER, NOT TWO").
 *
 * 🗂 Re-pointed 2026-09-29 for OPTION B (owner 2026-09-28, verbatim: *"B.
 * maximize this concept so it is easier to find everything to populate the
 * event hub"*; DECISION_LOG "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS;
 * THE TOP MENU IS THE FOUR STAGES + DETAILS"): the one picker is ONE FLAT LIST
 * — Save the Date · Invitation · On the Day · Post Event · Details — "nothing
 * else"; the Stages / Pages headings went with the pages (Logo, Hero, Reveal,
 * Love Story and RSVP are items of Details now).
 *
 * What the couple sees, held by EXECUTING the pure picker model:
 *   · the button names where they are — "Invitation" on a stage, "Details" there;
 *   · the list is the four stages (live-today dot kept), then Details;
 *   · a pick hands back the very `MAKER_BAR` item the full row's button presses.
 *
 * And, by source (no DOM in this runner): the compact nav mounts ONE PickMenu
 * fed by that model, and PickMenu still draws a group (another picker may use
 * one) as `role="group"` with its name, the heading never a button.
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

const labelOf = (m: ReturnType<typeof makerPlacePick>) => m.options.find((o) => o.key === m.value)?.label;
const makerPickOpen = labelOf;

test('on a stage, the one picker says the stage — with the live-today dot', () => {
  const m = makerPlacePick({ stage: 'rsvp', liveStage: 'rsvp', openTool: null, hasWork: true });
  assert.equal(m.value, 'rsvp');
  assert.equal(labelOf(m), 'Invitation');
  assert.equal(m.options.find((o) => o.key === 'rsvp')?.dot, true);
  assert.deepEqual(m.options.filter((o) => o.dot).map((o) => o.key), ['rsvp'], 'one dot, on the live stage');
});

test('on Details, the one picker says Details, not the stage behind it', () => {
  const m = makerPlacePick({ stage: 'rsvp', liveStage: 'rsvp', openTool: 'details', hasWork: true });
  assert.equal(m.value, 'details');
  assert.equal(labelOf(m), 'Details');
  // A page that moved into Details is not a place of its own — the stage shows.
  for (const gone of ['logo', 'hero', 'reveal', 'love-story', 'rsvp-page']) {
    assert.equal(makerPlacePick({ stage: 'event', liveStage: null, openTool: gone, hasWork: true }).value, 'event', gone);
  }
  assert.equal(makerPlacePick({ stage: 'event', liveStage: null, openTool: 'nope', hasWork: true }).value, 'event');
});

test('the list is ONE FLAT LIST — the stages (RSVP among them), then Details, nothing else', () => {
  const m = makerPlacePick({ stage: 'save_the_date', liveStage: null, openTool: null, hasWork: true });
  // 🗳 2026-09-30 re-plan: the RSVP stage sits between Save the Date and the Invitation.
  assert.deepEqual(m.options.map((o) => o.label), [STAGES[0], 'RSVP', ...STAGES.slice(1), 'Details']);
  assert.deepEqual(STAGES, ['Save the Date', 'Invitation', 'On the Day', 'Post Event']);
  // No headings: one run, no group name (as PickMenu reads them).
  const runs = pickRuns(m.options.map((o) => ({ key: o.key, group: (o as Record<string, unknown>).group as string | undefined })));
  assert.equal(runs.length, 1, 'the list is split into groups again');
  assert.equal(runs[0]!.group, null, 'the list carries a heading again');
  // Every door on the full row is in the one picker, and nothing else is.
  assert.deepEqual(m.options.map((o) => o.key), MAKER_BAR.map((i) => i.key));
});

test('a pick hands back the SAME item the full row presses; Details stays shut to a non-couple', () => {
  const m = makerPlacePick({ stage: 'rsvp', liveStage: null, openTool: null, hasWork: true });
  for (const o of m.options) {
    const item = makerPlaceItem(o.key, true);
    assert.equal(item, MAKER_BAR.find((i) => i.key === o.key), `${o.key} must be the bar's own item`);
  }
  assert.equal(makerPlaceItem('event', false)?.key, 'event', 'anyone can move between stages');
  assert.equal(makerPlaceItem('details', false), null, 'Details is the couple’s alone');
  assert.equal(makerPlaceItem('logo', true), null, 'Logo is not a place of its own any more');
  assert.equal(makerPlaceItem('nope', true), null);
  const shut = makerPlacePick({ stage: 'rsvp', liveStage: null, openTool: null, hasWork: false });
  assert.ok(shut.options.find((o) => o.key === 'details')?.disabledNote, 'Details says why it is shut');
  // The RSVP stage is the couple's settings, like Details — shut, and saying why.
  assert.ok(shut.options.find((o) => o.key === 'rsvp-stage')?.disabledNote, 'the RSVP stage says why it is shut');
  assert.ok(
    shut.options.filter((o) => o.key !== 'details' && o.key !== 'rsvp-stage').every((o) => !o.disabledNote),
    'a lifecycle stage is never shut',
  );
  assert.equal(makerPickOpen(makerPlacePick({ stage: 'event', liveStage: null, openTool: 'rsvp-stage', hasWork: true })), 'RSVP');
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
