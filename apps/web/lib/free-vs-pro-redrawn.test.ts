/**
 * apps/web/lib/free-vs-pro-redrawn.test.ts
 *
 * 💎 WHAT IS FREE VS PRO IN THE EVENT HUB MAKER — REDRAWN (DECISION_LOG
 * 2026-09-28). Owner, verbatim: *"free to change design, change text, size,
 * color, background color, only when you start adding themes will it be pro.
 * adding media for background."*
 *
 *   FREE — a part's colour · size · weight · B/I/U · alignment · spacing, the
 *          page's background colour and its BUTTON colour, a scene's colour /
 *          glass background.
 *   PRO  — themes and MEDIA backgrounds. Font choice and motion were not in his
 *          line, so they stay Pro until he says otherwise.
 *
 * 🔑 THE WORST OUTCOME IS A PADLOCK REMOVED IN THE UI WHILE THE SERVER STILL
 * HOLDS THE WRITE. So every free field is driven through the real Apply plan
 * (`planHubDraftApply`) as a couple WITHOUT Pro, and the render and the copy
 * are read too — the UI, the server gate and the sales copy must say one thing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  HUB_ELEMENT_FREE_FIELDS,
  HUB_ELEMENT_PRO_FIELDS,
  HUB_FREE_LOOK_EVENT_COLUMNS,
  HUB_LOOK_EVENT_COLUMNS,
} from './hub-look-pro';
import {
  canvasFreePart,
  canvasLookChange,
  emptyHubDraft,
  mergeHubDraft,
  planHubDraftApply,
  summarizeHubDraft,
  type HubLiveState,
} from './hub-draft';
import { hubTextHash, type HubElementStyle } from './element-style';
import type { HubSectionCanvas } from './hub-canvas';
import type { InvitationWidgetRow } from './invitation-widgets';
import { WEBSITE_PRO_ITEMS } from './website-pro-items';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

const widget = (type: string, config: unknown): InvitationWidgetRow =>
  ({
    widget_id: `S89W-${type}`,
    event_id: 'e1',
    widget_type: type,
    is_visible: true,
    is_always_on: false,
    display_order: 1,
    mode: 'auto',
    config_json: config,
  }) as unknown as InvitationWidgetRow;

const LIVE: HubLiveState = { events: {}, widgets: [widget('schedule', {}), widget('hero', {})] };
const grows = (c: string) => c === 'add' || c === 'change';

/* ── 1 · the two lists name every field, once ─────────────────────────────── */

test('every HubElementStyle field is placed on exactly one side — Pro or free', () => {
  const src = code('lib/element-style.ts');
  const block = /export type HubElementStyle = \{([\s\S]*?)\n\};/.exec(src);
  assert.ok(block, 'HubElementStyle not found — the scan is blind');
  const fields = [...block[1]!.matchAll(/^\s+(\w+)\?:/gm)].map((m) => m[1]!);
  assert.ok(fields.length >= 12, `HubElementStyle scanned short (${fields.length})`);
  // `runs` is compared by its fonts only and `of` is the runs' text hash — both structure.
  // `was` is the text `of` fingerprints (so runs ADAPT when the words change) — structure
  // too: it draws nothing, and it cannot change without `of`, which `runFonts` compares.
  const placed = new Set<string>([...HUB_ELEMENT_PRO_FIELDS, ...HUB_ELEMENT_FREE_FIELDS, 'runs', 'of', 'was']);
  const unplaced = fields.filter((f) => !placed.has(f));
  assert.deepEqual(unplaced, [], 'a part field is on neither side — decide it on purpose');
  for (const f of HUB_ELEMENT_PRO_FIELDS) {
    assert.ok(!(HUB_ELEMENT_FREE_FIELDS as readonly string[]).includes(f), `${f} is both Pro and free`);
  }
  assert.deepEqual([...HUB_ELEMENT_PRO_FIELDS], ['font', 'motion'], 'only font and motion stay Pro');
});

/* ── 2 · the server: every free field applies for a couple without Pro ──── */

const FREE_SAMPLES: Array<[string, HubElementStyle]> = [
  ['heading', { color: '#8a1c2b' }],
  ['heading', { size: 120 } as HubElementStyle],
  ['heading', { weight: 600 } as HubElementStyle],
  ['heading', { italic: true }],
  ['heading', { underline: true }],
  ['heading', { align: 'left' }],
  ['heading', { leading: 1.2 } as HubElementStyle],
  ['heading', { tracking: -2 } as HubElementStyle],
  ['body', { hidden: true }],
];

test('💎 every free part field is WRITTEN at Apply for a couple without Pro', () => {
  for (const [el, style] of FREE_SAMPLES) {
    const d = mergeHubDraft(emptyHubDraft(), { widgets: { schedule: { canvas: { elements: { [el]: style } } } } });
    const drafted = d.widgets.schedule?.canvas?.elements?.[el as 'heading'];
    assert.ok(drafted && Object.keys(drafted).length > 0, `${JSON.stringify(style)} did not survive the draft — the probe is empty`);
    const plan = planHubDraftApply(d, LIVE, false);
    assert.equal(plan.refused.length, 0, `${JSON.stringify(style)} was HELD for a free couple`);
    assert.equal(plan.apply.length, 1, `${JSON.stringify(style)} was not written`);
  }
});

test('💎 font and motion are still HELD for a couple without Pro, and written for one with it', () => {
  for (const style of [{ font: 'script' }, { motion: { in: 'rise' } }] as HubElementStyle[]) {
    const d = mergeHubDraft(emptyHubDraft(), { widgets: { schedule: { canvas: { elements: { heading: style } } } } });
    assert.equal(planHubDraftApply(d, LIVE, false).refused.length, 1, `${JSON.stringify(style)} leaked through for free`);
    assert.equal(planHubDraftApply(d, LIVE, true).refused.length, 0, `${JSON.stringify(style)} held from a Pro couple`);
  }
});

test('💎 inside a run of letters, colour and size are free and only the font is Pro', () => {
  const of = hubTextHash('Maria & Jose');
  const colourRun = mergeHubDraft(emptyHubDraft(), {
    widgets: { hero: { canvas: { elements: { names: { runs: [{ start: 0, end: 1, color: '#8a1c2b', size: 120 }], of } as HubElementStyle } } } },
  });
  assert.equal(planHubDraftApply(colourRun, LIVE, false).refused.length, 0, 'a coloured letter was held as Pro');
  const fontRun = mergeHubDraft(emptyHubDraft(), {
    widgets: { hero: { canvas: { elements: { names: { runs: [{ start: 0, end: 1, font: 'script' }], of } as HubElementStyle } } } },
  });
  assert.equal(planHubDraftApply(fontRun, LIVE, false).refused.length, 1, 'a letter in its own font went through free');
});

/* ── 3 · a held scene still gets its free edits ──────────────────────────── */

test('💎 colour + font on one part: the colour goes live, the font stays in the draft', () => {
  const d = mergeHubDraft(emptyHubDraft(), {
    widgets: { schedule: { canvas: { elements: { heading: { color: '#8a1c2b', font: 'script' } } } } },
  });
  const plan = planHubDraftApply(d, LIVE, false);
  assert.equal(plan.refused.length, 1, 'the font must be held');
  const written = plan.apply.find((i): i is Extract<typeof i, { kind: 'widget' }> => i.kind === 'widget' && i.field === 'canvas');
  assert.ok(written, 'the free colour was held along with the Pro font — "colour is free" was a lie here');
  const canvas = written.value as HubSectionCanvas;
  assert.equal(canvas.elements?.heading?.color, '#8a1c2b', 'the colour did not reach the write');
  assert.equal(canvas.elements?.heading?.font, undefined, 'the Pro font leaked into the free write');
  const kept = plan.remaining.widgets.schedule?.canvas as HubSectionCanvas;
  assert.equal(kept.elements?.heading?.font, 'script', 'the font was dropped from the draft instead of held');
  // One scene, one change on the Apply bar — not two.
  const draft = { ...d, v: 1 as const, history: [] };
  assert.equal(summarizeHubDraft(draft as never, LIVE, false).changeCount, 1);
});

test('🔒 the free part NEVER adds or changes a look — across media, slots, motion and runs', () => {
  const PHOTO = 'r2://setnayan-media/events/e1/a.jpg';
  const OTHER = 'r2://setnayan-media/events/e1/b.jpg';
  const cases: Array<[HubSectionCanvas, HubSectionCanvas]> = [
    [{}, { media: PHOTO, preset: 'calm', elements: { heading: { color: '#112233', font: 'script' } } } as HubSectionCanvas],
    [{ kind: 'color', color: '#ffffff' }, { media: PHOTO, focal: 3, zoom: 120 } as HubSectionCanvas],
    [{ media: PHOTO }, { media: OTHER, kind: 'snippet' } as HubSectionCanvas],
    [{ media: PHOTO, preset: 'calm' }, { kind: 'color', color: '#223344', transition: 'scrub' } as HubSectionCanvas],
    [
      { elements: { names: { runs: [{ start: 0, end: 1, font: 'script' }], of: 'abcdef01' } } } as HubSectionCanvas,
      { elements: { names: { runs: [{ start: 0, end: 1, font: 'script' }, { start: 2, end: 3, font: 'script', color: '#112233' }], of: 'abcdef01' } } } as HubSectionCanvas,
    ],
    [{}, { template: 3, slots: [{ media: PHOTO }, { head: 'Us', text: 'Hi' }], video: { play: 'tap' } } as unknown as HubSectionCanvas],
  ];
  for (const [live, next] of cases) {
    const free = canvasFreePart(live, next);
    assert.ok(!grows(canvasLookChange(live, free)), `a Pro look leaked: ${JSON.stringify(next)} → ${JSON.stringify(free)}`);
  }
  // …and what is free survives it.
  const kept = canvasFreePart({}, { media: PHOTO, elements: { heading: { color: '#112233', font: 'script' } } } as HubSectionCanvas);
  assert.equal(kept.elements?.heading?.color, '#112233');
  assert.equal(kept.media, undefined);
  const words = canvasFreePart({}, { template: 3, slots: [{ media: PHOTO }, { head: 'Us', text: 'Hi' }] } as unknown as HubSectionCanvas);
  assert.equal((words.slots?.[1] as { head?: string } | undefined)?.head, 'Us', 'a slot’s words were lost with its photo');
});

/* ── 4 · the button colour: the server, the render and the panel agree ─── */

test('💎 the button colour is free on every side: gate, Apply, guest render, panel', () => {
  assert.ok((HUB_FREE_LOOK_EVENT_COLUMNS as readonly string[]).includes('site_button_color'));
  assert.ok(!(HUB_LOOK_EVENT_COLUMNS as readonly string[]).includes('site_button_color'));
  const d = mergeHubDraft(emptyHubDraft(), { events: { site_button_color: '#aa0000' } });
  assert.equal(planHubDraftApply(d, LIVE, false).refused.length, 0, 'Apply held a free couple’s button colour');
  // The live writer no longer feeds the button into the Pro decision.
  const action = code('app/dashboard/[eventId]/website/colors/actions.ts');
  const call = action.slice(action.indexOf('siteLookChange('), action.indexOf('ombreChange,', action.indexOf('siteLookChange(')));
  assert.ok(call.length > 20, 'the siteLookChange call was not found — the scan is blind');
  assert.doesNotMatch(call, /button/, 'the live writer still asks Pro for the button colour');
  // The guest page paints it outside the Pro branch.
  const vars = code('app/[slug]/_lib/pro-site-vars.ts');
  // 2026-10-05: the face left the Pro branch too ("Colors, and Fonts are all
  // free"), so the bag has NO Pro branch — and the button colour is built
  // unconditionally, beside the background.
  assert.doesNotMatch(vars, /if \(proWatermarkHidden\)/, 'a Pro branch came back into the colours bag');
  assert.match(vars, /buildCustomSiteColorVars\(bgHex, \(event\.site_button_color as string \| null\) \?\? null\)/, 'the button colour is not built for every event');
  // The panel draws the button colour whether or not the Pro half is locked.
  const panel = code('app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx');
  const between = panel.slice(panel.indexOf('<BackgroundField'), panel.indexOf('<ButtonColourField'));
  assert.ok(between.length > 0, 'the colour fields were not found — the scan is blind');
  assert.doesNotMatch(between, /proLocked/, 'the button colour is still behind the Pro lock');
});

/* ── 5 · the Maker's marks sit only on the Pro rows ───────────────────────── */

test('💎 the part sheet marks Font ▾ and Animate — not the whole part', () => {
  const sheet = code('app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx');
  const title = sheet.slice(sheet.indexOf('id={titleId}'), sheet.indexOf('</p>', sheet.indexOf('id={titleId}')));
  assert.ok(title.length > 20, 'the sheet title was not found — the scan is blind');
  assert.doesNotMatch(title, /PaidMark|Pro/, 'the whole part sheet still wears one Pro mark');
  // The sheet draws exactly two marks — Font ▾ and Animate — and hands them down.
  assert.equal((sheet.match(/<PaidMark/g) ?? []).length, 2, 'the sheet draws a mark on something that is free');
  assert.match(sheet, /fontMark=\{fontMark\}/);
  assert.match(sheet, /<PartAnimateTab\s+proMark=\{animateMark\}/);
  const rows = code('app/dashboard/[eventId]/website/editor/_components/part-inspector.tsx');
  assert.match(rows, /fontMark \? \(/, 'Font ▾ lost its mark');
  assert.match(rows, /data-part-animate-pro/, 'Animate lost its mark');
  assert.doesNotMatch(rows, /<PaidMark/, 'a Text row draws its own padlock');
  const parts = code('app/dashboard/[eventId]/website/editor/_components/scene-inspector.tsx');
  const sceneParts = parts.slice(parts.indexOf('export function SceneParts'));
  assert.doesNotMatch(sceneParts.slice(0, sceneParts.indexOf('</div>')), /PaidMark|proMark/, 'the scene’s parts list still says Pro');
});

/* ── 6 · the copy stops selling colours ───────────────────────────────────── */

test('💎 no sales copy sells a colour; the Pro list names media backgrounds instead', () => {
  const items = WEBSITE_PRO_ITEMS as readonly string[];
  assert.ok(items.length >= 8, 'the Pro list scanned short');
  assert.ok(!items.some((i) => /colou?r/i.test(i)), 'the Pro list still sells a colour');
  assert.ok(items.includes('Photo and video backgrounds'), 'the Pro list does not name media backgrounds');
  const buy = code('app/dashboard/[eventId]/studio/website-pro/page.tsx');
  const benefits = /const BENEFITS = \[([\s\S]*?)\];/.exec(buy);
  assert.ok(benefits, 'BENEFITS not found — the scan is blind');
  // Plural on purpose: "a Pro theme … in your colour" describes the THEME (Pro),
  // while "your own colours for the page and its buttons" sold the colours.
  assert.doesNotMatch(benefits[1]!, /colou?rs\b/i, 'the buy page still sells colours');
  const catalog = code('lib/add-ons-catalog.ts');
  const blurb = /key: 'website-pro',[\s\S]*?blurb: '([^']*)'/.exec(catalog);
  assert.ok(blurb, 'the website-pro blurb was not found — the scan is blind');
  assert.doesNotMatch(blurb[1]!, /colou?rs\b/i, 'the Studio blurb still sells colours');
});
