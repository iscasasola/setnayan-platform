/**
 * planning-list.test.ts — the Suppliers tab shows Budget · Saved · Build ·
 * Plans · Payments in plain sight, and ⋯ no longer repeats them.
 *
 * Owner 2026-10-03: those five lived inside ⋯ and he could not find them —
 * "thought they were lost". A list that quietly goes missing again looks, on a
 * green suite, exactly like a list that is there.
 *
 * RENDER-LEVEL for the list (the markup is read, so a comment or an unused
 * export cannot satisfy it); SOURCE-LEVEL for "the takeover mounts it once and
 * the ⋯ menu is gone", because the takeover itself is a client page fed by a
 * server one and cannot be rendered here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { BUDGET_BUILD_TABS } from '@/lib/budget-build';
import { PlanningList, PLANNING_JUMP_ORDER } from './_components/planning-list';

// tsx compiles with the classic JSX runtime here — it reads a global `React`.
(globalThis as { React?: unknown }).React = React;
// The labels are flag-aware (Plans / Payments with the explore-replan flag on).
process.env.NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED = 'true';

const DIR = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors');
const TAKEOVER = stripComments(readFileSync(join(DIR, '_components', 'services-takeover.tsx'), 'utf8'));
const BUDGET_HREF = '/dashboard/EV1/vendors?part=budget';

const html = (budgetHref: string | undefined) =>
  renderToStaticMarkup(createElement(PlanningList, { budgetHref }));
const WITH_BUDGET = () => html(BUDGET_HREF);

/** Row labels in document order, read from the markup. */
function rows(markup: string): { key: string; label: string; tag: string }[] {
  return [...markup.matchAll(/<(a|button)\b[^>]*data-planning-row="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => ({
    tag: m[1]!,
    key: m[2]!,
    label: (m[3]!.match(/<span class="flex-1">([^<]*)<\/span>/) ?? [])[1] ?? '',
  }));
}

test('the list shows the five planning items, in the owner’s order', () => {
  const r = rows(WITH_BUDGET());
  assert.deepEqual(
    r.map((x) => x.label),
    ['Budget', 'Saved', 'Build', 'Plans', 'Payments'],
  );
  assert.match(WITH_BUDGET(), />Your planning</);
});

test('Budget links to the Budget part’s own address; the other four use the shipped section bus', () => {
  const markup = WITH_BUDGET();
  assert.ok(markup.includes(`href="${BUDGET_HREF}"`), 'Budget no longer links to the Budget part');
  const r = rows(markup);
  assert.equal(r.find((x) => x.key === 'budget')!.tag, 'a');
  for (const x of r.filter((y) => y.key !== 'budget')) assert.equal(x.tag, 'button', `${x.key} is not a section-jump button`);
  // The jumps are the bus, not a new route — the list itself invents no address.
  const src = stripComments(readFileSync(join(DIR, '_components', 'planning-list.tsx'), 'utf8'));
  assert.match(src, /onClick=\{\(\) => goToBuildTab\(tab\)\}/);
  assert.equal((src.match(/href=/g) ?? []).length, 1, 'the list grew an address of its own');
});

test('the jump keys are the shipped tabs — a permutation of BUDGET_BUILD_TABS', () => {
  assert.deepEqual([...PLANNING_JUMP_ORDER].sort(), [...BUDGET_BUILD_TABS].sort());
});

test('Saved, never Shortlist; Supplier, never vendor; no caption under a row', () => {
  const markup = WITH_BUDGET();
  // Words a person reads — the address legitimately says /vendors.
  const words = markup.replace(/<[^>]*>/g, ' ');
  assert.doesNotMatch(words, /Shortlist|vendor/i);
  // A row is exactly: icon · name · chevron — one text node, no second line.
  for (const x of rows(markup)) assert.ok(x.label.length > 0, `${x.key} row lost its name`);
  assert.equal((markup.match(/<span\b/g) ?? []).length, 5, 'a row gained a caption span');
});

test('every row is one tap target at least 48 px tall', () => {
  const markup = WITH_BUDGET();
  const tapTargets = markup.match(/<(a|button)\b[^>]*data-planning-row/g) ?? [];
  assert.equal(tapTargets.length, 5);
  assert.equal((markup.match(/min-h-\[48px\][^"]*w-full/g) ?? []).length, 5, 'a row is shorter than 48 px or not full width');
});

test('without a Budget surface the Budget row is not offered rather than offered and refused', () => {
  const r = rows(html(undefined));
  assert.deepEqual(r.map((x) => x.label), ['Saved', 'Build', 'Plans', 'Payments']);
});

test('the takeover mounts the list once, and the ⋯ menu that held these rows is gone', () => {
  assert.equal((TAKEOVER.match(/<PlanningList\b/g) ?? []).length, 1);
  assert.doesNotMatch(TAKEOVER, /TeamMoreMenu|SectionChips|data-team-more|More for Suppliers/);
  assert.equal((TAKEOVER.match(/⋯/g) ?? []).length, 0, 'a ⋯ is back on the Suppliers tab');
  // Compare keeps its place inside Plans/Build: the section and its bus key are unmoved.
  assert.match(TAKEOVER, /tab="compare"/);
});
