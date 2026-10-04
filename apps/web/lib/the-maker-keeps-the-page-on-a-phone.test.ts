/**
 * the-maker-keeps-the-page-on-a-phone.test.ts — ON A PHONE THE PAGE IS THE
 * SCREEN (owner, live iPhone test 2026-10-02: *"the screen is too clumped, not
 * much space to work on"*, then *"this is too clumped. find a way to make this
 * look cleaner for mobile mode. Also dim the negative space so they know it is a
 * pop up and pressing on the dimmed part will go back to the main screen"*; the
 * approved phone layout, frames G/I of `prototypes/maker_in_four_2026-09-30_fable.html`).
 *
 * The rule and its numbers are `lib/maker-phone-room.ts`. Measured on RENDERS
 * (the Maker shell, Event Details with and without its sheet, the part sheet,
 * the RSVP stage's controls) — every visible `data-phone-chrome` piece added up
 * from the phone height its own classes declare — at 390 × 844 and 375 × 667,
 * against the VISIBLE height (the Maker is `100dvh`; the caps are `dvh`). Three
 * sheets live inside very large modules (the scene sheet in `editor-shell.tsx`,
 * the logo studio's two) or open only on a tap (the guide's), and are read from
 * their source tags — the same classes, the same sum.
 *
 *   · NO sheet open: the page takes everything between the two bars — nothing
 *     but the top bar and the bottom bar is chrome, and nothing is dimmed;
 *   · a sheet open: it covers the bottom bar, the page above it is DIMMED, and
 *     top bar + sheet ≤ 45% — the dimmed page keeps ≥ 55%; one sheet at a time;
 *   · a tap on the dimmed page closes the sheet;
 *   · no pill rows in a sheet on a phone — a set of choices is one dropdown;
 *   · each bar is ONE row at 375 px: ‹ Exit · the stage · ↶ Undo · 👁 Preview ·
 *     ✓ Apply on top; Page ▾ · Look · Event Details at the bottom (frame G as
 *     the owner rearranged it on 2026-10-04 — Undo beside Apply, ⋯ → Preview,
 *     *"apply icon · undo icon · exit icon"*) — every bar button a 44 px target
 *     with its name, every word fits its button;
 *   · the scene sheet is the HALF sheet (`MakerHalfSheet`): it rests at half,
 *     and its page is live, not dimmed (owner 2026-10-04 — the change is seen
 *     live, and a tap on another element must reach the canvas;
 *     `lib/a-phone-sheet-opens-at-half.test.ts`);
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
  MAKER_BAR_PHONE_PAD_PX,
  MAKER_BAR_PHONE_SIDE_PX,
  MAKER_BAR_PHONE_WORD_PX,
  MAKER_PHONE_PANEL_CAP,
  MAKER_PHONE_VIEWPORTS,
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
async function details(guide: 'none' | 'open', initial: string): Promise<React.ReactElement> {
  const { DetailsWorkspace } = await import(`../${L}/details-workspace`);
  const navItems = ['names', 'date', 'theme', 'address'].map((k) => ({ key: k, group: 'g', label: k, icon: null, done: k === 'date' }));
  const plan = buildGuidedPlan(navItems as GuidedItem[], { solemn: false, parentsOffered: true });
  return React.createElement(DetailsWorkspace, {
    groups: [{ key: 'g', label: 'G', items: navItems }],
    bodies: { names: 'B', date: 'B', theme: 'B', address: 'B' },
    editors: { names: 'E', date: 'E', theme: 'E', address: 'E' },
    initial,
    guide:
      guide === 'open'
        ? { plan, open: true, ready: null, addressed: true, actions: { previewHref: null, shareUrl: null, sendHref: '/x' } }
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
    .replace(/\$\{MAKER_PHONE_PANEL_CAP\}/g, MAKER_PHONE_PANEL_CAP)
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
    name: 'Event Details, its sheet shut (with the flow)',
    sheet: false,
    html: async () => shell(await details('open', 'names')),
    chrome: async () => phoneChromeIn(await shell(await details('open', 'names'))),
  },
  {
    name: 'Look / Event Details after a door — its sheet open',
    sheet: true,
    html: async () => detailsAfterADoor('none', 'theme'),
    chrome: async () => [...(await barsOnly()), ...phoneChromeIn(await detailsAfterADoor('none', 'theme'))],
  },
  {
    name: 'a step of the flow after a door — its sheet open',
    sheet: true,
    chrome: async () => [...(await barsOnly()), ...phoneChromeIn(await detailsAfterADoor('open', 'names'))],
  },
  { name: 'the guide’s sheet (from its chip)', sheet: true, chrome: async () => [...(await barsOnly()), sourceChrome(`${L}/details-workspace.tsx`, 'data-details-guide-sheet=""')] },
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
      const html = renderToStaticMarkup(
        React.createElement(MakerHalfSheet, { label: 'Inspector', title: 'Scene', target: 'scene:1', onClose: () => {} }, 'rows'),
      );
      return [...(await barsOnly()), ...phoneChromeIn(html)];
    },
  },
  { name: 'the logo studio’s layers', sheet: true, chrome: async () => [...(await barsOnly()), sourceChrome(`${L}/maker-logo.tsx`, 'data-logo-navigator=""')] },
  { name: 'the logo studio’s tools', sheet: true, chrome: async () => [...(await barsOnly()), sourceChrome(`${L}/maker-logo.tsx`, 'data-logo-tools=""')] },
];

for (const state of STATES) {
  test(`📱 ${state.name}: the page keeps ${state.sheet ? '≥ 55%' : 'everything between the bars'}`, async () => {
    const all = (await state.chrome()).filter((c) => !hiddenOnPhone(c.classes));
    assert.ok(all.some((c) => c.kind === 'bar'), 'the top bar was not found — it no longer says it is phone chrome');
    const panels = all.filter((c) => c.kind === 'panel');
    assert.ok(panels.length <= 1, `${panels.length} sheets show at once on a phone: ${panels.map((p) => p.label).join(' · ')}`);
    if (!state.sheet) {
      assert.equal(panels.length, 0, `a sheet shows with none opened: ${panels.map((p) => p.label).join(' · ')}`);
      const strips = all.filter((c) => c.kind === 'strip');
      assert.equal(strips.length, 0, `a strip sits between the bars with no sheet open: ${strips.map((s) => s.label).join(' · ')}`);
      assert.ok(all.some((c) => c.kind === 'bottom'), 'the bottom bar was not found');
      if (state.html) assert.doesNotMatch(await state.html(), /data-sheet-scrim=""/, 'the page is dimmed with no sheet open');
      return;
    }
    assert.equal(panels.length, 1, 'no sheet was found open');
    // An open sheet covers the bottom bar; what counts is the top bar and the sheet.
    const counted = all.filter((c) => c.kind !== 'bottom');
    for (const { width, height } of MAKER_PHONE_VIEWPORTS) {
      let used = 0;
      for (const c of counted) {
        const px = phoneHeightPx(c.classes, height);
        assert.ok(px !== null, `${c.label} (${c.kind}) declares no phone height — give it a fixed height or a cap from lib/maker-phone-room.ts`);
        used += px;
      }
      const share = (height - used) / height;
      assert.ok(
        share >= MAKER_PREVIEW_MIN_SHARE - 1e-9,
        `${width}×${height}: the dimmed page keeps ${(share * 100).toFixed(1)}% (${Math.round(height - used)} px) — ${counted
          .map((c) => `${c.label} ${Math.round(phoneHeightPx(c.classes, height) ?? 0)}`)
          .join(' + ')}`,
      );
    }
    if (state.html) assert.match(await state.html(), /data-sheet-scrim=""/, 'an open sheet does not dim the page behind it');
  });
}

test('the measuring is honest: a percentage cap is unread, a hidden piece is not counted', () => {
  assert.equal(phoneHeightPx('max-h-[70%]', 844), null, 'a % cap is relative to its holder — it must not pass as a phone height');
  assert.equal(phoneHeightPx('max-lg:max-h-[calc(45dvh-52px)] lg:max-h-none', 844), 0.45 * 844 - 52);
  assert.equal(phoneHeightPx('max-md:h-[52px] md:h-12', 667), 52);
  assert.equal(phoneHeightPx('max-md:h-[calc(52px+env(safe-area-inset-bottom))]', 667), 52);
  assert.equal(hiddenOnPhone('flex max-lg:hidden'), true);
  assert.equal(hiddenOnPhone('hidden lg:flex'), true);
  assert.equal(hiddenOnPhone('flex lg:hidden'), false);
});

/* ── THE DIMMED PAGE CLOSES THE SHEET ────────────────────────────────────── */

test('🌗 a tap on the dimmed page closes the sheet — every Maker sheet has its scrim and grip', async () => {
  const { SheetScrim } = await import(`../${L}/maker-sheet`);
  let closed = 0;
  const el = SheetScrim({ onClose: () => (closed += 1) }) as React.ReactElement<{ onClick: () => void; className: string }>;
  el.props.onClick();
  assert.equal(closed, 1, 'a tap on the dimmed page does not close the sheet');
  assert.match(el.props.className, /\bbg-ink\/40\b/, 'the page behind a sheet is not dimmed');
  assert.match(el.props.className, /\blg:hidden\b/, 'the scrim covers the desktop too');
  assert.match(el.props.className, /\btop-\[52px\]/, 'the scrim covers the top bar — Apply must stay in reach');
  // Each sheet wires its own close to the scrim AND the grip.
  const wiring: Array<[string, RegExp]> = [
    [`${L}/details-workspace.tsx`, /<SheetScrim onClose=\{\(\) => setSheetOpen\(false\)\} \/>[\s\S]*<SheetScrim onClose=\{\(\) => setGuideSheet\(false\)\} \/>/],
    [`${L}/details-workspace.tsx`, /<SheetGrip onClose=\{\(\) => setSheetOpen\(false\)\} \/>[\s\S]*<SheetGrip onClose=\{\(\) => setGuideSheet\(false\)\} \/>/],
    // 📱 The PART sheet has no scrim since 2026-10-04 (owner: a tap on the canvas
    // folds it, a tap on another part switches it — `lib/element-sheet-state.ts`);
    // its grip folds it to the bar. Held in `element-sheet-state.test.ts`.
    [`${E}/element-sheet.tsx`, /<SheetGrip onClose=\{onCollapse \?\? onClose\} \/>/],
    [`${L}/maker-page.tsx`, /<SheetScrim onClose=\{\(\) => setOpen\(false\)\} \/>[\s\S]*<SheetGrip onClose=\{\(\) => setOpen\(false\)\} \/>/],
    [`${L}/maker-logo.tsx`, /\{sheet \? <SheetScrim onClose=\{\(\) => setSheet\(null\)\} \/> : null\}/],
  ];
  for (const [file, re] of wiring) assert.match(stripComments(read(file)), re, `${file}: a sheet lost its dimmed-page close or its grip`);
  // The scene sheet is the HALF sheet instead: a live page, a grip that drags, a slim bar (owner 2026-10-04).
  assert.match(stripComments(read(`${E}/editor-shell.tsx`)), /<MakerHalfSheet\s+label="Inspector"/, 'the scene sheet is no longer the half sheet');
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
    if (['Look', 'Event Details'].includes(i.label)) {
      const word = i.label.length * MAKER_BAR_PHONE_WORD_PX * 0.6 + 2 * MAKER_BAR_PHONE_PAD_PX;
      assert.ok(word <= w, `"${i.label}" needs ${Math.ceil(word)} px on a phone but its button is ${w} px — the word would be cut`);
    }
  }
  assert.ok(used <= 375, `the ${where} bar needs ${used} px at least — more than 375, so it wraps or overflows`);
}

test('📏 each bar is ONE row at 375 px — ‹ Exit · stage · ↶ Undo · 👁 Preview · ✓ Apply on top; Page ▾ · Look · Event Details at the bottom', async () => {
  const html = await shell(null);
  const top = barRow(html, '<header', '</header>');
  // Frame G as the owner rearranged it, 2026-10-04 (Undo beside Apply · ⋯ → Preview · icons).
  fitsOneRow(top, ['Exit', 'Stage', 'Undo', 'Preview', 'Apply'], 'top');
  assert.match(top.head, /max-md:h-\[52px\]/, 'the top bar is no longer one 52 px row');
  const bottom = barRow(html, '<nav aria-label="Maker tools"', '</nav>');
  fitsOneRow(bottom, ['Page', 'Look', 'Event Details'], 'bottom');
  assert.match(top.head + html.slice(html.indexOf('<header'), html.indexOf('</header>')), /as a guest sees it/, 'the top bar does not name the stage the way frame G does');
  assert.match(bottom.head, /env\(safe-area-inset-bottom\)/, 'the bottom bar does not respect the phone’s bottom safe area');
  assert.doesNotMatch(html.slice(html.indexOf('<nav aria-label="Maker tools"')), /data-maker-tool="apply-phone"/, 'Apply is in the bottom bar again — it sits beside Undo');
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
