/**
 * the-maker-keeps-the-page-on-a-phone.test.ts — ON A PHONE THE PAGE IS THE
 * SCREEN, AND EVERY TOOL LIVES IN THE LOWER THIRD (owner, live iPhone test
 * 2026-10-02: *"the screen is too clumped, not much space to work on"*;
 * 2026-10-05: *"all tools can only reside on the thumb area / lower third"* →
 * *"approve"* of `prototypes/maker_lower_third_interactive_2026-10-05_fable.html`).
 *
 * The rule and its numbers are `lib/maker-phone-room.ts`. Measured on RENDERS
 * (the Maker shell, Event Details with and without its editor, the part sheet,
 * the RSVP stage's controls, the scene sheet) — every visible
 * `data-phone-chrome` piece added up from the phone height its own classes
 * declare — at 390 × 844 and 375 × 667. The logo studio's two panels live in a
 * very large module and are read from their source tags — the same classes.
 *
 *   · three zones: the top bar (52 px), the page, the lower third
 *     (`MAKER_LT_HEIGHT`) — the page keeps ≥ 55% with or without a tool open;
 *   · a tool opens INSIDE the lower third (`MAKER_LT_TOOL`): never over the
 *     page, never dimming it, ≥ 300 px wide at 375; one at a time;
 *   · the top bar is ONE row at 375 px: ✕ Exit · the screen · ↶ Undo ·
 *     👁 Preview · ✓ Apply — every bar button a 44 px target with its name;
 *   · the Maker is sized to the VISIBLE screen: `100dvh`, never `vh`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderSettled } from './render-settled.test-helper';
import { stripComments } from './strip-comments';
import { buildGuidedPlan, type GuidedItem } from './details-guided-flow';
import {
  MAKER_BAR_PHONE,
  MAKER_BAR_PHONE_GAP_PX,
  MAKER_BAR_PHONE_SIDE_PX,
  MAKER_LT_TOOL,
  MAKER_LT_TOOL_MIN_PX,
  MAKER_PHONE_BAR_PX,
  MAKER_PHONE_VIEWPORTS,
  makerLtHeightPx,
  MAKER_PREVIEW_MIN_SHARE,
  hiddenOnPhone,
  phoneChromeIn,
  phoneHeightPx,
  type PhoneChrome,
} from './maker-phone-room';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const ROUTER = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };

async function withRouter(el: React.ReactElement): Promise<React.ReactElement> {
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  return React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, el);
}

/** Undo · Preview · Apply as the draft bar draws them (`HubDraftToolbar` — pinned below to these exact props). */
async function draftButtons(): Promise<React.ReactElement> {
  const { DraftButton } = await import('../app/dashboard/[eventId]/website/_components/hub-draft-button');
  const { useMaker } = await import(`../${L}/maker-context`);
  const off = { disabled: true, disabledReason: 'Nothing yet', onClick: () => {} };
  function Slot() {
    const maker = useMaker();
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(DraftButton, { label: 'Undo', icon: null, bar: 'icon', phone: { width: MAKER_BAR_PHONE.undoTop }, ...off }),
      maker?.previewMenu ?? null,
      React.createElement(DraftButton, { label: 'Apply', name: 'Apply 0 changes', icon: null, primary: true, bar: 'apply', phone: { width: MAKER_BAR_PHONE.applyTop }, ...off }),
    );
  }
  return React.createElement(Slot);
}

/** The Maker shell, on a phone's first paint — with `details` as its open page, or none. */
async function shell(details: React.ReactElement | null): Promise<string> {
  const { MakerShell } = await import(`../${L}/maker-shell`);
  return renderSettled(
    await withRouter(
      React.createElement(MakerShell, {
        eventId: 'e1',
        slug: 'ana-and-miguel',
        liveStage: null,
        initialStage: 'rsvp',
        initialSelection: details ? { kind: 'tool', key: 'details' } : null,
        storeShell: false,
        tourSlides: [],
        firstVisit: false,
        completeTourAction: async () => {},
        renderStamp: '1',
        more: null,
        hasWork: true,
        applySlot: await draftButtons(),
        details: details ? { page: details, controls: null } : null,
      }, null),
    ),
  );
}

/** Event Details as the launch page hands it in — four items, with the flow or not. */
async function details(guide: 'none' | 'open' | 'stages', initial: string): Promise<React.ReactElement> {
  const { DetailsWorkspace } = await import(`../${L}/details-workspace`);
  const navItems = ['names', 'date', 'theme', 'address'].map((k) => ({ key: k, group: 'g', label: k, icon: null, done: k === 'date' }));
  const plan = buildGuidedPlan(navItems as GuidedItem[], { solemn: false, parentsOffered: true });
  return React.createElement(DetailsWorkspace, {
    groups: [{ key: 'g', label: 'G', items: navItems }],
    bodies: { names: 'B', date: 'B', theme: 'B', address: 'B' },
    editors: { names: 'E', date: 'E', theme: 'E', address: 'E' },
    initial,
    guide:
      guide !== 'none'
        ? { plan, open: true, entry: guide === 'stages' ? { kind: 'stages' } : null, addressed: true, actions: { previewHref: null, shareUrl: null, sendHref: '/x' } }
        : null,
  });
}

/** Event Details after a door (Look · Event Details) was pressed — its editor sheet open. */
async function detailsAfterADoor(guide: 'none' | 'open', initial: string): Promise<string> {
  const { MakerContext } = await import(`../${L}/maker-context`);
  return renderSettled(
    await withRouter(
      React.createElement(MakerContext.Provider, { value: { eventId: 'e1', detailsDoor: 1 } as never }, await details(guide, initial)),
    ),
  );
}

/** A source tag's classes, its `${…}` choices read as OPEN (a `cond ? 'a' : 'b'` picks 'a'; a `${CAP}` its value). */
function sourceChrome(rel: string, marker: string): PhoneChrome {
  const src = read(rel);
  const at = src.indexOf(marker);
  assert.ok(at >= 0, `${marker} is gone from ${rel} — re-read this guard`);
  const tagStart = src.lastIndexOf('<', at);
  const tag = src.slice(tagStart, src.indexOf('>', src.indexOf('className=', at)) + 1);
  const cls = /className=\{?[`"]([^`"]*)[`"]/.exec(tag)?.[1] ?? '';
  const open = cls
    .replace(/\$\{MAKER_LT_TOOL\}/g, MAKER_LT_TOOL)
    .replace(/\$\{[^}]*\?\s*'([^']*)'\s*:\s*'[^']*'\s*\}/g, '$1')
    .replace(/\$\{[^}]*\}/g, '');
  assert.match(tag, /data-phone-chrome="panel"/, `${rel}: the sheet no longer says it is phone chrome`);
  return { kind: 'panel', classes: open, label: `${rel.split('/').pop()} ${marker}` };
}

const barsOnly = async () => phoneChromeIn(await shell(null));

type State = { name: string; sheet: boolean; html?: () => Promise<string>; chrome: () => Promise<PhoneChrome[]> };

const STATES: State[] = [
  { name: 'the stage, nothing open', sheet: false, chrome: barsOnly },
  {
    // 🗂 PR-2: the flow opens on "Which stage do you want ready?" — a screen of the page, no sheet.
    name: 'Event Details on the stage picker (the flow, no step open)',
    sheet: false,
    html: async () => shell(await details('stages', 'names')),
    chrome: async () => phoneChromeIn(await shell(await details('stages', 'names'))),
  },
  {
    name: 'Look / Event Details after a door — its sheet open',
    sheet: true,
    html: async () => detailsAfterADoor('none', 'theme'),
    chrome: async () => [...(await barsOnly()), ...phoneChromeIn(await detailsAfterADoor('none', 'theme'))],
  },
  {
    // 🪜 PR-2: a step IS its half sheet (`MakerHalfSheet`) — the step's line, its field and its foot in one sheet; the page live.
    name: 'a step of the flow — its half sheet (step ▾, field, Back · Skip · Next), the page live',
    sheet: true,
    chrome: async () => [...(await barsOnly()), ...phoneChromeIn(await detailsAfterADoor('open', 'names'))],
  },
  {
    name: 'a part sheet',
    sheet: true,
    chrome: async () => {
      const { ElementSheet } = await import(`../${E}/element-sheet`);
      const html = renderToStaticMarkup(
        await withRouter(
          React.createElement(ElementSheet, {
            eventId: 'e1',
            target: { key: 'w:countdown', widgetType: 'countdown', el: 'heading' },
            canvas: {},
            palette: { ink: '#1b1a17', heading: '#1b1a17', accent: '#a0522d', muted: '#6b6b6b', surface: '#ffffff' },
            ownsPro: false,
            draftAction: async () => ({ ok: true, intent: 'save', applied: 0, held: [] }),
            onClose: () => {},
          }),
        ),
      );
      return [...(await barsOnly()), ...phoneChromeIn(html)];
    },
  },
  {
    name: 'the RSVP stage’s controls, open',
    sheet: true,
    chrome: async () => {
      const { MakerPage } = await import(`../${L}/maker-page`);
      const html = renderToStaticMarkup(React.createElement(MakerPage, { pageKey: 'details', page: 'P', controls: 'C', initiallyOpen: true }));
      return [...(await barsOnly()), ...phoneChromeIn(html)];
    },
  },
  {
    name: 'a scene sheet (the half sheet, at rest — its page is live, not dimmed)',
    sheet: true,
    chrome: async () => {
      const { MakerHalfSheet } = await import(`../${L}/maker-sheet`);
      const { MakerContext } = await import(`../${L}/maker-context`);
      const html = renderToStaticMarkup(
        React.createElement(
          MakerContext.Provider,
          { value: { eventId: 'e1' } as never },
          React.createElement(MakerHalfSheet, { label: 'Inspector', title: 'Scene', target: 'scene:1', onClose: () => {} }, 'rows'),
        ),
      );
      return [...(await barsOnly()), ...phoneChromeIn(html)];
    },
  },
  { name: 'the logo studio’s layers', sheet: true, chrome: async () => [...(await barsOnly()), sourceChrome(`${L}/maker-logo.tsx`, 'data-logo-navigator=""')] },
  { name: 'the logo studio’s tools', sheet: true, chrome: async () => [...(await barsOnly()), sourceChrome(`${L}/maker-logo.tsx`, 'data-logo-tools=""')] },
];

for (const state of STATES) {
  test(`📱 ${state.name}: the page keeps ${state.sheet ? '≥ 55% — the tool is IN the lower third' : 'everything between the top bar and the lower third'}`, async () => {
    const all = (await state.chrome()).filter((c) => !hiddenOnPhone(c.classes));
    assert.ok(all.some((c) => c.kind === 'bar'), 'the top bar was not found — it no longer says it is phone chrome');
    const panels = all.filter((c) => c.kind === 'panel');
    assert.ok(panels.length <= 1, `${panels.length} tools show at once on a phone: ${panels.map((p) => p.label).join(' · ')}`);
    assert.equal(all.filter((c) => c.kind === 'strip').length, 0, 'a strip sits over the page — the navigator is the lower third’s');
    if (state.html) assert.doesNotMatch(await state.html(), /data-sheet-scrim=""/, 'the page is dimmed — a tool never covers it');
    if (!state.sheet) {
      assert.equal(panels.length, 0, `a tool shows with none opened: ${panels.map((p) => p.label).join(' · ')}`);
      return;
    }
    assert.equal(panels.length, 1, 'no tool was found open');
    const tool = panels[0]!;
    // 🧰 IN the lower third, right of the column — never over the page.
    for (const t of MAKER_LT_TOOL.split(' ')) assert.ok(tool.classes.split(/\s+/).includes(t), `${tool.label} is not a lower-third tool — it lacks ${t}`);
    const left = Number(/max-lg:left-\[(\d+)px\]/.exec(tool.classes)?.[1]);
    assert.ok(375 - left - 4 >= MAKER_LT_TOOL_MIN_PX, `${tool.label} is ${375 - left - 4} px wide at 375 — under ${MAKER_LT_TOOL_MIN_PX}`);
    for (const { width, height } of MAKER_PHONE_VIEWPORTS) {
      const lt = makerLtHeightPx(height);
      const px = phoneHeightPx(tool.classes, height);
      assert.ok(px !== null && px <= lt, `${width}×${height}: ${tool.label} is ${px} px — taller than the lower third (${lt} px)`);
      const share = (height - MAKER_PHONE_BAR_PX - lt) / height;
      assert.ok(share >= MAKER_PREVIEW_MIN_SHARE - 1e-9, `${width}×${height}: the page keeps ${(share * 100).toFixed(1)}%`);
    }
  });
}

test('the measuring is honest: a percentage cap is unread, a hidden piece is not counted', () => {
  assert.equal(phoneHeightPx('max-h-[70%]', 844), null, 'a % cap is relative to its holder — it must not pass as a phone height');
  assert.equal(phoneHeightPx(MAKER_LT_TOOL, 844), 236 - 8, 'the lower third at 844 is 236 px, a tool 8 px less');
  assert.equal(phoneHeightPx(MAKER_LT_TOOL, 667), 216 - 8, 'the lower third at 667 is 216 px, a tool 8 px less');
  assert.equal(phoneHeightPx('max-lg:max-h-[calc(45dvh-52px)] lg:max-h-none', 844), 0.45 * 844 - 52);
  assert.equal(phoneHeightPx('max-md:h-[52px] md:h-12', 667), 52);
  assert.equal(phoneHeightPx('max-md:h-[calc(52px+env(safe-area-inset-bottom))]', 667), 52);
  assert.equal(hiddenOnPhone('flex max-lg:hidden'), true);
  assert.equal(hiddenOnPhone('hidden lg:flex'), true);
  assert.equal(hiddenOnPhone('flex lg:hidden'), false);
});

/* ── NOTHING DIMS THE PAGE: EVERY TOOL IS THE LOWER THIRD'S ────────────── */

test('🧰 every Maker tool sits in the lower third — none dims the page or floats over it', () => {
  // The scrim and the grip are gone with the sheets over the page.
  assert.doesNotMatch(stripComments(read(`${L}/maker-sheet.tsx`)), /export function Sheet(?:Scrim|Grip)\b/, 'a scrim or a grip is back');
  const tools: Array<[string, RegExp]> = [
    [`${L}/details-workspace.tsx`, /sheetOpen \? MAKER_LT_TOOL : 'max-lg:hidden'/],
    [`${E}/element-sheet.tsx`, /\$\{MAKER_LT_TOOL\}/],
    [`${L}/maker-page.tsx`, /open \? MAKER_LT_TOOL : 'max-lg:hidden'/],
    [`${L}/maker-logo.tsx`, /data-logo-navigator=""[\s\S]{0,200}\$\{MAKER_LT_TOOL\}/],
    [`${L}/maker-logo.tsx`, /data-logo-tools=""[\s\S]{0,200}\$\{MAKER_LT_TOOL\}/],
    [`${L}/maker-sheet.tsx`, /if \(inMaker\) \{[\s\S]{0,400}\$\{MAKER_LT_TOOL\}/],
    [`${L}/maker-shell.tsx`, /function MoreSheet[\s\S]*?\$\{MAKER_LT_TOOL\}/],
  ];
  for (const [file, re] of tools) assert.match(stripComments(read(file)), re, `${file}: a tool is not in the lower third`);
  // Each says the lower third has it open — the column names it and closes it.
  for (const file of [`${L}/details-workspace.tsx`, `${E}/element-sheet.tsx`, `${L}/maker-page.tsx`, `${L}/maker-logo.tsx`, `${L}/maker-sheet.tsx`, `${L}/maker-shell.tsx`]) {
    assert.match(stripComments(read(file)), /useMakerTool\(/, `${file}: a tool does not tell the lower third it is open`);
  }
  // The scene sheet is the Maker's half sheet, in its lower-third shape.
  assert.match(stripComments(read(`${E}/editor-shell.tsx`)), /<MakerHalfSheet\s+label="Inspector"/, 'the scene sheet is no longer the half sheet');
  assert.match(stripComments(read(`${L}/details-workspace.tsx`)), /<MakerHalfSheet\s+label="What’s left"[\s\S]{0,400}onClose=\{\(\) => move\(\{ kind: 'stages' \}\)\}/, 'a step of the flow is no longer the half sheet');
});

/* ── NO PILL ROWS IN A SHEET ─────────────────────────────────────────────── */

test('🔽 no pill row in a phone sheet — a set of choices is one dropdown', async () => {
  // The part sheet on a phone: its tabs are a dropdown; the tab row is the desktop's.
  const { ElementSheet } = await import(`../${E}/element-sheet`);
  const part = renderToStaticMarkup(
    await withRouter(
      React.createElement(ElementSheet, {
        eventId: 'e1',
        target: { key: 'w:countdown', widgetType: 'countdown', el: 'heading' },
        canvas: {},
        palette: { ink: '#1b1a17', heading: '#1b1a17', accent: '#a0522d', muted: '#6b6b6b', surface: '#ffffff' },
        ownsPro: false,
        draftAction: async () => ({ ok: true, intent: 'save', applied: 0, held: [] }),
        onClose: () => {},
      }),
    ),
  );
  for (const m of part.matchAll(/<[a-z]+\b[^>]*role="tablist"[^>]*>/g)) {
    assert.ok(hiddenOnPhone(/class="([^"]*)"/.exec(m[0])?.[1] ?? ''), `a tab row shows in the part sheet on a phone: ${m[0]}`);
  }
  // ▣ …and its three SECTIONS are the one segmented control the owner chose for
  // it (2026-10-04, "segmented control": Text · Motion · Arrange) — a section
  // switch, not a set of values; every value inside stays a dropdown.
  assert.match(part, /data-element-sections=""/, 'the part sheet lost its Text · Motion · Arrange control');
  // "The questions / After they reply" (and Love Story's two views) — one dropdown.
  const page = stripComments(read(`${L}/maker-page.tsx`));
  const sw = page.slice(page.indexOf('export function MakerPageSwitch'), page.indexOf('export function MakerRsvpCanvas'));
  assert.match(sw, /<PickMenu /, 'the page’s view switch is not a dropdown');
  assert.doesNotMatch(sw, /aria-pressed/, 'the page’s view switch is a pill row again');
  // The part sheet's Alignment and the Joiner's word — one dropdown each (owner 2026-10-02).
  const inspector = stripComments(read(`${E}/part-inspector.tsx`));
  assert.match(inspector, /dataAttr="data-part-align-pick"/, 'Alignment is not a dropdown');
  assert.match(inspector, /dataAttr="data-part-joiner-pick"/, 'the Joiner’s word is not a dropdown');
  assert.doesNotMatch(inspector, /<ISegmented label="(Alignment|The word between the names)"/, 'Alignment or the Joiner is a pill row again');
  // Event Details: the navigator strip is not on a phone; its items and sections are the sheet's ONE dropdown.
  const sheet = await detailsAfterADoor('none', 'theme');
  assert.match(sheet, /data-sheet-sections=""/, 'the editor sheet has no sections dropdown');
  const nav = /<nav\b[^>]*aria-label="Details — what to edit"[^>]*>/.exec(sheet)?.[0] ?? '';
  assert.ok(nav && hiddenOnPhone(/class="([^"]*)"/.exec(nav)?.[1] ?? ''), 'the navigator strip (a pill row of items and sections) shows on a phone');
});

/* ── THE BARS: ONE ROW EACH AT 375 PX ────────────────────────────────────── */

const pxOf = (classes: string): number | null => {
  const tw: Record<string, number> = { 'w-11': 44, 'w-10': 40, 'w-9': 36 };
  for (const t of classes.split(/\s+/)) {
    if (!t.startsWith('max-md:')) continue;
    const v = t.slice(7);
    const m = /^(?:min-)?w-\[(\d+)px\]$/.exec(v);
    if (m) return Number(m[1]);
    if (tw[v]) return tw[v]!;
  }
  return null;
};

function barRow(html: string, open: string, close: string) {
  const at = html.indexOf(open);
  assert.ok(at >= 0, `${open} was not rendered`);
  const seg = html.slice(at, html.indexOf(close, at));
  const head = seg.slice(0, seg.indexOf('>'));
  const items = [...seg.matchAll(/<[a-z]+\b[^>]*\bdata-bar-item="([^"]*)"[^>]*>/g)]
    .map((m) => ({ label: m[1]!, classes: /\bclass="([^"]*)"/.exec(m[0])?.[1] ?? '' }))
    .filter((i) => !hiddenOnPhone(i.classes));
  return { head, items };
}

function fitsOneRow(row: ReturnType<typeof barRow>, need: string[], where: string) {
  assert.doesNotMatch(row.head, /\bflex-wrap\b/, `the ${where} bar wraps`);
  assert.match(row.head, /\bflex-nowrap\b/, `the ${where} bar is not one row`);
  const names = row.items.map((i) => i.label);
  assert.deepEqual(names, need, `the ${where} bar on a phone is ${names.join(' · ')}`);
  let used = 2 * MAKER_BAR_PHONE_SIDE_PX + MAKER_BAR_PHONE_GAP_PX * (row.items.length - 1);
  for (const i of row.items) {
    const w = pxOf(i.classes);
    assert.ok(w !== null, `${i.label} declares no phone width — the ${where} bar cannot be measured`);
    used += w;
  }
  assert.ok(used <= 375, `the ${where} bar needs ${used} px at least — more than 375, so it wraps or overflows`);
}

test('📏 the top bar is ONE row at 375 px — ✕ Exit · the screen · ↶ Undo · 👁 Preview · ✓ Apply; the old bottom bar is gone', async () => {
  const html = await shell(null);
  const top = barRow(html, '<header', '</header>');
  fitsOneRow(top, ['Exit', 'Stage', 'Undo', 'Preview', 'Apply'], 'top');
  assert.match(top.head, /max-lg:h-\[52px\]/, 'the top bar is no longer one 52 px row');
  // 🧰 The bottom bar (Page ▾ · Look · Event Details) is REPLACED by the lower third (owner 2026-10-05).
  assert.doesNotMatch(html, /aria-label="Maker tools"|data-maker-bottom-bar=""/, 'the old bottom bar is back');
  const lt = /<section\b[^>]*data-maker-lower-third=""[^>]*>/.exec(html)?.[0] ?? '';
  assert.ok(lt, 'the lower third is not drawn');
  assert.match(lt, /env\(safe-area-inset-bottom\)/, 'the lower third does not respect the phone’s bottom safe area');
  // 🏷 The screen you are on (owner 2026-10-05, "RSVP · When yes"): the stage and its page — never "as a guest sees it".
  const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  assert.match(header, /data-maker-screen-label=""[^>]*>Invitation · Welcome</, 'the top bar does not name the screen the couple is on');
  assert.doesNotMatch(header, /as a guest sees it/, 'the cut-off "as a guest sees it" is back on the top bar');
  // The draft bar draws Undo and Apply with exactly these phone props (the stub above is its copy).
  const bar = read('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(bar, /bar="icon"\s*phone=\{\{ width: MAKER_BAR_PHONE\.undoTop \}\}/, 'the draft bar’s Undo is not the bar’s 44 px icon');
  assert.match(bar, /primary\s*bar="apply"\s*phone=\{\{ width: MAKER_BAR_PHONE\.applyTop \}\}/, 'the draft bar’s Apply is not the bar’s filled ✓');
  assert.doesNotMatch(bar, /\border-2\b/, 'a draft-bar item is ordered onto a second row again');
});

test('🔘 every button on the bar is a ≥ 44 px target with its name — Exit · Undo · Preview · Apply (phone AND desktop)', async () => {
  const html = await shell(null);
  const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  const want: Record<string, RegExp> = {
    Exit: /aria-label="Exit"/,
    Undo: /aria-label="Undo"/,
    Preview: /aria-label="Preview"/,
    Apply: /aria-label="Apply \d+ changes?"/,
  };
  for (const [item, name] of Object.entries(want)) {
    const tag = new RegExp(`<(?:a|button)\\b[^>]*data-bar-item="${item}"[^>]*>`).exec(header)?.[0];
    assert.ok(tag, `${item} is not on the bar`);
    assert.match(tag, name, `${item} has no name a screen reader says`);
    const cls = /\bclass="([^"]*)"/.exec(tag)?.[1] ?? '';
    assert.match(cls, /(?:^|\s)h-11(?:\s|$)/, `${item} is under 44 px tall`);
    assert.match(cls, /(?:^|\s)w-11(?:\s|$)/, `${item} is under 44 px wide`);
    assert.doesNotMatch(cls, /(?:^|\s)(?:md|lg):(?:h|w)-(?:[0-9]|10)(?:\s|$)/, `${item} shrinks under 44 px on a wider screen`);
  }
  assert.doesNotMatch(header, /aria-label="More"/, 'the ⋯ is back on the bar — it became 👁 Preview');
});

test('📐 the Maker is sized to the VISIBLE screen — dvh, never vh', () => {
  const shellSrc = read(`${L}/maker-shell.tsx`);
  const root = /<div\s+ref=\{shellRef\}[\s\S]*?className="([^"]*)"/.exec(shellSrc);
  assert.ok(root, 'the Maker shell’s root is gone — re-read this guard');
  assert.match(root[1]!, /\bh-\[100dvh\]/, 'the Maker shell is not sized to the visible screen (100dvh)');
  assert.doesNotMatch(root[1]!, /\binset-0\b|\bh-screen\b/, 'the Maker shell takes the full screen under the browser’s bars again');
  for (const dir of [L, E, 'app/dashboard/[eventId]/website/_components']) {
    for (const f of readdirSync(join(WEB, dir))) {
      if (!f.endsWith('.tsx') || f.includes('.test.')) continue;
      const src = stripComments(read(`${dir}/${f}`));
      const vh = /(?<![a-z])\d+(?:\.\d+)?vh\b|\bh-screen\b|\bmin-h-screen\b|\bmax-h-screen\b/.exec(src);
      assert.equal(vh, null, `${dir}/${f} sizes by the full screen (${vh?.[0]}) — use dvh, the visible screen`);
    }
  }
});
