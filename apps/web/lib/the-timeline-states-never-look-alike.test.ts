/**
 * the-timeline-states-never-look-alike.test.ts — EMPTY · LOADING · PROBLEM, on Studio › Schedule and › Love Story.
 *
 * Owner-approved gallery § 16 (`prototypes/control_templates_2026-10-08.html`): *"Three states that must never look
 * alike. Nothing here yet · still loading · something went wrong."* — *"loading shows soft grey shapes of what is
 * coming, shimmering … Empty says what to do first and gives the button to do it. A problem says so in plain words
 * with Try again, and never pretends the list is empty."* And the standing rule: a failure never renders as
 * success, zero or empty.
 *
 *   (1) THE THREE PIECES, PAINTED — loading is busy, shimmering shapes on the real row's own band and line, with no
 *       words to read and nothing to press; empty has words and the FIRST ACTION; a problem is an alert in other
 *       words with Try again. No two share their words, their role, or their button.
 *   (2) AN EMPTY DAY (Schedule) gives the first action — ONE Add button, the page's main one — and a viewer gets
 *       words only. With a moment on the day, no empty state.
 *   (3) A REFUSED READ SAYS SO — the Schedule page (in the Maker) returns the problem BEFORE anything could seed a
 *       run of show over moments it failed to read, and outside the Maker throws as it always did; the Love Story
 *       page (in the Maker) returns the problem instead of redirecting the couple away. A read that ANSWERED is
 *       untouched.
 *   (4) TRY AGAIN IS ONE RE-READ PER TAP — nothing retries by itself.
 *   (5) LOADING is what the Studio shows while either page streams in; the shipped Maker keeps its words.
 *   (6) THE LOVE STORY'S SAMPLE (the owner's "show what it could look like with boxes") is not a loading list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SCHED = 'app/dashboard/[eventId]/schedule';
const STORY = 'app/dashboard/[eventId]/website/our-story';
/** The words a person can read (tags and attributes aside). */
const words = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

test('(1) loading, empty and a problem never look alike — their words, their role and their button all differ', async () => {
  const R = await import('../app/_components/timeline-row');
  const loading = await paint(React.createElement(R.TimelineRowsLoading, { label: 'Loading your schedule', rows: 4, pills: 2 }));
  const empty = await paint(React.createElement(R.TimelineEmpty, { title: 'No moments yet', action: 'Add a moment', onAction: () => {}, actionClassName: 'main', children: 'Add the first thing that happens on the day.' }));
  const problem = await paint(React.createElement(R.TimelineProblem, { title: 'We could not load your schedule', onRetry: () => {}, children: 'Your moments are safe.' }));
  // LOADING: busy, named for a screen reader, shimmering — and nothing to read or press.
  assert.match(loading, /^<div role="status" aria-busy="true" aria-label="Loading your schedule" data-timeline-loading=""/);
  assert.match(loading, /\banimate-pulse\b[^"]*\bmotion-reduce:animate-none\b/, 'loading does not shimmer, or shimmers under reduced motion');
  assert.equal(words(loading), '', 'loading shows words — it could be read as an empty list');
  assert.doesNotMatch(loading, /<button/);
  // …shapes of WHAT IS COMING: the real row's own band and line, a pill for each time, a line for the name.
  assert.equal((loading.match(new RegExp(`class="${R.TIMELINE_BAND_CLASS.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}"`, 'g')) ?? []).length, 4);
  assert.equal((loading.match(new RegExp(`class="${R.TIMELINE_ROW_CLASS.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}"`, 'g')) ?? []).length, 4);
  assert.equal((loading.match(/h-10 w-\[72px\] shrink-0 rounded-full/g) ?? []).length, 8, 'not two time pills a row');
  // EMPTY: words, and the first action. Not busy, not an alert, no shimmer.
  assert.equal(words(empty), 'No moments yet Add the first thing that happens on the day. Add a moment');
  assert.match(empty, /<button[^>]*data-timeline-first=""[^>]*class="[^"]*\bmain\b/);
  assert.doesNotMatch(empty, /aria-busy|role="alert"|animate-|Try again/);
  // A PROBLEM: an alert, in its own words, with Try again — never the empty state's words.
  assert.match(problem, /^<div role="alert" data-timeline-problem-state=""/);
  assert.equal(words(problem), 'We could not load your schedule Your moments are safe. Try again');
  assert.match(problem, /<button[^>]*data-timeline-retry=""[^>]*>\s*Try again/);
  assert.doesNotMatch(problem, /aria-busy|animate-|data-timeline-first|No moments yet/);
  // With no way to retry there is no dead button.
  assert.doesNotMatch(await paint(React.createElement(R.TimelineProblem, { title: 't', onRetry: null, children: 'b' })), /<button/);
  // Pairwise: no two states share a word a person reads, a role, or a button.
  const sets = [loading, empty, problem].map((h) => new Set(words(h).toLowerCase().split(' ').filter((w) => w.length > 3)));
  for (let i = 0; i < 3; i += 1) for (let j = i + 1; j < 3; j += 1) for (const w of sets[i]!) assert.ok(!sets[j]!.has(w) || w === 'your' || w === 'moments', `two states both say “${w}”`);
  const marks = [loading, empty, problem].map((h) => [/role="status"/.test(h), /role="alert"/.test(h), /data-timeline-first/.test(h), /data-timeline-retry/.test(h)].join());
  assert.equal(new Set(marks).size, 3);
});

test('(2) an empty day gives the first action — ONE Add button, the main one; a viewer gets words only; a day with a moment has no empty state', async () => {
  const { StudioDay } = await import(`../${SCHED}/_components/studio-day`);
  const { DayActionsContext } = await import(`../${SCHED}/_components/day-ui`);
  const { PILL_ON_CLASS } = await import('../app/_components/pill-selector');
  const day = (props: Record<string, unknown>) =>
    paint(
      React.createElement(
        DayActionsContext.Provider,
        { value: {} as never },
        React.createElement(StudioDay, { eventId: 'ev-1', dateKey: '2026-12-12', moments: [], canEdit: true, onPatch: () => {}, onAdd: () => {}, onMore: () => {}, notice: null, ...props }),
      ),
    );
  const empty = await day({});
  assert.match(empty, /data-timeline-empty=""/);
  assert.match(empty, />No moments yet</);
  assert.match(empty, />Add the first thing that happens on the day\. You can add the rest later\.</);
  // ONE Add button — in the middle, wearing the page's main-button look — not a second one pinned at the foot.
  assert.equal((empty.match(/data-studio-add-moment=""/g) ?? []).length, 1);
  assert.ok(new RegExp(`<button[^>]*data-studio-add-moment=""[^>]*data-timeline-first=""[^>]*class="[^"]*${PILL_ON_CLASS}`).test(empty), 'the first action is not the main button');
  assert.doesNotMatch(empty, /sn-glass-row/);
  // A viewer: the words, nothing to press.
  const view = await day({ canEdit: false });
  assert.match(view, />Nothing has been added to the day yet\.</);
  assert.doesNotMatch(view, /<button[^>]*data-studio-add-moment/);
  // A day with a moment: rows and the foot button — no empty state.
  const one = await day({
    moments: [{ block_id: 'a', label: 'Ceremony', block_type: 'custom', start_at: '2026-12-12T15:00:00.000Z', end_at: '2026-12-12T16:00:00.000Z', location: null, notes: null, is_public: true, parent_block_id: null, run_state: 'upcoming', staged: false, responsible_party: null, responsible_vendor_ids: [], audience: null }],
  });
  assert.doesNotMatch(one, /data-timeline-empty/);
  assert.match(one, /sn-glass-row[^"]*"><button[^>]*data-studio-add-moment=""/);
  // The empty state is never where a NOTICE (a refused write) is lost: it is drawn above either.
  assert.match(await day({ notice: 'That change did not save.' }), /role="alert"[^>]*>That change did not save\.<[\s\S]*data-timeline-empty/);
});

test('(3) a refused read says so — before a run of show could be seeded over it, and instead of throwing the couple out of the Maker', () => {
  const sched = read(`${SCHED}/page.tsx`);
  // In the Maker the refused read becomes null; anywhere else it throws exactly as before.
  assert.match(sched, /fetchScheduleBlocks\(supabase, eventId\)\.catch\(\(error: unknown\) => \{\s*if \(!inMaker\) throw error;\s*logQueryError\('SchedulePage\.blocks', error, \{ eventId \}, 'graceful_degrade'\);\s*return null;\s*\}\),/);
  assert.match(sched, /if \(blocks === null\) \{\s*return \(\s*<TimelineReadProblem title="We could not load your schedule">/);
  // …and the page STOPS there: nothing that reads `blocks` as a list — least of all the seed — runs first.
  const stop = sched.indexOf('if (blocks === null)');
  const seed = sched.indexOf('seedNonWeddingRunOfShow(eventId)');
  assert.ok(stop > -1 && seed > -1 && stop < seed, 'a run of show could be seeded over moments the page merely failed to read');
  assert.ok(stop < sched.indexOf('let scheduleBlocks = blocks;'));
  assert.equal((sched.match(/fetchScheduleBlocks\(supabase, eventId\)/g) ?? []).length, 1, 'the day is read a second time');
  // The Love Story: a read that ERRORED, in the Maker, is said — before either redirect.
  const story = read(`${STORY}/page.tsx`);
  const said = story.indexOf('if (inMaker && (eventError || membershipError)) {');
  assert.ok(said > -1, 'a refused Love Story read is not said');
  assert.match(story.slice(said, said + 400), /return \(\s*<TimelineReadProblem title="We could not load your Love Story">/);
  assert.ok(said < story.indexOf('if (!event) redirect(`/dashboard/${eventId}`);'), 'the couple is redirected away before the problem is said');
  assert.ok(said < story.indexOf("if (membership?.member_type !== 'couple')"));
  // A read that ANSWERED — no such event, not the couple — still redirects exactly as before.
  assert.match(story, /if \(!event\) redirect\(`\/dashboard\/\$\{eventId\}`\);/);
  assert.match(story, /if \(membership\?\.member_type !== 'couple'\) \{\s*redirect\(`\/dashboard\/\$\{eventId\}\/website`\);/);
  // Neither problem uses the empty state's words.
  for (const src of [sched, story]) assert.doesNotMatch(src.slice(src.indexOf('<TimelineReadProblem'), src.indexOf('</TimelineReadProblem>')), /No moments yet|No chapters yet|nothing/i);
});

test('(4) Try again is ONE re-read per tap — nothing retries by itself', () => {
  const src = read('app/_components/timeline-read-problem.tsx');
  assert.match(src, /<TimelineProblem title=\{title\} onRetry=\{asking \? null : \(\) => start\(\(\) => router\.refresh\(\)\)\}>/);
  assert.equal((src.match(/router\.refresh\(/g) ?? []).length, 1);
  assert.doesNotMatch(src, /useEffect|setInterval|setTimeout|requestAnimationFrame|visibilitychange|focus/, 'the problem state retries by itself');
  // While one re-read is on its way there is no second button to press.
  assert.match(src, /aria-busy=\{asking\}/);
  // It is for a READ: nothing that writes imports it.
  for (const rel of [`${SCHED}/actions.ts`, `${STORY}/actions.ts`, `${SCHED}/_components/studio-day.tsx`, `${STORY}/_components/moment-order-cards.tsx`]) {
    assert.doesNotMatch(read(rel), /timeline-read-problem/, `${rel} retries a write by re-reading the page`);
  }
});

test('(5) while either page streams in, the Studio shows the rows that are coming; the shipped Maker keeps its words', () => {
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /<Suspense fallback=\{stagesStudio \? <TimelineRowsLoading label="Loading your schedule" rows=\{4\} pills=\{2\} \/> : <p className="p-6 text-sm text-ink\/60">Opening your schedule…<\/p>\}>\s*<CoupleSchedulePage/);
  assert.match(launch, /<Suspense fallback=\{stagesStudio \? <TimelineRowsLoading label="Loading your Love Story" rows=\{3\} \/> : <p className="p-6 text-sm text-ink\/60">Opening your Love Story…<\/p>\}>\s*<OurStoryEditorPage/);
});

test('(6) the Love Story’s sample (an empty story) is not a loading list: it is still, it has words, and the first action is there', async () => {
  const { MomentOrderCards } = await import(`../${STORY}/_components/moment-order-cards`);
  const R = await import('../app/_components/timeline-row');
  const action = async () => {};
  const empty = await paint(
    React.createElement(MomentOrderCards, {
      action,
      moments: [],
      mediaUrls: {},
      sheet: { action, moments: [], partners: [], ownsPro: false, storeShell: false, proHref: '/p', proPrice: null, eventId: 'ev-1', mediaUrls: {} },
      add: { can: true },
    }),
  );
  const loading = await paint(React.createElement(R.TimelineRowsLoading, { label: 'Loading your Love Story' }));
  assert.match(empty, />No chapters yet\.</);
  assert.match(empty, /data-studio-story-sample=""/);
  assert.doesNotMatch(empty, /animate-|aria-busy|role="alert"/, 'an empty story shimmers or reads as busy');
  assert.match(empty, /<button[^>]*data-studio-add-moment=""[^>]*>[\s\S]*?Add a chapter</, 'an empty story gives no first action');
  assert.notEqual(words(empty), words(loading));
  assert.ok(words(empty).includes('How we met'), 'the sample lost its chapter names — it would be bare grey shapes, like loading');
});
