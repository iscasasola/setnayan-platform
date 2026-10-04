/**
 * one-panel-at-a-time-on-a-phone.test.ts — ON A PHONE THE GUIDED FLOW IS ONE
 * CHIP, AND IT CAN STILL BE WALKED.
 *
 * Owner, live iPhone test 2026-10-02: the "Finish your Event Hub" guide, the
 * Look panel and the toolbar stacked about three deep; then *"this is too
 * clumped"* — the approved phone layout (frame G) puts the flow in ONE slim chip
 * on the page that opens the guide's sheet. The room itself (≥ 55% with any
 * sheet open, nothing between the bars with none) is measured by
 * `lib/the-maker-keeps-the-page-on-a-phone.test.ts`. This file holds what that
 * sum cannot see: with the flow's line, heading and foot gone from a phone's
 * page, every one of them is in the guide's sheet — the flow can still be walked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = __dirname;
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const WORKSPACE = read('details-workspace.tsx');
const TOP = read('details-guide-top.tsx');

test('on a phone the flow is ONE chip on the page — its line, heading and foot are the desktop’s', () => {
  assert.match(WORKSPACE, /data-details-guide-chip=""/, 'the flow has no chip on a phone’s page');
  assert.match(TOP, /'flex shrink-0 items-center gap-2\.5 border-b border-ink\/10 bg-cream\/80 px-3 py-1\.5 max-lg:hidden sm:px-4'/, 'the flow’s line shows on a phone’s page again');
  assert.match(WORKSPACE, /<div data-details-guide-head-wrap="" className="hidden lg:contents">/, 'the step’s heading shows on a phone’s page again');
  assert.match(WORKSPACE, /<div data-details-guide-foot-wrap="" data-phone-chrome="strip" className="hidden lg:contents">/, 'the flow’s foot shows on a phone’s page again');
});

test('a step’s HALF SHEET holds the step ▾, the step’s heading, its field and Back · Skip · Next — the flow can be walked', () => {
  // PR-2 (owner 2026-10-04, "FOUR FIXES BEFORE BUILD"): a step is ONE half sheet
  // over the live page (`MakerHalfSheet`) — the step's line and its field
  // together, never a guide sheet AND an editor sheet.
  const at = WORKSPACE.indexOf('<MakerHalfSheet');
  const sheet = WORKSPACE.slice(at, WORKSPACE.indexOf('</MakerHalfSheet>', at));
  assert.ok(at > 0 && sheet.length > 0, 'the step is not the half sheet');
  assert.match(sheet, /data-details-guide-sheet=""/);
  assert.match(sheet, /<GuideTop [\s\S]{0,300}?inSheet \/>/, 'the step’s sheet has no step dropdown');
  assert.match(sheet, /<GuideHead step=\{stepHere\}[^>]*bare \/>/, 'the step’s sheet has no step heading');
  assert.match(sheet, /\{editorsBody\(/, 'the step’s sheet has no field');
  for (const act of ['onBack', 'onSkip', 'onNext']) assert.match(sheet, new RegExp(`${act}=\\{`), `the step’s sheet has no ${act}`);
  // One sheet at a time: no second, guide-only sheet.
  assert.doesNotMatch(WORKSPACE, /setGuideSheet|guideSheet/, 'a guide sheet came back beside the step’s sheet');
  // The unsaved-typing question is asked at the step's own foot, in its sheet — never out of sight.
  const move = WORKSPACE.slice(WORKSPACE.indexOf('const move = '), WORKSPACE.indexOf('const pickStage = '));
  assert.match(move, /setUnsavedTo\(to\);\s*return;/);
  assert.match(sheet, /warning=\{unsavedTo !== null\}/, 'the unsaved question is asked where a phone cannot see it');
});
