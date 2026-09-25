/**
 * hub-draft.test.ts — the Event Hub draft's rules, proven on the PLAN.
 *
 * Owner 2026-09-24: edits are a draft guests do not see until Apply; Restore and
 * Reset. 2026-09-25: a free couple may TRY Pro in the draft and pays at Apply.
 *
 * 🔑 Both answers of every gate are constructed: the free couple is refused AND
 * the owning couple is allowed — a gate that can only answer one way renders
 * exactly like a gate that works.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HUB_DRAFT_EVENT_COLUMNS,
  HUB_DRAFT_EVENT_LABEL,
  HUB_DRAFT_HISTORY_LIMIT,
  HUB_RESET_EVENT_COLUMNS,
  HUB_RESET_SCOPES,
  canvasLookChange,
  classifyHubDraft,
  emptyHubDraft,
  eventColumnIsPro,
  hubDraftWriteTables,
  hubResetPatch,
  mergeHubDraft,
  overlayHubDraftEvent,
  overlayHubDraftWidgets,
  planHubDraftApply,
  sanitizeHubDraft,
  summarizeHubDraft,
  undoHubDraft,
  type HubLiveState,
} from './hub-draft';
import { HUB_FREE_LOOK_EVENT_COLUMNS, HUB_LOOK_EVENT_COLUMNS, HUB_WORDS_EVENT_COLUMNS } from './hub-look-pro';
import type { InvitationWidgetRow } from './invitation-widgets';

const PHOTO = 'r2://setnayan-media/events/e1/hero.jpg';
const OTHER = 'r2://setnayan-media/events/e1/gallery-2.jpg';

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
  events: { rsvp_backdrop: null },
  widgets: [
    row({ widget_type: 'hero', is_always_on: true, display_order: 1 }),
    row({ widget_type: 'countdown', display_order: 5 }),
    row({ widget_type: 'schedule', display_order: 6, config_json: { canvas: { media: PHOTO, preset: 'cinematic' }, keep: 'me' } }),
    row({ widget_type: 'custom_1', display_order: 20, config_json: { custom: { title: 'Ours', body: 'Words' } } }),
  ],
};

/* ── the shape ─────────────────────────────────────────────────────────────── */

test('sanitize drops unknown keys, unknown sections and refs outside the public bucket', () => {
  const d = sanitizeHubDraft({
    events: { rsvp_backdrop: { theme: 'nope' }, invite_theme: 'velvet', guests: 'x' },
    widgets: {
      countdown: { mode: 'hidden', display_order: 3, evil: 1 },
      not_a_section: { mode: 'hidden' },
      schedule: { canvas: { media: 'r2://setnayan-thread-files/payment.png', preset: 'calm' } },
    },
    history: 'x',
  });
  assert.deepEqual(d.events, {}, 'an unusable backdrop and non-draft columns must be dropped');
  assert.deepEqual(d.widgets.countdown, { mode: 'hidden', display_order: 3 });
  assert.equal((d.widgets as Record<string, unknown>).not_a_section, undefined);
  assert.deepEqual(d.widgets.schedule, { canvas: { preset: 'calm' } }, 'a private-bucket ref must never survive into a draft');
  assert.deepEqual(d.history, []);
});

test('the draft holds no WORDS column and no free-colour column — only look it can preview', () => {
  for (const c of HUB_DRAFT_EVENT_COLUMNS) {
    assert.ok(!(HUB_WORDS_EVENT_COLUMNS as readonly string[]).includes(c), `${c} is words`);
    assert.ok(!(HUB_FREE_LOOK_EVENT_COLUMNS as readonly string[]).includes(c), `${c} is a free colour`);
  }
});

/* ── save · undo ───────────────────────────────────────────────────────────── */

test('a save merges per field, and Undo walks back one save at a time', () => {
  let d = mergeHubDraft(emptyHubDraft(), { widgets: { countdown: { mode: 'hidden' } } });
  d = mergeHubDraft(d, { widgets: { countdown: { display_order: 9 } } });
  assert.deepEqual(d.widgets.countdown, { mode: 'hidden', display_order: 9 }, 'an order save forgot the drafted mode');
  d = undoHubDraft(d);
  assert.deepEqual(d.widgets.countdown, { mode: 'hidden' });
  d = undoHubDraft(d);
  assert.deepEqual(d.widgets, {});
  assert.deepEqual(undoHubDraft(d), d, 'undo past the start is a no-op');
});

test('the undo history is bounded', () => {
  let d = emptyHubDraft();
  for (let i = 0; i < HUB_DRAFT_HISTORY_LIMIT + 5; i += 1) d = mergeHubDraft(d, { widgets: { countdown: { display_order: i } } });
  assert.equal(d.history.length, HUB_DRAFT_HISTORY_LIMIT);
});

/* ── the preview: host sees the draft, guests see live ─────────────────────── */

test('with no draft (every guest) the overlays hand back exactly what they were given', () => {
  const ev = { event_id: 'e1', display_name: 'x' };
  assert.equal(overlayHubDraftEvent(ev, null), ev);
  const rows = overlayHubDraftWidgets(LIVE.widgets as InvitationWidgetRow[], null);
  rows.forEach((r, i) => assert.equal(r, LIVE.widgets[i]));
});

test('the host overlay lays mode, order and canvas on NEW rows, keeps sibling config, and never moves an always-on section', () => {
  const d = mergeHubDraft(emptyHubDraft(), {
    widgets: {
      hero: { mode: 'hidden', display_order: 99, canvas: { preset: 'calm' } },
      schedule: { canvas: { kind: 'color', color: '#112233' } },
    },
  });
  const before = JSON.stringify(LIVE.widgets);
  const rows = overlayHubDraftWidgets(LIVE.widgets as InvitationWidgetRow[], d);
  assert.equal(JSON.stringify(LIVE.widgets), before, 'the overlay mutated the live rows');
  const hero = rows.find((r) => r.widget_type === 'hero')!;
  assert.equal(hero.mode, 'auto');
  assert.equal(hero.display_order, 1);
  assert.deepEqual(hero.config_json, { canvas: { preset: 'calm' } });
  const schedule = rows.find((r) => r.widget_type === 'schedule')!;
  assert.deepEqual(schedule.config_json, { canvas: { kind: 'color', color: '#112233' }, keep: 'me' });
});

test('a drafted backdrop reaches the event row the page renders from, as a new object', () => {
  const ev = { event_id: 'e1' };
  const d = mergeHubDraft(emptyHubDraft(), { events: { rsvp_backdrop: { theme: 'gilded-dusk', intensity: 'lavish' } } });
  const out = overlayHubDraftEvent(ev, d);
  assert.notEqual(out, ev);
  assert.ok('rsvp_backdrop' in out);
  assert.ok(!('rsvp_backdrop' in ev), 'the cached row was mutated');
});

/* ── apply: the gate ───────────────────────────────────────────────────────── */

const tryPro = () =>
  mergeHubDraft(emptyHubDraft(), {
    events: { rsvp_backdrop: { theme: 'gilded-dusk', intensity: 'standard' } },
    widgets: {
      countdown: { mode: 'hidden', display_order: 2, canvas: { media: OTHER } },
      schedule: { canvas: { kind: 'color', color: '#aabbcc' } },
    },
  });

test('a FREE couple: every Pro key is refused and stays in the draft; the free keys apply', () => {
  const d = tryPro();
  const plan = planHubDraftApply(d, LIVE, false);
  const applied = plan.apply.map((i) => (i.kind === 'event' ? i.column : `${i.widgetType}.${i.field}`));
  const refused = plan.refused.map((i) => (i.kind === 'event' ? i.column : `${i.widgetType}.${i.field}`));
  assert.ok(applied.includes('countdown.mode'), 'hide is free');
  assert.ok(applied.includes('countdown.display_order'), 'reorder is free');
  assert.ok(applied.includes('schedule.canvas'), 'swapping media FOR a colour takes media down — free');
  assert.ok(refused.includes('countdown.canvas'), 'a photo background is Pro');
  assert.ok(refused.includes('rsvp_backdrop'), 'adding the moving backdrop is Pro');
  for (const i of plan.refused) assert.equal(i.pro, true);
  assert.ok(plan.remaining.widgets.countdown?.canvas, 'the tried Pro change must stay in the draft to pay and Apply');
  assert.equal(plan.remaining.widgets.countdown?.mode, undefined, 'an applied key must leave the draft');
});

test('an OWNING couple: the same draft applies in full', () => {
  const plan = planHubDraftApply(tryPro(), LIVE, true);
  assert.equal(plan.refused.length, 0);
  assert.ok(plan.apply.some((i) => i.kind === 'widget' && i.widgetType === 'countdown' && i.field === 'canvas'));
});

test('every draftable events column that is look is refused without Pro when added, applied when removed', () => {
  for (const column of HUB_DRAFT_EVENT_COLUMNS) {
    assert.equal(eventColumnIsPro(column), (HUB_LOOK_EVENT_COLUMNS as readonly string[]).includes(column));
  }
  const live: HubLiveState = { events: { rsvp_backdrop: { theme: 'gilded-dusk', intensity: 'standard' } }, widgets: [] };
  // Taking the backdrop OFF is a removal — free.
  const off = planHubDraftApply(mergeHubDraft(emptyHubDraft(), { events: { rsvp_backdrop: null } }), live, false);
  assert.equal(off.refused.length, 0);
  assert.equal(off.apply.length, 1);
});

test('a key equal to live is not an item — Apply is idempotent', () => {
  const d = mergeHubDraft(emptyHubDraft(), {
    widgets: { countdown: { mode: 'auto', display_order: 5 }, schedule: { canvas: { media: PHOTO, preset: 'cinematic' } } },
  });
  assert.deepEqual(classifyHubDraft(d, LIVE).items, []);
  assert.equal(summarizeHubDraft(d, LIVE, false).hasChanges, false);
});

test('an always-on section never gets a mode or order item', () => {
  const d = mergeHubDraft(emptyHubDraft(), { widgets: { hero: { mode: 'hidden', display_order: 40 } } });
  assert.deepEqual(classifyHubDraft(d, LIVE).items, []);
});

test('a drafted section with no live row is reported, never silently dropped', () => {
  const d = mergeHubDraft(emptyHubDraft(), { widgets: { custom_2: { mode: 'hidden' } } });
  assert.deepEqual(classifyHubDraft(d, LIVE).orphans, ['custom_2']);
});

test('canvas classification: colour free, media add Pro, motion off free', () => {
  assert.equal(canvasLookChange({}, { kind: 'color', color: '#000000' }), 'none');
  assert.equal(canvasLookChange({}, { media: PHOTO }), 'add');
  assert.equal(canvasLookChange({ media: PHOTO }, { media: OTHER }), 'change');
  assert.equal(canvasLookChange({ media: PHOTO, preset: 'calm' }, { media: PHOTO }), 'remove');
  assert.equal(canvasLookChange({ media: PHOTO }, { media: PHOTO, kind: 'snippet' }), 'change');
});

/* ── restore · reset ───────────────────────────────────────────────────────── */

test('Restore (no draft) leaves the live page byte-identical: nothing to write, nothing overlaid', () => {
  assert.deepEqual(planHubDraftApply(emptyHubDraft(), LIVE, true).apply, []);
  assert.equal(JSON.stringify(overlayHubDraftWidgets(LIVE.widgets as InvitationWidgetRow[], null)), JSON.stringify(LIVE.widgets));
});

test('Reset, for every scope, plans writes to invitation_widgets and events ONLY — never a guest-owned table', () => {
  const live: HubLiveState = {
    events: { rsvp_backdrop: { theme: 'gilded-dusk', intensity: 'lavish' } },
    widgets: LIVE.widgets.map((r) => ({ ...r, mode: 'hidden' as const, display_order: 50, config_json: { canvas: { preset: 'calm' } } })),
  };
  for (const scope of HUB_RESET_SCOPES) {
    const draft = mergeHubDraft(emptyHubDraft(), hubResetPatch(scope));
    const { items } = classifyHubDraft(draft, live);
    for (const t of hubDraftWriteTables(items)) {
      assert.ok(t === 'events' || t === 'invitation_widgets', `reset ${scope} would write ${t}`);
    }
    for (const i of items) {
      if (i.kind === 'event') assert.ok((HUB_DRAFT_EVENT_COLUMNS as readonly string[]).includes(i.column));
    }
    assert.ok(items.length > 0, `reset ${scope} planned nothing against a customised page — the test proves nothing`);
  }
});

test('Reset never touches the couple’s own sections, and puts shipped ones back where the seed put them', () => {
  const p = hubResetPatch('all');
  assert.equal(p.widgets?.custom_1, undefined, 'a section the couple wrote is theirs');
  assert.deepEqual(p.widgets?.countdown, { mode: 'auto', canvas: null, display_order: 5 });
  assert.equal(p.widgets?.hero?.display_order, 1);
  assert.equal(p.widgets?.our_love_story?.display_order, 16);
  // A stage reset only names that stage's sections.
  const std = hubResetPatch('save_the_date');
  assert.deepEqual(Object.keys(std.widgets ?? {}).sort(), ['hero']);
});


/* ── Maker Phase 6 — the made-once group: hero · reveal · logo ─────────────── */

const LIVE_BARE: HubLiveState = { events: {}, widgets: [] };
const HERO_REF = 'r2://setnayan-media/events/e1/landing-page-hero/new.jpg';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>';

test('the made-once columns are draftable, each with a sentence-ready label', () => {
  for (const c of ['landing_page_hero_image_url', 'std_reveal_template', 'monogram_custom_svg', 'monogram_studio_config']) {
    assert.ok((HUB_DRAFT_EVENT_COLUMNS as readonly string[]).includes(c), `${c} is not draftable`);
  }
  for (const c of HUB_DRAFT_EVENT_COLUMNS) assert.ok(HUB_DRAFT_EVENT_LABEL[c].length > 0, `${c} has no label`);
});

test('a drafted hero is held to the public bucket; a private ref or a URL never lands', () => {
  const d = sanitizeHubDraft({
    events: { landing_page_hero_image_url: 'r2://payment-proofs/events/e1/receipt.jpg' },
  });
  assert.equal('landing_page_hero_image_url' in d.events, false);
  assert.equal('landing_page_hero_image_url' in sanitizeHubDraft({ events: { landing_page_hero_image_url: 'https://x.test/a.jpg' } }).events, false);
  assert.equal(sanitizeHubDraft({ events: { landing_page_hero_image_url: HERO_REF } }).events.landing_page_hero_image_url, HERO_REF);
  assert.equal(sanitizeHubDraft({ events: { landing_page_hero_image_url: null } }).events.landing_page_hero_image_url, null);
});

test('the hero: a free couple TRIES a photo (refused at Apply), removes one freely; an owning couple applies', () => {
  const add = mergeHubDraft(emptyHubDraft(), { events: { landing_page_hero_image_url: HERO_REF } });
  const free = planHubDraftApply(add, LIVE_BARE, false);
  assert.equal(free.apply.length, 0);
  assert.equal(free.refused.length, 1);
  assert.equal(free.remaining.events.landing_page_hero_image_url, HERO_REF, 'a refused try stays in the draft');
  assert.equal(planHubDraftApply(add, LIVE_BARE, true).apply.length, 1);
  const off = mergeHubDraft(emptyHubDraft(), { events: { landing_page_hero_image_url: null } });
  const removal = planHubDraftApply(off, { events: { landing_page_hero_image_url: PHOTO }, widgets: [] }, false);
  assert.equal(removal.refused.length, 0, 'taking the photo off is never Pro');
  assert.equal(removal.apply.length, 1);
});

test('the reveal: "No reveal" is free, every opening is Pro — both answers of the gate', () => {
  const plan = (v: string | null, ownsPro: boolean, live: string | null = null) =>
    planHubDraftApply(
      mergeHubDraft(emptyHubDraft(), { events: { std_reveal_template: v } }),
      { events: { std_reveal_template: live }, widgets: [] },
      ownsPro,
    );
  for (const opening of ['four-flap', 'two-flap-vertical', 'two-flap-horizontal', 'church-doors', 'veil-sheer']) {
    assert.equal(plan(opening, false).refused.length, 1, `${opening} applied for a free couple`);
    assert.equal(plan(opening, true).apply.length, 1, `${opening} refused for an owning couple`);
  }
  assert.equal(plan('none', false).apply.length, 1, '"No reveal" must be free');
  assert.equal(plan('none', false).refused.length, 0);
  assert.equal(plan(null, false, 'four-flap').refused.length, 0, 'clearing a reveal is free');
  // An unknown opening never lands in a draft.
  assert.equal('std_reveal_template' in sanitizeHubDraft({ events: { std_reveal_template: 'gold-monogram' } }).events, false);
});

test('the logo autosave: the studio mark is sanitised like saveStudioAction, and is free to apply', () => {
  const hostile = sanitizeHubDraft({ events: { monogram_custom_svg: '<svg><script>alert(1)</script></svg>' } });
  assert.equal('monogram_custom_svg' in hostile.events, false, 'a hostile SVG must never survive into a draft');
  const huge = sanitizeHubDraft({ events: { monogram_custom_svg: SVG + ' '.repeat(400_001) } });
  assert.equal('monogram_custom_svg' in huge.events, false);
  const d = mergeHubDraft(emptyHubDraft(), { events: { monogram_custom_svg: SVG } });
  const kept = d.events.monogram_custom_svg;
  assert.equal(typeof kept, 'string', 'a clean studio mark must be kept');
  const free = planHubDraftApply(d, { events: { monogram_custom_svg: null }, widgets: [] }, false);
  assert.equal(free.refused.length, 0, 'letters, frame and ink are free');
  assert.equal(free.apply.length, 1);
});

test('Reset — even "all" — never erases the hero photo, the reveal or the logo', () => {
  assert.deepEqual([...HUB_RESET_EVENT_COLUMNS], ['rsvp_backdrop']);
  for (const scope of HUB_RESET_SCOPES) {
    const ev = hubResetPatch(scope).events ?? {};
    for (const c of ['landing_page_hero_image_url', 'std_reveal_template', 'monogram_custom_svg', 'monogram_studio_config']) {
      assert.equal(c in ev, false, `reset ${scope} would erase ${c}`);
    }
  }
});

test('the host preview shows the drafted hero, reveal and logo (the overlay is by column)', () => {
  const d = mergeHubDraft(emptyHubDraft(), {
    events: { landing_page_hero_image_url: HERO_REF, std_reveal_template: 'four-flap' },
  });
  const row = overlayHubDraftEvent({ landing_page_hero_image_url: null, std_reveal_template: null, x: 1 }, d);
  assert.equal(row.landing_page_hero_image_url, HERO_REF);
  assert.equal(row.std_reveal_template, 'four-flap');
  assert.equal(row.x, 1);
});

/* ── the eye (is_visible) — the navigator's visibility, drafted ─────────────── */

test('the eye is drafted: sanitised, overlaid on the host preview only, and never Pro at Apply', () => {
  // Sanitise: only a real boolean survives.
  const clean = sanitizeHubDraft({ widgets: { countdown: { is_visible: false }, schedule: { is_visible: 'no' } } });
  assert.equal(clean.widgets.countdown?.is_visible, false);
  assert.equal(clean.widgets.schedule, undefined, 'a non-boolean eye is dropped, not coerced');

  const d = mergeHubDraft(emptyHubDraft(), { widgets: { countdown: { is_visible: false }, hero: { is_visible: false } } });
  // Guests (no draft) see the live row; the host's overlay hides it.
  const guest = overlayHubDraftWidgets(LIVE.widgets as InvitationWidgetRow[], null);
  assert.equal(guest.find((r) => r.widget_type === 'countdown')!.is_visible, true);
  const rows = overlayHubDraftWidgets(LIVE.widgets as InvitationWidgetRow[], d);
  assert.equal(rows.find((r) => r.widget_type === 'countdown')!.is_visible, false);
  assert.equal(rows.find((r) => r.widget_type === 'hero')!.is_visible, true, 'an always-on section is never hidden, not even in a draft');

  // Apply: one free item for a free couple, and nothing for the always-on row.
  const plan = planHubDraftApply(d, LIVE, false);
  const eyes = plan.apply.filter((i) => i.kind === 'widget' && i.field === 'is_visible');
  assert.equal(eyes.length, 1);
  const eye = eyes[0]!;
  assert.ok(eye.kind === 'widget' && eye.widgetType === 'countdown' && eye.value === false);
  assert.equal(eye.pro, false, 'show and hide are the page we write — free');
  assert.equal(plan.refused.length, 0);
  assert.deepEqual(hubDraftWriteTables(plan.apply), ['invitation_widgets']);
});

test('an eye equal to live is not an item, Undo takes a drafted eye back, and a later mode save keeps it', () => {
  const same = mergeHubDraft(emptyHubDraft(), { widgets: { countdown: { is_visible: true } } });
  assert.deepEqual(classifyHubDraft(same, LIVE).items, []);
  const hidden = mergeHubDraft(emptyHubDraft(), { widgets: { countdown: { is_visible: false } } });
  assert.equal(summarizeHubDraft(hidden, LIVE, false).changeCount, 1);
  assert.equal(undoHubDraft(hidden).widgets.countdown, undefined);
  const both = mergeHubDraft(hidden, { widgets: { countdown: { mode: 'hidden' } } });
  assert.equal(both.widgets.countdown?.is_visible, false);
  assert.equal(both.widgets.countdown?.mode, 'hidden');
});

/* ── a template scene's slots and clip (Phase 5) — classified at Apply ─────── */

test('a drafted slot picture or tap-to-play is Pro at Apply; taking it off, the words and the template are free', () => {
  const liveRows = (canvas: Record<string, unknown>): HubLiveState => ({
    events: {},
    widgets: [row({ widget_type: 'custom_1', display_order: 20, config_json: { canvas } })],
  });
  const items = (live: HubLiveState, canvas: Record<string, unknown>, ownsPro: boolean) =>
    planHubDraftApply(mergeHubDraft(emptyHubDraft(), { widgets: { custom_1: { canvas } } }), live, ownsPro);

  const base = { template: 3 };
  // Putting a photo into a slot — refused for a free couple, applied for Pro.
  const up = items(liveRows(base), { template: 3, slots: [{ media: PHOTO }] }, false);
  assert.equal(up.refused.length, 1, 'a slot photo must not reach guests without Pro');
  assert.equal(items(liveRows(base), { template: 3, slots: [{ media: PHOTO }] }, true).refused.length, 0);
  // Swapping it is Pro too; taking it off is free.
  assert.equal(items(liveRows({ template: 3, slots: [{ media: PHOTO }] }), { template: 3, slots: [{ media: OTHER }] }, false).refused.length, 1);
  assert.equal(items(liveRows({ template: 3, slots: [{ media: PHOTO }] }), { template: 3 }, false).refused.length, 0);
  // Tap to play is Pro; back to Loop is free.
  assert.equal(items(liveRows(base), { template: 3, video: { play: 'tap' } }, false).refused.length, 1);
  assert.equal(items(liveRows({ template: 3, video: { play: 'tap' } }), base, false).refused.length, 0);
  // Words in a slot and the template pick are free.
  const words = items(liveRows(base), { template: 7, slots: [{ head: 'How we met', text: 'A rainy Tuesday' }] }, false);
  assert.equal(words.refused.length, 0);
  assert.equal(words.apply.length, 1);
});
