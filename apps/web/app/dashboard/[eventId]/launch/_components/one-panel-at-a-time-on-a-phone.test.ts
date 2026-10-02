/**
 * one-panel-at-a-time-on-a-phone.test.ts — THE MAKER NEVER STACKS PANELS OVER
 * THE PAGE ON A PHONE.
 *
 * Owner, live iPhone test 2026-10-02 (build 5666406): the "Finish your Event
 * Hub" guide, the Look panel and the toolbar stacked about three deep and
 * covered most of the screen. The rule (`details-workspace.tsx` docblock):
 * under `lg`, at most ONE panel shows — the open editor takes at most half the
 * height, the step's heading steps aside while it is open, and once a Maker
 * door (Look · Details · Prints) opened Details the guided flow folds to its
 * one top line (`MakerState.guideFolded`) until the couple moves in the flow.
 * The desktop keeps every part (`lg:` restores them).
 *
 * Each property is asserted on the component that holds it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = __dirname;
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const WORKSPACE = read('details-workspace.tsx');
const SHELL = read('maker-shell.tsx');

test('the open editor takes at most half a phone’s height — the page above it always shows', () => {
  const open = /sheetOpen \? 'max-h-\[(\d+)%\]'/.exec(WORKSPACE);
  assert.ok(open, 'the editor panel’s open height is no longer a phone percentage — re-read this guard');
  assert.ok(Number(open[1]) <= 50, `the open editor takes ${open[1]}% of a phone — the page is covered`);
});

test('the step’s heading steps aside on a phone while the editor is open (desktop keeps it)', () => {
  const head = /<div data-details-guide-head-wrap="" className=\{sheetOpen \? 'hidden lg:contents' : 'contents'\}>\s*<GuideHead /.exec(WORKSPACE);
  assert.ok(head, 'GuideHead is drawn on a phone beside the open editor — two panels again');
});

test('a door folds the flow to its top line on a phone; a move in the flow unfolds it', () => {
  // The foot (Back · Skip · Next) is hidden on a phone while folded — the top line stays.
  assert.match(
    WORKSPACE,
    /<div data-details-guide-foot-wrap="" data-folded=\{folded \? '' : undefined\} className=\{folded \? 'hidden lg:contents' : 'contents'\}>\s*<GuideFoot/,
    'the flow’s foot still shows on a phone after a door opened Details',
  );
  assert.match(WORKSPACE, /const folded = Boolean\(maker\?\.guideFolded\)/, 'the fold is not read from the Maker');
  assert.ok((WORKSPACE.match(/<GuideTop /g) ?? []).length === 1, 'the top line is not drawn exactly once');
  // Every move inside the flow unfolds it: a step picked, What's left, and the unsaved question.
  const goTo = WORKSPACE.slice(WORKSPACE.indexOf('const goTo = '), WORKSPACE.indexOf('const move = '));
  assert.match(goTo, /unfold\(\)/, 'picking a step leaves the flow folded — its Next is out of reach');
  const openGuide = WORKSPACE.slice(WORKSPACE.indexOf('const openGuide = '), WORKSPACE.indexOf('const allItems = '));
  assert.match(openGuide, /unfold\(\)/, 'What’s left leaves the flow folded');
  const move = WORKSPACE.slice(WORKSPACE.indexOf('const move = '), WORKSPACE.indexOf('const openGuide = '));
  assert.match(move, /unfold\(\);[^\n]*\n\s*setUnsavedTo\(to\)/, 'the unsaved-typing question is asked inside a folded (hidden) foot');

  // The shell: a door that OPENS Details folds the flow (closing it never does).
  const press = SHELL.slice(SHELL.indexOf('const pressDoor = '), SHELL.indexOf('const page = makerPageMenu'));
  const close = press.indexOf('select(null)');
  const fold = press.indexOf('setGuideFolded(true)');
  assert.ok(fold > close && close > 0, 'pressing Look / Details / Prints no longer folds the guide on a phone');
  assert.match(SHELL, /guideFolded,\s*setGuideFolded,/, 'the fold is not handed to Details through the Maker');
});
