/**
 * a-sheet-never-covers-the-bottom-bar.test.ts — A SHEET NEVER COVERS THE MAKER'S
 * WAY OUT OF IT (live dead end on prod 5a1e75a, 2026-10-04, at 375 × 812 on the
 * RSVP stage → Reply page: *"there is nothing on the bottom left of the
 * screen"* — an empty scene sheet lay over Page ▾ · Look · Event Details).
 *
 * Since 2026-10-05 (the owner's lower third, "approve") the bottom bar is the
 * LOWER THIRD — the menu and the navigator — and a tool opens INSIDE it, beside
 * the column whose × finishes it. Held here, on renders:
 *   · 🧱 every layer the shell draws over the work area is in
 *     `MAKER_SHELL_PAGES`, and the work area draws no sheet under one;
 *   · 📱 on EVERY stage (Save the Date · RSVP · Invitation · The Day · Post
 *     Event) the lower third is drawn, visible on a phone, with no tool open;
 *   · 🚫 a CLOSED half sheet draws nothing — no aside, no slim bar, no hit area;
 *   · ▁ in the Maker a tool never folds to a slim bar over anything — the
 *     column's × (or a tap on the empty page) finishes it.
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

/** The lower third's opening tag in a render. */
function lowerThirdOf(html: string): { tag: string; classes: string } {
  const tag = /<section\b[^>]*data-maker-lower-third=""[^>]*>/.exec(html)?.[0];
  assert.ok(tag, 'the Maker’s lower third was not drawn');
  return { tag, classes: /\bclass="([^"]*)"/.exec(tag)?.[1] ?? '' };
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

/* ── 📱 every stage keeps its lower third ─────────────────────────────── */

const STAGES: Array<{ name: string; stage: string; selection: unknown }> = [
  ...PUBLIC_STAGE_ORDER.map((stage) => ({ name: PUBLIC_STAGE_LABELS[stage], stage, selection: null })),
  { name: 'RSVP (the menu › RSVP)', stage: 'save_the_date', selection: { kind: 'tool', key: 'rsvp-stage' } },
];

for (const s of STAGES) {
  test(`📱 ${s.name}: the lower third is drawn and visible on a phone, and no tool is open over it`, async () => {
    const { isMakerShellPage } = await import(`../${L}/maker-bar`);
    const html = await shell(s.stage, s.selection);
    const lt = lowerThirdOf(html);
    assert.ok(!hiddenOnPhone(lt.classes), `${s.name}: the lower third is hidden on a phone`);
    assert.match(html, /data-lt-menu-button=""/, `${s.name}: the menu ▾ is not in the lower third`);
    const open = phoneChromeIn(html).filter((c) => c.kind === 'panel' && !hiddenOnPhone(c.classes));
    assert.equal(open.length, 0, `${s.name}: a tool is open with none opened — ${open.map((c) => c.label).join(' · ')}`);
    assert.doesNotMatch(html, /data-sheet-scrim=""/, `${s.name}: the page is dimmed`);
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

/* ── ▁ in the Maker a tool never folds ─────────────────────────────────── */

test('▁ in the Maker a tool never folds to a slim bar — the column’s × or a tap on the empty page finishes it', async () => {
  const { MakerHalfSheet } = await import(`../${L}/maker-sheet`);
  const { MakerContext } = await import(`../${L}/maker-context`);
  const html = renderToStaticMarkup(
    React.createElement(
      MakerContext.Provider,
      { value: { eventId: 'e1' } as never },
      React.createElement(MakerHalfSheet, { label: 'Inspector', title: 'Names', target: 'scene:1', onClose: () => {} }, 'rows'),
    ),
  );
  assert.match(html, /data-half-sheet="tool"/, 'the half sheet is not a lower-third tool in the Maker');
  assert.doesNotMatch(html, /data-half-sheet-slim=""|data-half-sheet-peek=""|data-half-sheet-grip=""/, 'a slim bar, Peek or a grip is back in the Maker');
  // The part sheet has no slim bar of its own any more.
  assert.doesNotMatch(read(`${E}/element-sheet.tsx`), /data-element-sheet-bar=/, 'the part sheet’s slim bar is back');
  // A tap on the empty page closes it (the half sheet's own listener, and the part sheet's in the work area).
  assert.match(read(`${L}/maker-sheet.tsx`), /if \(foldedRef\.current \|\| inMakerRef\.current\) closeRef\.current\(\);/);
  assert.match(read(`${E}/editor-shell.tsx`), /sheetDo\(\{ t: 'close' \}\);\s*postToShownCanvases\(\{ source: 'setnayan-editor', t: 'markEl', key: was\.key, el: null \}\);/);
});
