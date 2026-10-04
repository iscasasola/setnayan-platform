/**
 * the-apply-sheet-names-each-change.test.ts — owner 2026-10-04, verbatim:
 * *"Yes"* to the ✓ Apply sheet listing what goes live, not only "5 changes"
 * (DECISION_LOG "CHANGING THE EVENT DATE MOVES THE WHOLE SCHEDULE · THE APPLY
 * SHEET NAMES EACH CHANGE").
 *
 * Held here:
 *   1. THE LIST MATCHES THE COUNT — `hubDraftChangeLines` is exactly
 *      `summarizeHubDraft(...).changeCount` lines, for a couple with Pro and
 *      without, because both walk ONE reader (`hubDraftCountedChanges`). The
 *      names (two columns) and the date (two) are one line each, as they are
 *      one in the badge.
 *   2. EVERY DRAFT KIND MAPS TO A LABEL — every draftable `events` column,
 *      every widget field, every Post Event item and every fixed part's style
 *      reads as "Place · What", never blank or "undefined".
 *   3. MOUNTED: up to eight lines, then "+ N more"; a Pro line keeps its ◆;
 *      and OPENING THE SHEET WRITES NOTHING — no handler runs on render, and
 *      the sheet holds no write of its own (its only write is the Apply its
 *      parent hands it).
 *   4. WIRED: the bar's loader and the after-save read fill `summary.changes`
 *      from that reader, and the bar passes it to the sheet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  HUB_DRAFT_EVENT_COLUMNS,
  FIXED_STYLE_LABEL,
  emptyHubDraft,
  mergeHubDraft,
  summarizeHubDraft,
  type HubDraftChangeLine,
  type HubDraftItem,
  type HubLiveState,
} from '@/lib/hub-draft';
import { HUB_DRAFT_EVENT_PLACE, hubDraftChangeLines, hubDraftChangePlace } from '@/lib/hub-draft-change-lines';
import { HUB_BUTTON_STYLE_VALUES } from '@/lib/hub-buttons';
import { INVITE_THEME_IDS } from '@/lib/invite-themes';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';

(globalThis as unknown as { React: unknown }).React = React;

const PHOTO = 'r2://setnayan-media/events/e1/hero.jpg';

function row(p: Partial<InvitationWidgetRow> & Pick<InvitationWidgetRow, 'widget_type'>): InvitationWidgetRow {
  return {
    widget_id: `w-${p.widget_type}`,
    event_id: 'e1',
    display_order: 5,
    is_visible: true,
    is_always_on: false,
    tier: 'basic',
    config_json: {},
    created_at: '',
    updated_at: '',
    mode: 'auto',
    ...p,
  };
}

const LIVE: HubLiveState = {
  events: { display_name: 'A & M', bride_name: 'A', event_date: '2031-03-13', event_date_precision: 'day', ceremony_time: null },
  widgets: [
    row({ widget_type: 'hero', is_always_on: true, display_order: 1 }),
    row({ widget_type: 'countdown', display_order: 5 }),
    row({ widget_type: 'schedule', display_order: 6, config_json: { canvas: { preset: 'calm' } } }),
    row({ widget_type: 'custom_1', display_order: 20, config_json: { custom: { title: 'Ours', body: 'Words' } } }),
  ],
};

const DRAFT = mergeHubDraft(emptyHubDraft(), {
  events: {
    // ✍ The names — two columns, ONE change.
    display_name: 'Ana & Miguel',
    bride_name: 'Ana',
    // 🗓 The date — two columns, ONE change.
    event_date: '2031-05-01',
    event_date_precision: 'day',
    ceremony_time: '15:00',
    site_button_style: HUB_BUTTON_STYLE_VALUES[0],
    invite_theme: INVITE_THEME_IDS[INVITE_THEME_IDS.length - 1],
  },
  widgets: {
    countdown: { mode: 'hidden' },
    schedule: { canvas: { media: PHOTO, preset: 'cinematic' } },
    custom_1: { custom: { title: 'Ours', body: 'New words' } },
  },
});

const text = (l: Pick<HubDraftChangeLine, 'place' | 'what'>) => `${l.place} · ${l.what}`;

/* ══════════════════════════════════════════ 1 · the list matches the count ═══ */

test('the named list is exactly the count — with Pro and without — in one walk', () => {
  for (const ownsPro of [false, true]) {
    const summary = summarizeHubDraft(DRAFT, LIVE, ownsPro);
    const lines = hubDraftChangeLines(DRAFT, LIVE, ownsPro);
    assert.ok(summary.changeCount >= 8, `anti-vacuity: the draft holds ${summary.changeCount} changes: ${hubDraftChangeLines(DRAFT, LIVE, ownsPro).map(text).join(" | ")}`);
    assert.equal(lines.length, summary.changeCount, `ownsPro=${ownsPro}: ${lines.length} lines for a count of ${summary.changeCount}`);
    const said = lines.map(text);
    // The facts carried by several columns are ONE line each.
    assert.equal(said.filter((l) => l === 'Event Details · Names').length, 1, 'the names are listed twice');
    assert.equal(said.filter((l) => l === 'Event Details · Date').length, 1, 'the date is listed twice');
    assert.ok(said.includes('Event Details · Ceremony time'), said.join(' | '));
    assert.ok(said.includes('Look · Buttons'), said.join(' | '));
    assert.ok(said.includes('Look · Theme'), said.join(' | '));
    // A held line is only ever a Pro one; the owning couple holds nothing.
    assert.ok(lines.every((l) => !l.held || l.pro), 'a free change is listed as held');
    assert.equal(lines.some((l) => l.held), !ownsPro, ownsPro ? 'an owning couple sees a held change' : 'the free couple’s Pro change is not marked held');
  }
  assert.deepEqual(hubDraftChangeLines(null, LIVE, false), [], 'no draft names a change');
});

/* ═══════════════════════════════════════ 2 · every draft kind maps to a label ═══ */

const ok = (p: { place: string; what: string }, of: string) => {
  assert.ok(p.place.trim() && p.what.trim(), `${of} has no label`);
  assert.doesNotMatch(`${p.place} ${p.what}`, /undefined|null|\[object/, `${of} reads "${text(p)}"`);
};

test('every draft kind maps to a plain "Place · What" label', () => {
  for (const c of HUB_DRAFT_EVENT_COLUMNS) ok(HUB_DRAFT_EVENT_PLACE[c], `events.${c}`);
  const base = { change: 'change' as const, pro: false, value: null };
  const fields = ['mode', 'is_visible', 'display_order', 'canvas', 'main', 'stage_order', 'std_lead', 'custom', 'venue'] as const;
  for (const field of fields) {
    const item = { ...base, kind: 'widget', widgetType: 'schedule', widgetId: 'w-schedule', field } as HubDraftItem;
    ok(hubDraftChangePlace(item, LIVE), `widget field ${field}`);
  }
  for (const field of ['sections', 'sectionOrder', 'sceneLooks', 'chapterOverrides', 'customColumns', 'reviews'] as const) {
    const item = { ...base, kind: 'editorial', item: { field, value: null, change: 'change', pro: false } } as unknown as HubDraftItem;
    const p = hubDraftChangePlace(item, LIVE);
    ok(p, `editorial ${field}`);
    assert.equal(p.place, 'Post Event');
  }
  for (const scene of Object.keys(FIXED_STYLE_LABEL)) {
    ok(hubDraftChangePlace({ ...base, kind: 'fixed-style', scene, value: null, pro: false } as HubDraftItem, LIVE), `fixed ${scene}`);
  }
  // The owner's own examples read as he wrote them.
  assert.equal(text(HUB_DRAFT_EVENT_PLACE.site_button_style), 'Look · Buttons');
  assert.equal(text(HUB_DRAFT_EVENT_PLACE.ceremony_time), 'Event Details · Ceremony time');
  // A scene's look names what moved in it.
  const canvas = { ...base, kind: 'widget', widgetType: 'schedule', widgetId: 'w-schedule', field: 'canvas', value: { preset: 'cinematic' } } as HubDraftItem;
  assert.match(hubDraftChangePlace(canvas, LIVE).what, /Animation/);
});

/* ═════════════════════════ 3 · mounted: eight lines, + N more, ◆, no write ═══ */

const LINES: HubDraftChangeLine[] = Array.from({ length: 11 }, (_, i) => ({
  place: i === 0 ? 'Look' : `Place ${i}`,
  what: i === 0 ? 'Font' : `Thing ${i}`,
  pro: i === 0,
  held: false,
}));

async function mount(changes: HubDraftChangeLine[] | undefined, calls: string[]) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ApplyProSheet } = await import('./apply-pro-sheet');
  return renderToStaticMarkup(
    React.createElement(ApplyProSheet as never, {
      effects: [],
      changeCount: changes?.length ?? 0,
      changes,
      priceLabel: null,
      proHref: null,
      pending: false,
      onGo: () => calls.push('go'),
      onRemove: () => calls.push('remove'),
      onApplyFree: () => calls.push('apply'),
      onClose: () => calls.push('close'),
    }),
  );
}

test('mounted: at most eight named lines, then "+ N more"; a Pro line keeps its ◆; opening writes nothing', async () => {
  const calls: string[] = [];
  const html = await mount(LINES, calls);
  assert.match(html, /Ready to apply/);
  assert.match(html, /11 changes guests do not see yet/);
  const { APPLY_SHEET_MAX_LINES } = await import('./apply-pro-sheet');
  assert.equal(APPLY_SHEET_MAX_LINES, 8, 'the owner asked for a short list (~8 lines)');
  assert.equal((html.match(/data-apply-change=""/g) ?? []).length, 8, 'not eight named lines');
  assert.match(html, /\+ 3 more/, 'the rest are not counted');
  assert.match(html, /Look · <\/span><span class="font-semibold">Font</, 'a line does not read "Look · Font"');
  assert.doesNotMatch(html, /Thing 9|Thing 10/, 'the ninth line was shown');
  // ◆ on the Pro line only: the house mark's own data attribute.
  const proLine = html.split('data-apply-change=""')[1]!;
  const freeLine = html.split('data-apply-change=""')[2]!;
  assert.match(proLine, /data-paid-mark/, 'the Pro line lost its ◆');
  assert.doesNotMatch(freeLine, /data-paid-mark/, 'a free line wears ◆');
  assert.deepEqual(calls, [], `opening the sheet ran ${calls.join(', ')}`);
  // Nine or fewer: no "+ more"; no list read: only the count, never an empty list.
  assert.doesNotMatch(await mount(LINES.slice(0, 8), calls), /more</);
  assert.doesNotMatch(await mount(undefined, calls), /data-apply-changes/);
  assert.deepEqual(calls, []);
});

test('the sheet holds no write of its own — its one write is the Apply its parent hands it', () => {
  const src = stripComments(readFileSync(join(__dirname, 'apply-pro-sheet.tsx'), 'utf8'));
  assert.doesNotMatch(src, /hub-draft-actions|hubDraftAction|fetch\(|useEffect\(/, 'the sheet writes or fetches on open');
  assert.doesNotMatch(src, /hub-draft-change-lines/, 'the sheet imports the line builder — the Maker’s first load would carry it');
});

/* ═════════════════════════════════════════════════════════════ 4 · wiring ═══ */

test('wired: the loader and the after-save read fill summary.changes from the ONE reader; the bar hands it to the sheet', () => {
  const store = stripComments(readFileSync(join(process.cwd(), 'lib/hub-draft-store.ts'), 'utf8'));
  assert.match(store, /summary\.changes = hubDraftChangeLines\(draft, live, ownsPro && !storeShell\);/, 'the bar’s loader does not name the changes with the count’s own entitlement');
  assert.match(store, /changes: hubDraftChangeLines\(draft, live, false\)/, 'the after-save read (free) does not name the changes');
  assert.match(store, /changes: hubDraftChangeLines\(draft, live, true\)/, 'the after-save read (owned) does not name the changes');
  const lines = stripComments(readFileSync(join(process.cwd(), 'lib/hub-draft-change-lines.ts'), 'utf8'));
  assert.match(lines, /hubDraftCountedChanges\(planHubDraftApply\(draft, live, ownsPro\)\)/, 'the list walks a second list');
  const hd = stripComments(readFileSync(join(process.cwd(), 'lib/hub-draft.ts'), 'utf8'));
  assert.match(hd, /const changeCount = hubDraftCountedChanges\(plan\)\.length;/, 'the count walks a second list');
  const bar = stripComments(readFileSync(join(__dirname, 'hub-draft-bar.tsx'), 'utf8'));
  assert.match(bar, /<ApplyProSheet[\s\S]*?changes=\{summary\.changes\}/, 'the bar does not hand the named changes to the sheet');
});
