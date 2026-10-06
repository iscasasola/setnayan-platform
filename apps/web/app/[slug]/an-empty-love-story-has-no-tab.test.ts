/**
 * AN EMPTY LOVE STORY HAS NO TAB — "Our Love Story" shows once it has a chapter.
 *
 * Found live by the controller, 2026-10-05, on maria-and-jose at 375 px: the
 * "Our Love Story" tab was in the guest bar and landed on nothing but the
 * footer's "See you soon." Its `events.love_story` is `{}` (read from prod), and
 * the menu asked `Boolean(event.love_story)` — true for an empty object. The
 * setup already promises the rule: *"the Our Love Story page — it opens with the
 * first chapter you fill"* (`lib/hub-setup-steps.ts`).
 *
 * Holds: `storyTabHasChapter` says no for `{}` (with the couple's scene on the
 * page and without), yes once a chapter is filled; the bar then draws no tab
 * (`resolveSiteNav`); and BOTH menus (the public/host page and the guest's)
 * ask it — never the truthiness of the column, never "open-browse, so always".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { storyTabHasChapter } from './_components/our-story';
import { resolveSiteNav } from './_lib/site-nav';
import { STAGE_BAR } from './_lib/stage-bar';

/** maria-and-jose's `love_story`, as prod holds it (read 2026-10-05). */
const MJ_LOVE_STORY = {};

const barFor = (hasStory: boolean) =>
  resolveSiteNav({
    viewer: { kind: 'guest' },
    phase: 'before',
    hostAllowsCamera: false,
    anyChapterPublic: false,
    hasStory,
    hasDetails: true,
    liveBroadcast: false,
    tabbed: true,
    stageSlots: STAGE_BAR.rsvp.slots,
  }).map((s) => s.label);

test('1 · maria-and-jose’s `{}` has no chapter — the tab is not drawn', () => {
  // The couple's "Our love story" scene is on maria-and-jose's page (visible row) …
  assert.equal(storyTabHasChapter(MJ_LOVE_STORY, true), false);
  // … and without it the prose stands in — also nothing to tell.
  assert.equal(storyTabHasChapter(MJ_LOVE_STORY, false), false);
  assert.equal(storyTabHasChapter(null, true), false);
  assert.deepEqual(barFor(storyTabHasChapter(MJ_LOVE_STORY, true)), ['Welcome', 'Details', 'Me']);
});

test('2 · the first chapter filled opens the tab', () => {
  const told = { how_we_met: 'We met at a friend’s birthday in Makati' };
  assert.equal(storyTabHasChapter(told, true), true);
  assert.equal(storyTabHasChapter(told, false), true);
  assert.deepEqual(barFor(storyTabHasChapter(told, true)), ['Welcome', 'Details', 'Our Love Story', 'Me']);
});

test('3 · both menus ask `storyTabHasChapter`, never the column’s truthiness', () => {
  const body = readFileSync(join(process.cwd(), 'app/[slug]/_components/site-body.tsx'), 'utf8');
  const code = stripComments(body);
  const gates = code.match(/story:\s*[^,]*?weddingOnly\.love_story[\s\S]*?,\n/g) ?? [];
  assert.equal(gates.length, 2, `expected the public and the guest menu's story gate, found ${gates.length}`);
  for (const g of gates) {
    assert.match(g, /storyTabHasChapter\(event\.love_story, storySceneShown\)/, `a story tab gate does not ask for a chapter:\n${g}`);
    assert.doesNotMatch(g, /Boolean\(event\.love_story\)/, `\`{}\` reads as a story again:\n${g}`);
    assert.doesNotMatch(g, /openBrowse/, `open-browse draws the tab empty again:\n${g}`);
  }
});
