/**
 * setup-by-stage-opens-and-writes-nothing.test.ts — PR-2 "Setup by stage"
 * (owner 2026-10-04, DECISION_LOG "YES TO ALL"; the study's § 7 PR-2 and B6 of
 * `INVITATION_RSVP_GUEST_FLOW_REMAINING_2026-10-04.md`).
 *
 * Held here:
 *   (1) 🔑 "START ANYWAY" SKIPS BEFORE WE START — both of its buttons go to the
 *       stage's first step still to do, and a stage picked again goes straight
 *       to its steps (Before we start shows once);
 *   (2) 🔑 OPENING A STEP WRITES NOTHING — the picker, Before we start, a step
 *       and its sheet change what is SHOWN; no save, draft, action or fetch
 *       lives in the flow's own pieces (Apply is the bar's, pressed);
 *   (3) 🔑 THE BACKGROUND STEP AND LOOK › BACKGROUND SHOW THE SAME VALUE — the
 *       cover step draws the very node Look draws (`lookPages.look.background`,
 *       the one `MainBackgroundPanel` → `saveMain`), never a second control;
 *   (4) the theme picker's label is plain words — never somebody else's names (B6).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { renderSettled } from './render-settled.test-helper';
import { buildGuidedPlan, firstOpenScreen, startScreen, type GuidedItem, type GuidedPlan } from './details-guided-flow';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const NAV = ['names', 'date', 'theme', 'hero', 'address'];
const navItems = NAV.map((k) => ({ key: k, group: 'g', label: k, icon: null, done: k === 'date' }));
const plan: GuidedPlan = buildGuidedPlan(navItems as GuidedItem[], { solemn: false, parentsOffered: true });

/** Every element of a tree that is not a component — the props a click would reach. */
function elements(node: unknown, out: Array<{ props: Record<string, unknown> }> = []): Array<{ props: Record<string, unknown> }> {
  if (Array.isArray(node)) {
    for (const n of node) elements(n, out);
    return out;
  }
  if (!node || typeof node !== 'object' || !('props' in node)) return out;
  const el = node as { props: Record<string, unknown> };
  out.push(el);
  elements(el.props.children, out);
  return out;
}

/* ── (1) Start anyway ───────────────────────────────────────────────────── */

test('🔑 (1) "Start anyway" and "I’m ready" both leave Before we start for the stage’s first step still to do', async () => {
  const { BeforeWeStartScreen } = await import(`../${L}/stage-picker`);
  let started = 0;
  let backed = 0;
  const tree = BeforeWeStartScreen({ plan, round: 'save_the_date', onStart: () => (started += 1), onBack: () => (backed += 1) });
  const all = elements(tree);
  const press = (attr: string) => {
    const b = all.find((e) => attr in e.props);
    assert.ok(b, `no ${attr} button`);
    (b.props.onClick as () => void)();
  };
  press('data-before-start-anyway');
  assert.equal(started, 1, '"Start anyway" does not start the steps');
  press('data-before-ready');
  assert.equal(started, 2, '"I’m ready" does not start the steps');
  assert.equal(backed, 0, 'a start went back to the stages');
  press('data-before-back');
  assert.equal(backed, 1);
  // …and starting is the stage's first step still to do (never Before we start again).
  assert.deepEqual(firstOpenScreen(plan, 'save_the_date'), { kind: 'step', step: 'names', round: 'save_the_date' });
  const ws = read(`${L}/details-workspace.tsx`);
  assert.match(ws, /onStart=\{\(\) => startStage\(at\.round\)\}/, 'Before we start no longer starts through startStage');
  const start = ws.slice(ws.indexOf('const startStage = '), ws.indexOf('const openGuide = '));
  assert.ok(start.length > 0, 'anti-vacuity: startStage not found');
  assert.match(start, /goTo\(firstOpenScreen\(plan, r\)\)/, 'starting does not go to the first step still to do');
  assert.match(start, /localStorage\.setItem\(k, '1'\)/, 'a started stage shows Before we start again');
  // A stage picked again goes straight to its steps; the first time, to Before we start.
  assert.deepEqual(startScreen(plan, 'save_the_date', true), firstOpenScreen(plan, 'save_the_date'));
  assert.deepEqual(startScreen(plan, 'save_the_date', false), { kind: 'before', round: 'save_the_date' });
  assert.match(ws, /goTo\(startScreen\(plan, r, beforeSeen\(r\)\)\)/, 'a pick does not ask whether Before we start was seen');
});

/* ── (2) opening writes nothing ─────────────────────────────────────────── */

test('🔑 (2) opening a stage, Before we start or a step writes nothing — no save in the flow’s own pieces', () => {
  const files = [`${L}/stage-picker.tsx`, `${L}/details-guide.tsx`, `${L}/details-guide-top.tsx`, `${L}/details-workspace.tsx`, `${L}/maker-sheet.tsx`, 'lib/stage-setup.ts', 'lib/details-guided-flow.ts'];
  const WRITES: ReadonlyArray<[RegExp, string]> = [
    [/\bfetch\(/, 'a fetch'],
    [/makerSave\(/, 'a Maker save'],
    [/hubDraftAction|saveMain\(/, 'a draft write'],
    [/from ['"][^'"]*\/actions['"]|from ['"][^'"]*-actions['"]/, 'a server action'],
    [/['"]use server['"]/, 'a server action'],
    [/\.from\(['"][^'"]+['"]\)|\.rpc\(/, 'a database call'],
    [/new FormData\(/, 'a form post'],
    [/requestSubmit\(|\.submit\(\)/, 'a form post'],
  ];
  for (const f of files) {
    const src = read(f);
    assert.ok(src.length > 500, `anti-vacuity: ${f} was not read`);
    for (const [re, what] of WRITES) assert.doesNotMatch(src, re, `${f} holds ${what} — opening the flow must write nothing`);
  }
  // The one press that publishes is Apply — the bar's own, and only on a press (`pressMakerApply` in an onClick).
  const guide = read(`${L}/details-guide.tsx`);
  assert.equal((guide.match(/pressMakerApply\(\)/g) ?? []).length, 1);
  assert.match(guide, /const apply = \(\) => \{\s*const outcome = pressMakerApply\(\);/);
  // The only thing a press remembers is a per-phone "seen" (never data), and only on Start.
  const ws = read(`${L}/details-workspace.tsx`);
  assert.equal((ws.match(/localStorage\.setItem/g) ?? []).length, 1, 'the flow remembers something else on this phone');
});

test('🔑 (2) a step drawn — its sheet open, its field showing — has written nothing (a refused fetch would throw)', async () => {
  const { DetailsWorkspace } = await import(`../${L}/details-workspace`);
  const g = globalThis as unknown as { fetch: unknown };
  const had = g.fetch;
  let calls = 0;
  g.fetch = () => {
    calls += 1;
    throw new Error('the flow fetched while opening');
  };
  try {
    for (const entry of [{ kind: 'stages' }, { kind: 'before', round: 'save_the_date' }, { kind: 'step', step: 'names', round: 'save_the_date' }] as const) {
      const html = await renderSettled(
        React.createElement(DetailsWorkspace, {
          groups: [{ key: 'g', label: 'G', items: navItems }],
          bodies: Object.fromEntries(NAV.map((k) => [k, 'B'])),
          editors: Object.fromEntries(NAV.map((k) => [k, React.createElement('i', { 'data-stub-editor': k })])),
          initial: 'names',
          guide: { plan, open: true, entry, addressed: true, actions: { previewHref: null, shareUrl: null, sendHref: '/x' } },
        }),
      );
      assert.ok(html.length > 200, `anti-vacuity: ${entry.kind} drew nothing`);
    }
  } finally {
    g.fetch = had;
  }
  assert.equal(calls, 0, 'opening the flow fetched');
});

/* ── (3) the background step = Look › Background ────────────────────────── */

test('🔑 (3) the cover step’s background and Look › Background draw ONE node — one value, one saveMain', async () => {
  const { MakerContext } = await import(`../${L}/maker-context`);
  const { StepBackground } = await import(`../${L}/details-guide`);
  const { LookPanel } = await import(`../${L}/details-look-pages`);
  const bg = React.createElement('i', { 'data-bg-value': 'follows the hero · tint 3' });
  const value = { eventId: 'e1', lookPages: { look: { background: bg, font: null, colours: null, palette: null, buttons: null } } } as never;
  const inMaker = (child: React.ReactElement) => React.createElement(MakerContext.Provider, { value }, child);
  const step = await renderSettled(inMaker(React.createElement(StepBackground)));
  const look = await renderSettled(inMaker(React.createElement(LookPanel, { theme: 'THEME' })));
  const drawn = (html: string) => /data-bg-value="([^"]+)"/.exec(html)?.[1] ?? null;
  assert.equal(drawn(step), 'follows the hero · tint 3', 'the cover step does not draw the background');
  assert.equal(drawn(step), drawn(look), 'the cover step and Look › Background show different values');
  // No row registered (the store shell has no Main background): nothing — never a second control.
  const none = await renderSettled(React.createElement(MakerContext.Provider, { value: { eventId: 'e1' } as never }, React.createElement(StepBackground)));
  assert.doesNotMatch(none, /data-step-background/);
  // Source: the step reads the very key Look reads, and builds no panel of its own.
  const guide = read(`${L}/details-guide.tsx`);
  const fn = guide.slice(guide.indexOf('export function StepBackground'));
  assert.match(fn, /useMaker\(\)\?\.lookPages\?\.look\?\.background/, 'the cover step reads another background');
  assert.doesNotMatch(guide, /MainBackgroundPanel|saveMain/, 'the cover step built a second background control');
  // …and the workspace draws it on the cover step only, under the cover's own editor.
  const ws = read(`${L}/details-workspace.tsx`);
  assert.match(ws, /i\.key === 'hero' && at\?\.kind === 'step' && stepHere\?\.key === 'hero' \? <StepBackground \/> : null/);
  // In the workspace too: the cover step shows it.
  const { DetailsWorkspace } = await import(`../${L}/details-workspace`);
  const html = await renderSettled(
    inMaker(
      React.createElement(DetailsWorkspace, {
        groups: [{ key: 'g', label: 'G', items: navItems }],
        bodies: Object.fromEntries(NAV.map((k) => [k, 'B'])),
        editors: Object.fromEntries(NAV.map((k) => [k, React.createElement('i', { 'data-stub-editor': k })])),
        initial: 'hero',
        guide: { plan, open: true, entry: { kind: 'step', step: 'hero', round: 'save_the_date' }, addressed: true, actions: { previewHref: null, shareUrl: null, sendHref: '/x' } },
      }),
    ),
  );
  assert.equal(drawn(html), 'follows the hero · tint 3', 'the cover step in the flow has no background');
});

/* ── (5) the progress never sits over the page ─────────────────────────── */

test('🔑 (5) the setup’s progress is in the sheet’s header — nothing of the flow floats over the page', async () => {
  // Live bug 2026-10-04 at 375 px (maria-and-jose): a floating "● Finish · 1 of 6" chip,
  // absolutely placed at the top of the page, covered the page's own header line.
  const { DetailsWorkspace } = await import(`../${L}/details-workspace`);
  const { MakerContext } = await import(`../${L}/maker-context`);
  const draw = (entry: unknown, door: number) =>
    renderSettled(
      React.createElement(
        MakerContext.Provider,
        { value: { eventId: 'e1', detailsDoor: door } as never },
        React.createElement(DetailsWorkspace, {
          groups: [{ key: 'g', label: 'G', items: navItems }],
          bodies: Object.fromEntries(NAV.map((k) => [k, React.createElement('i', { 'data-stub-body': k })])),
          editors: Object.fromEntries(NAV.map((k) => [k, React.createElement('i', { 'data-stub-editor': k })])),
          initial: entry ? 'names' : 'address',
          guide: { plan, open: Boolean(entry), entry, addressed: true, actions: { previewHref: null, shareUrl: null, sendHref: '/x' } },
        }),
      ),
    );
  const bodyOf = (html: string) => {
    const at = html.indexOf('data-details-body=""');
    assert.ok(at > 0, 'anti-vacuity: no page body drawn');
    return html.slice(at, html.indexOf('</section>', at));
  };
  // All items, its sheet opened by a door: the progress is ONE button in the sheet's header.
  const all = await draw(null, 1);
  const head = all.slice(all.indexOf('data-details-sheet-head=""'), all.indexOf('</div>', all.indexOf('data-details-sheet-head=""')));
  assert.match(head, /data-details-guide-progress=""[^>]*>Finish · \d+ of \d+</, 'the progress is not in the sheet’s header');
  // A step of the flow: the progress is the step sheet's own line, inside the half sheet.
  const step = await draw({ kind: 'step', step: 'names', round: 'save_the_date' }, 0);
  const sheet = step.slice(step.indexOf('data-half-sheet='));
  assert.match(sheet, /data-details-guide-top="sheet"/, 'the step sheet has no progress line');
  for (const html of [all, step]) {
    const body = bodyOf(html);
    assert.doesNotMatch(html, /data-details-guide-chip/, 'the floating chip came back');
    assert.doesNotMatch(body, /Finish ·|data-details-guide-progress|data-details-guide-top/, 'the flow’s progress is drawn over the page');
    // Nothing absolutely placed at the TOP of the page (where the page's own header line sits).
    assert.doesNotMatch(body, /class="[^"]*\babsolute\b[^"]*\btop-/, 'something floats over the top of the page');
  }
});

/* ── (4) B6 — the theme picker's label ──────────────────────────────────── */

test('(4) the theme picker says plain words — never somebody else’s names on this event (B6)', () => {
  const src = read(`${L}/maker-theme-picker.tsx`);
  assert.match(src, /THEME_SAMPLES_LABEL = 'Each theme on a sample Event Hub'/);
  assert.match(src, /\{THEME_SAMPLES_LABEL\}/);
  assert.doesNotMatch(src, /Maria|Jose/, 'the theme picker names a sample event’s people');
});
