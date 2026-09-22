/**
 * THE RAIL STATES A NUMBER ONCE, AND A NOT-STARTED STAGE IS ITS OWN SHAPE.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Two defects the owner saw as one ("progress bar does not look clean"), both
 * measured on the shipped component rather than on a drawing of it:
 *
 *  1 · SIX STAGES PRODUCED SEVEN PERCENTAGE LABELS. `{s.pct}% complete` rendered
 *      for every stage inside the map, and `{active.pct}% complete` rendered
 *      AGAIN in the tabpanel heading below. Neither was conditional, so both
 *      were always on screen — and the duplicated one was the stage the eye is
 *      on. A screen stating one fact in two places is a screen that can start
 *      disagreeing with itself.
 *
 *  2 · ONE SHAPE CARRIED TWO MEANINGS. At 0 the `ProgressRing`'s arc is fully
 *      hidden, so it drew the TRACK circle alone — the same outline a
 *      half-finished stage draws, told apart only by colour. Two of a typical
 *      event's six stages sit at 0, and they read as things that had FAILED
 *      rather than things not begun.
 *
 * 🔑 THIS MOUNTS THE COMPONENT AND READS THE EMITTED HTML. A source grep cannot
 * count what renders: the duplicate lived in two different expressions
 * (`s.pct` and `active.pct`), so searching for a string would have found two
 * matches whether or not both ever reached a screen, and a file-level match
 * cannot count components at all. Presence of ink is not fit of ink — these
 * assertions say WHICH variant is drawn at 0, at 1–99 and at 100, and HOW MANY
 * times a number appears.
 *
 * 🪤 `globalThis.React` IS SET BEFORE THE DYNAMIC IMPORT AND IS NOT TIDINESS TO
 * BE REMOVED. tsconfig sets `"jsx": "preserve"`, so `tsx` compiles these
 * components to the CLASSIC runtime — bare `React.createElement` with no import
 * of its own — and a static import would hoist above the assignment. Precedent:
 * `app/pay/[reference]/_components/one-stage-at-a-time.test.ts`.
 * ────────────────────────────────────────────────────────────────────────────
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import type { ProgressStage, ProgressStageKey } from '@/lib/progress-stages';

(globalThis as unknown as { React: unknown }).React = React;

/*
  🪤 EVERY COMPONENT IMPORT STAYS DYNAMIC AND INSIDE A FUNCTION. A top-level
  `await import()` fails outright here — tsx compiles this file to CJS and
  esbuild refuses top-level await — and a STATIC import would hoist above the
  `globalThis.React` assignment above, which the classic JSX runtime needs.
  Same shape as `app/pay/[reference]/_components/one-stage-at-a-time.test.ts`.
*/

/**
 * Six stages with DISTINCT non-zero percentages on purpose: a repeated figure
 * would confound the occurrence counts below, and "exactly one" is the whole
 * claim. Two zeros, because two zeros is what a real event carries.
 */
function stages(): ProgressStage[] {
  const mk = (key: string, label: string, pct: number): ProgressStage =>
    ({ key, label, pct, done: [], todo: [], aiNote: null }) as unknown as ProgressStage;
  return [
    mk('dreaming', 'Dreaming', 100),
    mk('booking', 'Booking', 41),
    mk('inviting', 'Inviting', 23), // ← the current stage
    mk('finalizing', 'Finalizing', 7),
    mk('wedding', 'Wedding day', 0),
    mk('after', 'After', 0),
  ];
}

async function paint(
  rows: ProgressStage[] = stages(),
  currentKey: ProgressStageKey = 'inviting' as ProgressStageKey,
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { JourneyRail } = await import('./journey-rail');
  return renderToStaticMarkup(
    React.createElement(JourneyRail, { stages: rows, currentKey, aiActive: false }),
  );
}

const count = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

/**
 * A percentage label, counted at its TAG BOUNDARY.
 *
 * 🪤 THE SUBSTRING TRAP THIS TEST FELL INTO ON ITS FIRST RUN. `"100% complete"`
 * CONTAINS `"0% complete"`, so a bare substring count reported three zero-labels
 * where the rail draws two — and it would equally have hidden a real duplicate
 * behind a neighbouring number. The label always renders as the text of its own
 * element, so the closing `>` before it is the boundary that makes the count
 * mean what it says.
 */
const labelCount = (html: string, pct: number): number => count(html, `>${pct}% complete`);

test('the rail renders at all — so every count below means something', async () => {
  const html = await paint();
  assert.ok(html.length > 500, `suspiciously small render (${html.length} chars)`);
  assert.ok(html.includes('Inviting'), 'the current stage name is missing');
  assert.ok(html.includes('You are here'), 'the current-stage marker is missing');
});

test('the ACTIVE stage states its percentage exactly once', async () => {
  const html = await paint();
  const active = labelCount(html, 23);
  console.log(`  "23% complete" (the active stage) rendered ${active} time(s)`);
  assert.equal(active, 1, 'the active stage prints its number more than once');
});

test('…and so does every other stage — six stages, six labels, not seven', async () => {
  const html = await paint();
  const labels = count(html, '% complete');
  console.log(`  total "% complete" labels: ${labels} for 6 stages`);
  assert.equal(labels, 6, 'a seventh percentage label is on screen');
  for (const pct of [100, 41, 23, 7]) {
    assert.equal(labelCount(html, pct), 1, `${pct}% appears more than once`);
  }
  assert.equal(labelCount(html, 0), 2, 'the two not-started stages each label once');
  // …and the boundary is doing real work: the naive count is provably different.
  assert.equal(count(html, '0% complete'), 3, 'the 100% label contains a 0% substring');
});

test('the duplicate returns if the heading repeats it — the guard can fail', () => {
  /*
    The counter must be able to say 2. Proven against a string that contains the
    duplicate, so a green "exactly once" above is evidence rather than an
    artefact of a counter that only ever returns 1.
  */
  const withDupe = '<b>23% complete</b><h3>Inviting <span>23% complete</span></h3>';
  assert.equal(labelCount(withDupe, 23), 2);
  // and the boundary does not lose a legitimate label
  assert.equal(labelCount('<span>7% complete</span>', 7), 1);
});

test('three states, three SHAPES — not one shape in three greys', async () => {
  const html = await paint();
  const notStarted = count(html, 'data-stagemark="not-started"');
  const partial = count(html, 'data-stagemark="partial"');
  const complete = count(html, 'data-stagemark="complete"');
  console.log(`  stage marks — not-started: ${notStarted} · partial: ${partial} · complete: ${complete}`);
  assert.equal(complete, 1, 'exactly one stage is at 100');
  assert.equal(partial, 3, 'three stages are between 1 and 99');
  assert.equal(notStarted, 2, 'two stages are at 0');
  assert.equal(notStarted + partial + complete, 6, 'every stage carries exactly one mark');
});

test('a not-started stage draws NO ring — the shape differs, not just the colour', async () => {
  /*
    ⚠ THE POINT OF THE FIX, ASSERTED STRUCTURALLY. `ProgressRing` emits an
    <svg>; a 0% stage must not. Counting svgs proves the 0 case is a different
    KIND of mark rather than the same ring in a paler grey, which a colour
    assertion could never distinguish.
  */
  const html = await paint();
  const svgs = count(html, '<svg');
  console.log(`  <svg> rings drawn: ${svgs} (expected 3 — the 1–99 stages only)`);
  assert.equal(svgs, 3, 'a not-started or complete stage is still drawing a ring');
});

test('an all-zero event draws six dots and no rings at all', async () => {
  /*
    The brand-new event — the state where the old behaviour was worst, because
    every stage was a full grey circle and the whole rail read as six failures.
  */
  const zeroed = stages().map((s) => ({ ...s, pct: 0 }));
  const html = await paint(zeroed, 'dreaming' as ProgressStageKey);
  console.log(
    `  all-zero event — dots: ${count(html, 'data-stagemark="not-started"')} · rings: ${count(html, '<svg')}`,
  );
  assert.equal(count(html, 'data-stagemark="not-started"'), 6);
  assert.equal(count(html, '<svg'), 0, 'a zeroed rail must draw no progress rings');
  assert.equal(count(html, '% complete'), 6, 'the labels still state the stage figures');
});
