/**
 * a-sheet-never-covers-the-bottom-bar.test.ts — A CLOSED OR FOLDED SHEET NEVER
 * COVERS THE MAKER'S BOTTOM BAR (live dead end on prod 5a1e75a, 2026-10-04, at
 * 375 × 812 on the RSVP stage → Reply page: *"there is nothing on the bottom
 * left of the screen"*).
 *
 * What it was: Page ▾ › RSVP selects the tool `rsvp-stage`, which the SHELL
 * (`maker-shell.tsx`) draws as a layer over the work area. The work area
 * (`editor-shell.tsx`) hid its own chrome only under Event Details
 * (`isShellPage` said `details` alone), so it still mounted the scene sheet
 * (the Inspector, titled "RSVP", body "Nothing to set here…"). Since PR-0
 * (#6329) that sheet is `MakerHalfSheet` — `fixed bottom-0 z-30` at a FIXED
 * half height (313 px at 812) with no scrim — so its top lay under the RSVP
 * layer and its empty foot lay OVER the bottom bar (`relative z-20`): Page ▾ ·
 * Look · Event Details unreachable, and no way to another stage.
 *
 * Held here, on renders:
 *   · 🧱 every layer the shell draws over the work area is in
 *     `MAKER_SHELL_PAGES`, and the work area draws no sheet under one;
 *   · 📱 on EVERY stage (Save the Date · RSVP · Invitation · The Day · Post
 *     Event) the bottom bar is drawn, visible on a phone, with no sheet open;
 *   · 🚫 a CLOSED half sheet draws nothing — no aside, no slim bar, no hit area;
 *   · ▁ a FOLDED sheet is only its slim bar (≤ 56 px on a phone), and it rests
 *     ON TOP of the bottom bar, never over it — the scene sheet's and the part
 *     sheet's alike.
 * (An OPEN sheet covers the bottom bar by design — `lib/maker-phone-room.ts`,
 * "Apply sits up top … in reach while a half sheet covers the bottom of the
 * screen" — and closes with its ×.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderSettled } from './render-settled.test-helper';
import { stripComments } from './strip-comments';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from './public-site-stage-labels';
import { hiddenOnPhone, phoneChromeIn, phoneHeightPx } from './maker-phone-room';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ROUTER = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
const PHONE_H = 812;

async function withRouter(el: React.ReactElement): Promise<React.ReactElement> {
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  return React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, el);
}

/** The Maker shell on a phone's first paint, on `stage`, with `selection` open. Its work
 *  area is a probe that writes down the selection the shell hands it — what
 *  `editor-shell.tsx` reads (`useMaker().selection`) to decide what to draw. */
async function shell(stage: string, selection: unknown): Promise<string> {
  const { MakerShell } = await import(`../${L}/maker-shell`);
  const { useMaker } = await import(`../${L}/maker-context`);
  function WorkAreaProbe() {
    const maker = useMaker() as { selection?: unknown } | null;
    return React.createElement('i', { 'data-probe-selection': JSON.stringify(maker?.selection ?? null) });
  }
  return renderSettled(
    await withRouter(
      React.createElement(
        MakerShell,
        {
          eventId: 'e1',
          slug: 'maria-and-jose',
          liveStage: null,
          initialStage: stage,
          initialSelection: selection,
          storeShell: false,
          tourSlides: [],
          firstVisit: false,
          completeTourAction: async () => {},
          renderStamp: '1',
          more: null,
          hasWork: true,
          applySlot: null,
          details: null,
        },
        React.createElement(WorkAreaProbe),
      ),
    ),
  );
}

/** The bottom bar's opening tag in a render. */
function bottomBarOf(html: string): { tag: string; classes: string } {
  const tag = /<nav\b[^>]*data-maker-bottom-bar=""[^>]*>/.exec(html)?.[0];
  assert.ok(tag, 'the Maker’s bottom bar was not drawn');
  return { tag, classes: /\bclass="([^"]*)"/.exec(tag)?.[1] ?? '' };
}

/** A phone (`max-md:`) bottom offset in px, from a class list — null when none is declared. */
function phoneBottomPx(classes: string): number | null {
  for (const t of classes.split(/\s+/).reverse()) {
    const m = /^max-md:bottom-\[([^\]]+)\]$/.exec(t);
    if (!m) continue;
    const v = m[1]!;
    const calc = /^calc\((\d+)px\+env\(safe-area-inset-bottom\)\)$/.exec(v);
    if (calc) return Number(calc[1]);
    const px = /^(\d+)px$/.exec(v);
    if (px) return Number(px[1]);
  }
  return null;
}

/** The bottom bar's own phone height, from its render (52 px, over the safe area). */
async function bottomBarPx(): Promise<number> {
  const { classes } = bottomBarOf(await shell('invitation', null));
  const px = phoneHeightPx(classes.split(/\s+/).filter((t) => !t.startsWith('md:')).join(' '), PHONE_H);
  assert.ok(px !== null && px >= 44, `the bottom bar declares no phone height (${classes})`);
  return px;
}

/* ── 🧱 the shell's layers and the work area agree ─────────────────────────── */

test('🧱 every page the shell draws over the work area is in MAKER_SHELL_PAGES — so the work area draws no sheet under it', async () => {
  const { MAKER_SHELL_PAGES, isMakerShellPage } = await import(`../${L}/maker-bar`);
  // Every tool a selection can name (the `MakerSelection` type), opened one by one.
  const ctx = read(`${L}/maker-context.tsx`);
  const union = /\{ kind: 'tool'; key: ([^}]+) \}/.exec(ctx)?.[1] ?? '';
  const tools = [...union.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]!);
  assert.ok(tools.includes('rsvp-stage') && tools.includes('details') && tools.length >= 6, `the tool keys were not read (${tools.join(', ')})`);
  const covering = new Set<string>();
  for (const key of tools) {
    const html = await shell('invitation', { kind: 'tool', key });
    const raw = /data-probe-selection="([^"]*)"/.exec(html)?.[1];
    assert.ok(raw !== undefined, 'the work area was not drawn — re-read this guard');
    // What the work area is handed (the shell moves Logo · Hero · … into Event Details).
    const held = JSON.parse(raw.replace(/&quot;/g, '"')) as { kind: string; key?: string } | null;
    if (!/<div class="absolute inset-0 z-30[^"]*"[^>]*data-maker-[a-z-]+-layer=""/.test(html)) continue;
    assert.ok(held?.kind === 'tool' && held.key, `opening "${key}" draws a layer, but the work area holds ${raw}`);
    covering.add(held.key);
    assert.ok(
      isMakerShellPage(held.key),
      `the shell draws "${held.key}" over the work area, but MAKER_SHELL_PAGES does not name it — the work area will mount its sheet under it, over the bottom bar`,
    );
  }
  assert.ok(covering.has('rsvp-stage'), 'the RSVP stage no longer draws its layer — re-read this guard');
  assert.deepEqual([...MAKER_SHELL_PAGES].sort(), [...covering].sort(), 'MAKER_SHELL_PAGES names a page the shell no longer draws');
});

test('🧱 the work area hides its sheets under a shell page — the scene sheet, the part sheet and the type bar', () => {
  const work = read(`${E}/editor-shell.tsx`);
  assert.match(work, /function isShellPage\(key: string\): key is MakerShellPage \{\s*return isMakerShellPage\(key\);\s*\}/, 'the work area has its own list of shell pages again');
  assert.match(work, /const workHidden = selection\?\.kind === 'tool' && isShellPage\(selection\.key\);/);
  assert.match(work, /\{workHidden \? null : elementTarget && elementEditing \? \(\s*<ElementSheet[\s\S]*?\) : selection \? \(\s*<CanvasWordsContext\.Provider value=\{canvasWords\}>\s*<Inspector/, 'the scene sheet or the part sheet mounts under a shell page');
  assert.match(work, /\{typeStart && elementEditing && !workHidden \? \(/, 'the type bar mounts under a shell page');
});

/* ── 📱 every stage keeps its bottom bar ──────────────────────────────────── */

const STAGES: Array<{ name: string; stage: string; selection: unknown }> = [
  ...PUBLIC_STAGE_ORDER.map((stage) => ({ name: PUBLIC_STAGE_LABELS[stage], stage, selection: null })),
  { name: 'RSVP (Page ▾ › RSVP · Reply)', stage: 'save_the_date', selection: { kind: 'tool', key: 'rsvp-stage' } },
];

for (const s of STAGES) {
  test(`📱 ${s.name}: the bottom bar is drawn and visible on a phone, and no sheet is open over it`, async () => {
    const { isMakerShellPage } = await import(`../${L}/maker-bar`);
    const html = await shell(s.stage, s.selection);
    const bar = bottomBarOf(html);
    assert.ok(!hiddenOnPhone(bar.classes.split(/\s+/).filter((t) => !t.startsWith('md:')).join(' ')), `${s.name}: the bottom bar is hidden on a phone`);
    assert.match(bar.tag, /aria-label="Maker tools"/);
    assert.match(html, /data-maker-page-menu-phone/, `${s.name}: Page ▾ is not in the bottom bar`);
    const open = phoneChromeIn(html).filter((c) => c.kind === 'panel' && !hiddenOnPhone(c.classes));
    assert.equal(open.length, 0, `${s.name}: a sheet is open with none opened — ${open.map((c) => c.label).join(' · ')}`);
    assert.doesNotMatch(html, /data-sheet-scrim=""/, `${s.name}: the page is dimmed with no sheet open`);
    // A tool page the shell covers draws NOTHING of the work area's own (the guard above).
    const sel = s.selection as { kind: string; key: string } | null;
    if (sel?.kind === 'tool') assert.ok(isMakerShellPage(sel.key), `${s.name}: the work area would mount its scene sheet under this page`);
  });
}

/* ── 🚫 closed is not drawn ──────────────────────────────────────────────── */

test('🚫 a CLOSED half sheet draws nothing — no aside, no slim bar, no hit area', async () => {
  const { MakerHalfSheet } = await import(`../${L}/maker-sheet`);
  const html = renderToStaticMarkup(
    React.createElement(MakerHalfSheet, { label: 'Inspector', title: 'RSVP', target: null, onClose: () => {} }, 'rows'),
  );
  assert.equal(html, '', `a closed sheet drew: ${html.slice(0, 160)}`);
  // …and an open one still draws (the guard is not vacuous).
  const open = renderToStaticMarkup(
    React.createElement(MakerHalfSheet, { label: 'Inspector', title: 'RSVP', target: 'tool:rsvp-stage', onClose: () => {} }, 'rows'),
  );
  assert.match(open, /<aside\b[^>]*aria-label="Inspector"/);
});

/* ── ▁ folded = the slim bar, on top of the bottom bar ───────────────────── */

async function slimBars(): Promise<Array<{ name: string; classes: string }>> {
  const { HalfSheetSlimBar } = await import(`../${L}/maker-sheet`);
  const scene = renderToStaticMarkup(
    React.createElement(HalfSheetSlimBar, { title: 'Names', section: 'Motion', onRestore: () => {}, onClose: () => {} }),
  );
  const { ElementSheet } = await import(`../${E}/element-sheet`);
  const part = renderToStaticMarkup(
    await withRouter(
      React.createElement(ElementSheet, {
        eventId: 'e1',
        target: { key: 'f:hero', widgetType: 'hero', el: 'names' },
        canvas: {},
        palette: { ink: '#1b1a17', heading: '#1b1a17', accent: '#a0522d', muted: '#6b6b6b', surface: '#ffffff' },
        ownsPro: true,
        draftAction: async () => {
          throw new Error('folding the sheet wrote to the draft');
        },
        onClose: () => {},
        collapsed: true,
        onRestore: () => {},
      }),
    ),
  );
  const classOf = (html: string, marker: RegExp, name: string) => {
    const tag = marker.exec(html)?.[0];
    assert.ok(tag, `${name} was not drawn`);
    return { name, classes: /\bclass="([^"]*)"/.exec(tag)?.[1] ?? '' };
  };
  // The part sheet's own sheet is kept, folded — hidden on a phone.
  const aside = /<aside\b[^>]*data-maker-element-sheet="names"[^>]*>/.exec(part)?.[0] ?? '';
  assert.ok(aside && hiddenOnPhone(/\bclass="([^"]*)"/.exec(aside)?.[1] ?? ''), 'the folded part sheet still shows on a phone');
  return [
    classOf(scene, /<div\b[^>]*data-half-sheet-slim=""[^>]*>/, 'the scene sheet’s slim bar'),
    classOf(part, /<button\b[^>]*data-element-sheet-bar=""[^>]*>/, 'the part sheet’s slim bar'),
  ];
}

test('▁ a FOLDED sheet is only its slim bar, and on a phone it rests ON TOP of the bottom bar — never over it', async () => {
  const bar = await bottomBarPx();
  for (const slim of await slimBars()) {
    assert.match(slim.classes, /\bfixed\b/, `${slim.name} is no longer fixed — re-read this guard`);
    const lift = phoneBottomPx(slim.classes);
    assert.ok(lift !== null, `${slim.name} sits at the foot of the screen on a phone — over the bottom bar (no max-md:bottom-[…])`);
    assert.ok(lift >= bar, `${slim.name} rests ${lift} px up — the bottom bar is ${bar} px, so it covers the bar`);
    const h = phoneHeightPx(slim.classes.split(/\s+/).filter((t) => !/^(lg|md):/.test(t)).join(' '), PHONE_H);
    if (h !== null) assert.ok(h <= 56, `${slim.name} is ${h} px tall on a phone — a slim bar is one 56 px row`);
    assert.doesNotMatch(slim.classes, /(^|\s)max-md:pb-\[env/, `${slim.name} pads for the safe area the bottom bar already covers`);
  }
});
