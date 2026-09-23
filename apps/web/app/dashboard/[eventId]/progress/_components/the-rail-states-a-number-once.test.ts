/**
 * THE RAIL STATES A NUMBER ONCE — TREATMENT B (owner-picked 2026-09-23).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * The owner chose B from three treatments: ONE rail, six stops, one percentage.
 * His reason, relayed by the controller: A repeats the same number twice, and C
 * hides how far along they are overall; B shows the whole journey and states one
 * number.
 *
 * This file used to guard treatment A — six ringed nodes, each with its own
 * "% complete", plus a seventh repeat in the panel heading. Those assertions are
 * GONE rather than adapted, because describing A would make this suite green
 * against a rail that no longer exists. What survives is the PROPERTY the owner
 * actually picked, restated for what ships:
 *
 *   1 · exactly ONE percentage is visible, and it belongs to the current stage
 *   2 · every stage still carries its figure for a screen reader
 *   3 · three states, three SHAPES — a not-started stop is a different KIND of
 *       mark, not the same one in a paler grey
 *   4 · the rail's head sits where the stated rule puts it, not where a mock did
 *
 * 🔑 THIS MOUNTS THE COMPONENT AND READS THE EMITTED HTML. A source grep cannot
 * count what renders: the old duplicate lived in two different expressions, and
 * the figure now appears in BOTH an aria-label and (once) as visible text — a
 * string search cannot tell those apart, and the distinction is the whole test.
 *
 * 🪤 `globalThis.React` IS SET BEFORE THE DYNAMIC IMPORT AND IS NOT TIDINESS TO
 * BE REMOVED. tsconfig sets `"jsx": "preserve"`, so tsx compiles to the CLASSIC
 * runtime and a static import would hoist above the assignment. Precedent:
 * `app/pay/[reference]/_components/one-stage-at-a-time.test.ts`.
 * ────────────────────────────────────────────────────────────────────────────
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import type { ProgressStage, ProgressStageKey } from '@/lib/progress-stages';
import { railHeadPercent } from '@/lib/stage-mark';

(globalThis as unknown as { React: unknown }).React = React;

/** DISTINCT non-zero percentages: a repeated figure would confound the counts. */
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

const count = (h: string, n: string): number => h.split(n).length - 1;
/** VISIBLE percentages only — the text of an element, never an attribute. */
const visiblePcts = (h: string): string[] => h.match(/>\s*\d+% complete/g) ?? [];

test('the rail renders at all — so every count below means something', async () => {
  const html = await paint();
  assert.ok(html.length > 500, `suspiciously small render (${html.length} chars)`);
  for (const label of ['Dreaming', 'Booking', 'Inviting', 'Finalizing', 'Wedding day', 'After']) {
    assert.ok(html.includes(label), `stop missing: ${label}`);
  }
  assert.equal(count(html, 'data-railfill'), 1, 'the one rail is missing');
  assert.equal(count(html, 'data-railhead'), 1, 'the rail head is missing');
});

test('🔑 exactly ONE percentage is visible, and it is the current stage’s', async () => {
  const html = await paint();
  const shown = visiblePcts(html);
  console.log(`  visible percentages: ${shown.length} → ${JSON.stringify(shown)}`);
  assert.equal(shown.length, 1, 'treatment B shows one number; this shows more');
  /*
    Destructured rather than indexed: `noUncheckedIndexedAccess` types shown[0]
    as `string | undefined`, and `assert.equal(length, 1)` above does not narrow
    it — the compiler has no way to connect the two. `tsx --test` strips types
    instead of checking them, so the per-file run was green while `tsc` was not.
    Passing tests are not a compile.
  */
  const [visible] = shown;
  assert.ok(visible, 'no visible percentage at all');
  assert.match(visible, /23% complete/, 'the visible number is not the current stage’s');
});

test('…and the counter can say more than one — so that green is evidence', () => {
  const two = '<b>23% complete</b><span>41% complete</span>';
  assert.equal(visiblePcts(two).length, 2);
  // an attribute is NOT a visible label, which is the distinction under test
  assert.equal(visiblePcts('<button aria-label="Dreaming, 100% complete">x</button>').length, 0);
});

test('every stage still carries its figure for a screen reader', async () => {
  /*
    Hiding five numbers from the SCREEN must not hide them from someone who
    cannot see the bar. And the one visible figure is aria-hidden, so the current
    stop is not announced twice — the duplicate defect in an a11y costume.
  */
  const html = await paint();
  const expected: Array<[string, number]> = [
    ['Dreaming', 100], ['Booking', 41], ['Inviting', 23],
    ['Finalizing', 7], ['Wedding day', 0], ['After', 0],
  ];
  for (const [label, pct] of expected) {
    assert.ok(
      html.includes(`aria-label="${label}, ${pct}% complete"`),
      `${label} is not announced with its figure`,
    );
  }
  console.log(`  aria-labelled stops: ${expected.length} · visible figures: ${visiblePcts(html).length}`);
  assert.ok(html.includes('aria-hidden="true"'), 'the visible figure must be aria-hidden');
});

test('three states, three SHAPES — not one shape in three greys', async () => {
  const html = await paint();
  const n = (k: string) => count(html, `data-stagemark="${k}"`);
  console.log(`  stops — not-started: ${n('not-started')} · partial: ${n('partial')} · complete: ${n('complete')}`);
  assert.equal(n('complete'), 1, 'one stage is at 100');
  assert.equal(n('partial'), 3, 'three stages are between 1 and 99');
  assert.equal(n('not-started'), 2, 'two stages are at 0');
  assert.equal(n('complete') + n('partial') + n('not-started'), 6, 'every stop carries one mark');
});

test('a not-started stop is SMALLER, not merely paler', async () => {
  /*
    The sabotage that beat the first version of this guard was a ring-sized pale
    circle: same shape, same size, different colour — and a markup assertion
    could not see it, because the difference is a NUMBER. The sizes come from
    lib/stage-mark.ts and are emitted as data-markpx so they can be read here.
  */
  const html = await paint();
  const px = [...html.matchAll(/data-stagemark="([\w-]+)" data-markpx="(\d+)"/g)]
    .map((m) => [m[1], Number(m[2])] as [string, number]);
  const notStarted = px.filter(([k]) => k === 'not-started').map(([, v]) => v);
  const others = px.filter(([k]) => k !== 'not-started').map(([, v]) => v);
  console.log(`  not-started px: ${JSON.stringify(notStarted)} · others: ${JSON.stringify(others)}`);
  assert.ok(notStarted.length > 0 && others.length > 0, 'nothing to compare — did the attrs move?');
  assert.ok(
    Math.max(...notStarted) < Math.min(...others),
    'a not-started stop is not smaller than every started one',
  );
});

test('an all-zero event: six dots, no figure but the current one', async () => {
  const zeroed = stages().map((s) => ({ ...s, pct: 0 }));
  const html = await paint(zeroed, 'dreaming' as ProgressStageKey);
  console.log(`  all-zero — dots: ${count(html, 'data-stagemark="not-started"')} · visible figures: ${visiblePcts(html).length}`);
  assert.equal(count(html, 'data-stagemark="not-started"'), 6);
  const [only] = visiblePcts(html);
  assert.equal(visiblePcts(html).length, 1, 'still exactly one number');
  assert.ok(only, 'no visible percentage at all');
  assert.match(only, /0% complete/);
});

test('the rail head sits where the RULE puts it, not where a mock did', async () => {
  /*
    Executed, because the position is the one number in this treatment nobody
    could otherwise re-derive: head = (index + pct/100) / (stops - 1).
  */
  assert.equal(railHeadPercent(0, 0, 6), 0, 'the first stop at 0% is the left end');
  assert.equal(railHeadPercent(5, 100, 6), 100, 'the last stop finished is the right end');
  assert.equal(railHeadPercent(2, 0, 6), 40, 'stop 3 of 6 sits at 2/5');
  assert.equal(railHeadPercent(1, 100, 6), 40, 'a finished stage lands on the NEXT stop');
  assert.ok(Math.abs(railHeadPercent(2, 23, 6) - 44.6) < 0.001, 'advanced into the gap by its own pct');
  // degenerate inputs cannot produce NaN or a width outside 0–100
  for (const [i, p, c] of [[0, 0, 0], [0, 0, 1], [-5, -5, 6], [99, 999, 6], [2, NaN, 6]] as Array<[number, number, number]>) {
    const v = railHeadPercent(i, p, c);
    assert.ok(Number.isFinite(v) && v >= 0 && v <= 100, `railHeadPercent(${i},${p},${c}) = ${v}`);
  }
  // and it is actually rendered
  const html = await paint();
  assert.ok(html.includes('width:44.6%') || html.includes('width: 44.6%'), 'the fill does not use the rule');
});
