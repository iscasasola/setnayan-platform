/**
 * try-pro-pay-at-apply.test.ts — 💎 A FREE COUPLE MAY USE EVERY PRO FEATURE IN THE
 * MAKER; PRO IS ASKED FOR AT APPLY, NAMING THE EFFECTS THAT NEED IT.
 *
 * Owner, 2026-09-28, verbatim (on the Animate tab's lock panel): *"they can edit
 * it with pro features. but need to upgrade to pro when clicked on apply and
 * point out the effect chosen that caused them to upgrade to pro"*.
 *
 * Held here, on the REAL decisions (never a copy of them):
 *
 *   1 · a free couple's DRAFT keeps every Pro pick — the one draft door
 *       (`mergeHubDraft`, `hubDraftAction` save) strips nothing;
 *   2 · Apply for a free couple never publishes a Pro effect — every item the
 *       plan writes is free, however the draft was built; and the server's
 *       Apply still asks the one live gate;
 *   3 · the Apply sheet lists EXACTLY the Pro effects the draft holds, by name
 *       and place, derived from the one Pro decision (`planHubDraftApply` →
 *       `canvasLookFacets`) — nothing extra, nothing missing, nothing for an
 *       owning couple;
 *   4 · removing one from the sheet removes it — and only it — from the draft,
 *       and the server recomputes the list before it writes (`drop`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  canvasLookChange,
  emptyHubDraft,
  mergeHubDraft,
  planHubDraftApply,
  type HubDraft,
  type HubLiveState,
} from './hub-draft';
import { hubDraftProEffects, hubProEffectLine, unlockAndApplyHref, unlockAndApplyOnReturn } from './hub-pro-effects';
import { lookWriteAllowed } from './hub-look-pro';
import type { InvitationWidgetRow } from './invitation-widgets';
import type { HubSectionCanvas } from './hub-canvas';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PHOTO = 'r2://setnayan-media/events/E1/our-photos/a.jpg';

const widget = (type: string, id: string, extra: Partial<InvitationWidgetRow> = {}): InvitationWidgetRow =>
  ({
    widget_id: id,
    event_id: 'E1',
    widget_type: type,
    is_visible: true,
    is_always_on: type === 'hero',
    display_order: 1,
    mode: 'auto',
    config_json: null,
    ...extra,
  }) as unknown as InvitationWidgetRow;

/** Guests see: a plain page, a scene of their own just added (hidden live). */
const LIVE: HubLiveState = {
  events: { invite_theme: 'house', site_font_key: null, site_bg_color: '#f5efe6' },
  widgets: [
    widget('hero', 'W-HERO'),
    widget('schedule', 'W-SCHED'),
    widget('countdown', 'W-COUNT'),
    widget('custom_1', 'W-OWN', { is_visible: false }),
  ],
};

/** Everything a free couple might try in one sitting — Pro AND free, mixed. */
function triedDraft(): HubDraft {
  let d = emptyHubDraft();
  // Pro: a theme, the Event Hub typeface. Free: the background colour.
  d = mergeHubDraft(d, { events: { invite_theme: 'velvet', site_font_key: 'cormorant', site_bg_color: '#112233' } });
  // Pro: a font on the hero's names — beside a FREE colour on the same part.
  d = mergeHubDraft(d, {
    widgets: { hero: { canvas: { elements: { names: { font: 'cormorant', color: '#aa3344' } } } as HubSectionCanvas } },
  });
  // Pro: how the Schedule moves (a preset + a hand-over into the next scene).
  d = mergeHubDraft(d, { widgets: { schedule: { canvas: { preset: 'cinematic', transition: 'scrub' } as HubSectionCanvas } } });
  // Pro: a photo behind the Countdown.
  d = mergeHubDraft(d, { widgets: { countdown: { canvas: { kind: 'photo', media: PHOTO } as HubSectionCanvas } } });
  // Pro: a scene of their own, added from a template and shown (owner, via the
  // controller: *"they can Add. only pay when apply is tirggered"*).
  d = mergeHubDraft(d, {
    widgets: { custom_1: { mode: 'auto', is_visible: true, canvas: { template: 1 } as HubSectionCanvas } },
  });
  return d;
}

/* ═══ 1 · THE DRAFT KEEPS EVERY PRO PICK ═══════════════════════════════════ */

test('1 · a free couple’s draft keeps every Pro pick (the draft door strips nothing)', () => {
  const d = triedDraft();
  assert.equal(d.events.invite_theme, 'velvet', 'the Pro theme was dropped from the draft');
  assert.equal(d.events.site_font_key, 'cormorant', 'the typeface was dropped from the draft');
  assert.equal(d.widgets.hero?.canvas?.elements?.names?.font, 'cormorant', 'the part’s font was dropped');
  assert.equal(d.widgets.schedule?.canvas?.preset, 'cinematic', 'the motion was dropped');
  assert.equal(d.widgets.countdown?.canvas?.media, PHOTO, 'the photo background was dropped');
  assert.equal(d.widgets.custom_1?.is_visible, true);

  // The server's `save` is that merge and nothing else — no Pro read on the way in.
  const action = code('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  const save = action.slice(action.indexOf("if (intent === 'save')"), action.indexOf("if (intent === 'reset')"));
  assert.match(save, /writeHubDraft\(supabase, eventId, mergeHubDraft\(current, patch\)\)/);
  assert.doesNotMatch(save, /lookProAllows|eventCoupleWebsiteProActive|planHubDraftApply/, 'the draft save asks Pro');

  // …and "+ Add a scene" in the Maker is not refused at the door any more.
  const widgets = code('app/dashboard/[eventId]/website/widgets/actions.ts');
  assert.match(widgets, /refuseCustomSectionWithoutPro\(eventId, \{\s*intent: 'add',\s*ownsPro: ownsPro \|\| drafting,/);
});

/* ═══ 2 · APPLY NEVER PUBLISHES A PRO EFFECT FOR A FREE COUPLE ═════════════ */

test('2 · Apply for a free couple writes only free changes — every Pro effect is held', () => {
  const plan = planHubDraftApply(triedDraft(), LIVE, false);
  assert.ok(plan.apply.length > 0 && plan.refused.length > 0, 'anti-vacuity: the draft mixes free and Pro');
  for (const item of plan.apply) {
    if (item.kind === 'event') {
      assert.equal(item.pro, false, `Apply published the Pro column ${item.column}`);
      continue;
    }
    if (item.kind === 'editorial') {
      assert.equal(item.pro, false, `Apply published a Pro Post Event look (${item.item.field})`);
      continue;
    }
    if (item.kind === 'fixed-style') {
      assert.equal(item.pro, false, 'a fixed part\'s Style pick is free');
      continue;
    }
    if (item.field === 'canvas') {
      const row = LIVE.widgets.find((w) => w.widget_id === item.widgetId)!;
      const live = ((row.config_json as { canvas?: HubSectionCanvas } | null)?.canvas ?? {}) as HubSectionCanvas;
      const change = canvasLookChange(live, (item.value as HubSectionCanvas) ?? {});
      assert.ok(lookWriteAllowed(false, change), `Apply published a Pro look on ${item.widgetType}`);
    } else {
      assert.ok(lookWriteAllowed(false, item.change) || !item.pro, `Apply published ${item.widgetType}.${item.field}`);
      assert.ok(!(item.widgetType === 'custom_1' && item.field === 'is_visible' && item.value === true), 'a scene of their own went live');
    }
  }
  // The free colour on the SAME part as the Pro font still goes live (#6075's split).
  const hero = plan.apply.find((i) => i.kind === 'widget' && i.widgetType === 'hero' && i.field === 'canvas');
  assert.ok(hero, 'the free half of the hero canvas is not applied');
  const names = (hero!.value as HubSectionCanvas).elements?.names;
  assert.equal(names?.color, '#aa3344', 'the free colour was held with the Pro font');
  assert.equal(names?.font, undefined, 'the Pro font leaked through the free half');
  // The background colour is free and goes live.
  assert.ok(plan.apply.some((i) => i.kind === 'event' && i.column === 'site_bg_color'));

  // The server's Apply still asks the one live gate, fail-closed in the shell.
  const action = code('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(action, /const ownsPro = storeShell \? false : await lookProAllows\(eventId, 'change'\);/);
  assert.match(action, /const plan = planHubDraftApply\(current, live, ownsPro\);/);
  // …and a held scene of their own stays SHOWN in the draft after Apply.
  assert.match(action, /else if \(item\.field === 'is_visible'\) \{\s*\(remaining\.widgets\[item\.widgetType\] \?\?= \{\}\)\.is_visible = item\.value as boolean;/);
});

/* ═══ 3 · THE SHEET NAMES EXACTLY WHAT IS HELD ════════════════════════════ */

test('3 · the Apply sheet lists exactly the Pro effects the draft holds — by name and place', () => {
  const effects = hubDraftProEffects(triedDraft(), LIVE, false);
  const lines = effects.map(hubProEffectLine);
  console.log(`[try-pro] sheet: ${lines.join(' | ')}`);
  assert.deepEqual(lines.sort(), [
    'Added scene · Photo left, words right',
    'Animation · Schedule',
    'Font · Names on the Hero',
    'Photo background · Countdown',
    'Theme · Luxe',
    'Transition · Schedule',
    'Typeface · Whole Event Hub',
  ]);
  // Never a free change: the background colour and the part's colour are not named.
  assert.ok(!lines.some((l) => /colour|color/i.test(l)), 'a free colour is named as Pro');
  // Each row can be taken to, and (except a Love Story) taken off.
  for (const e of effects) {
    assert.ok(e.jump, `${hubProEffectLine(e)} cannot be jumped to`);
    assert.ok(e.remove, `${hubProEffectLine(e)} cannot be removed`);
  }
  const font = effects.find((e) => e.what === 'Font')!;
  assert.deepEqual(font.jump, {
    kind: 'scene',
    widgetId: 'W-HERO',
    widgetType: 'hero',
    tab: 'format',
    element: 'names',
    stages: font.jump && font.jump.kind === 'scene' ? font.jump.stages : [],
    fixed: 'hero',
  });
});

test('3 · one source: no Pro effect named for an owning couple, and none once the plan refuses nothing', () => {
  assert.deepEqual(hubDraftProEffects(triedDraft(), LIVE, true), [], 'an owning couple is asked to pay');
  // A draft of only free changes → nothing refused → nothing named.
  const free = mergeHubDraft(emptyHubDraft(), { events: { site_bg_color: '#112233' } });
  assert.equal(planHubDraftApply(free, LIVE, false).refused.length, 0);
  assert.deepEqual(hubDraftProEffects(free, LIVE, false), []);
  // Whatever the plan refuses, the sheet names — item for item, widget by widget.
  const plan = planHubDraftApply(triedDraft(), LIVE, false);
  const effects = hubDraftProEffects(triedDraft(), LIVE, false);
  for (const item of plan.refused) {
    if (item.kind === 'fixed-style') continue; // free — never refused
    const key = item.kind === 'event' ? `event:${item.column}` : item.kind === 'editorial' ? 'pe:' : item.widgetType;
    assert.ok(
      effects.some((e) =>
        item.kind === 'event' ? e.id === key : item.kind === 'editorial' ? e.id.startsWith(key) : e.id.includes(`:${key}`) || e.id === `show:${key}`,
      ),
      `the plan holds ${key} but the sheet does not name it`,
    );
  }
});

/* ═══ 4 · REMOVING ONE REMOVES IT — AND ONLY IT ═══════════════════════════ */

test('4 · removing one effect from the sheet takes exactly it off the draft', () => {
  const d = triedDraft();
  const before = hubDraftProEffects(d, LIVE, false);
  const target = before.find((e) => e.what === 'Animation' && e.where === 'Schedule')!;
  const after = mergeHubDraft(d, target.remove!);
  const lines = hubDraftProEffects(after, LIVE, false).map(hubProEffectLine);
  assert.ok(!lines.includes('Animation · Schedule'), 'the removed effect is still named');
  assert.ok(lines.includes('Transition · Schedule'), 'removing the animation also took the transition');
  assert.equal(lines.length, before.length - 1);
  assert.equal(after.widgets.schedule?.canvas?.transition, 'scrub', 'a sibling Pro key on the same scene was lost');
  assert.equal(after.widgets.schedule?.canvas?.preset, undefined, 'the preset is still drafted');

  // Taking every one off leaves a draft the plan refuses nothing of — with the
  // free changes (the colours) still in it.
  // One at a time, each recomputed from the draft as it now stands — exactly as
  // the server's `drop` does (a patch computed before a sibling removal would
  // put that sibling back: the canvas is replaced whole).
  let clean = d;
  for (let guard = 0; guard < 20; guard += 1) {
    const next = hubDraftProEffects(clean, LIVE, false)[0];
    if (!next) break;
    clean = mergeHubDraft(clean, next.remove!);
  }
  assert.deepEqual(hubDraftProEffects(clean, LIVE, false), []);
  assert.equal(planHubDraftApply(clean, LIVE, false).refused.length, 0);
  assert.equal(clean.events.site_bg_color, '#112233', 'a free colour was removed with the Pro effects');
  assert.equal(clean.widgets.hero?.canvas?.elements?.names?.color, '#aa3344', 'the part’s free colour was removed');
  // Undo can take a removal back (every drop is one merge on the history).
  assert.ok(clean.history.length > d.history.length);
});

test('4 · the server’s drop recomputes the list from the STORED draft — only an id crosses', () => {
  const action = code('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  const drop = action.slice(action.indexOf("if (intent === 'drop')"), action.indexOf('const live = await readHubLiveState(supabase, eventId);\n    const storeShell'));
  assert.match(drop, /const id = formData\.get\('effect'\);/);
  assert.match(drop, /hubDraftProEffects\(current, live, false\)\.find\(\(e\) => e\.id === id\)/);
  assert.match(drop, /writeHubDraft\(supabase, eventId, mergeHubDraft\(current, effect\.remove\)\)/);
  assert.doesNotMatch(drop, /formData\.get\('patch'\)/, 'a drop took a patch from the client');
  // The sheet sends only the id.
  const bar = code('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(bar, /onRemove=\{\(e\) => run\(\{ intent: 'drop', effect: e\.id \}\)\}/);
});

/* ═══ THE BAR READS THE SAME PLAN, AND THE SHELL GETS NO SHEET ═════════════ */

test('the bar’s list comes from the one plan, as the viewer is shown it — and is empty in the store shell', () => {
  const store = code('lib/hub-draft-store.ts');
  const load = store.slice(store.indexOf('export const loadHubDraftBarData'));
  assert.match(load, /summary = summarizeHubDraft\(draft, live, ownsPro && !storeShell\);\s*if \(!storeShell\) proEffects = hubDraftProEffects\(draft, live, ownsPro\)\.map\(hubProEffectView\);/);
  const bar = code('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(bar, /const asksForPro = !storeShell && proHref !== null && proEffects\.length > 0;/);
  assert.match(bar, /onClick=\{\(\) => \(asksForPro \? setSheetOpen\(true\) : act\(\{ intent: 'apply' \}\)\)\}/);
  // The price is the catalogue's, never typed.
  const sheet = code('app/dashboard/[eventId]/website/_components/apply-pro-sheet.tsx');
  assert.match(sheet, /Unlock Pro and Apply\{priceLabel \? ` · \$\{priceLabel\}` : ''\}/);
  assert.doesNotMatch(sheet, /₱\s?\d/, 'a price is typed into the sheet');
});

/* ═══ THE LOVE STORY AND THE THEME ARE TRIED THE SAME WAY ═════════════════ */

test('a Love Story past the free cap is tried in the draft, named on the sheet, and never taken off from there', () => {
  const moments = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, line: `Moment ${i + 1}` }));
  const d = mergeHubDraft(emptyHubDraft(), { events: { love_story: { moments } } });
  assert.equal(((d.events.love_story as { moments?: unknown[] })?.moments ?? []).length, 6, 'the draft capped the story');
  const [story] = hubDraftProEffects(d, LIVE, false);
  assert.ok(story, 'a sixth story is not named as Pro');
  assert.equal(hubProEffectLine(story!), 'Photos or chapters · Love Story');
  assert.equal(story!.remove, null, 'removing the story from the sheet would throw its words away');
  assert.deepEqual(story!.jump, { kind: 'tool', key: 'love-story' });
  // The moment action does not refuse the draft; the live write is capped as before.
  const action = code('app/dashboard/[eventId]/website/our-story/actions.ts');
  assert.match(action, /const ownsPro = drafting \|\| \(await eventCoupleWebsiteProActive\(supabase, eventId\)\);\s*const refusal = momentCapRefusal\(\{ before, after, ownsPro \}\);/);
});

test('a drafted Pro theme is worn on the verified host’s canvas — never on a guest’s', () => {
  const page = code('app/[slug]/page.tsx');
  assert.match(page, /const triesDraftedTheme = hostDraft !== null && 'invite_theme' in hostDraft\.events;/);
  assert.match(page, /: triesDraftedTheme\s*\?\s*\{ \.\.\.draftedEvent, theme_try_on: true \}\s*: draftedEvent;/);
});

/* ═══ "UNLOCK PRO AND APPLY" — ONE TAP, BOTH THINGS ═══════════════════════ */

test('Unlock Pro and Apply · back WITH Pro → the draft is applied, every effect with it (no second tap)', () => {
  const d = triedDraft();
  // Pro is now active: the bar measures it, so it names no Pro effect…
  const effects = hubDraftProEffects(d, LIVE, true);
  assert.deepEqual(effects, []);
  const next = unlockAndApplyOnReturn({ asked: true, proEffects: effects.length, hasChanges: true, storeShell: false });
  assert.equal(next, 'apply', 'back with Pro, the Maker did not apply');
  // …and the Apply it presses writes every change, Pro effects included.
  const plan = planHubDraftApply(d, LIVE, true);
  assert.equal(plan.refused.length, 0, 'Apply with Pro still held something');
  assert.ok(plan.apply.some((i) => i.kind === 'event' && i.column === 'invite_theme'), 'the theme did not go live');
  // The toolbar presses the one Apply — the same intent the button sends.
  const bar = code('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(bar, /if \(next === 'apply'\) act\(\{ intent: 'apply' \}\);\s*else if \(next === 'sheet'\) setSheetOpen\(true\);/);
  // Once, even though the toolbar is mounted twice: the param comes off first.
  const effect = bar.slice(bar.indexOf('url.searchParams.get(UNLOCK_AND_APPLY_PARAM)'), bar.indexOf("if (next === 'apply')"));
  assert.ok(effect.indexOf('window.history.replaceState') < effect.indexOf('unlockAndApplyOnReturn('), 'the param must come off before it acts');
});

test('Unlock Pro and Apply · back WITHOUT Pro (cancelled / under review) → the sheet again, nothing applied, draft intact', () => {
  const d = triedDraft();
  const effects = hubDraftProEffects(d, LIVE, false);
  const next = unlockAndApplyOnReturn({ asked: true, proEffects: effects.length, hasChanges: true, storeShell: false });
  assert.equal(next, 'sheet', 'back without Pro, the Maker applied anyway');
  // Nothing about the return writes: the draft is the draft it was.
  assert.equal(d.events.invite_theme, 'velvet');
  // Never on a normal visit, never in the shell, never with nothing to apply.
  assert.equal(unlockAndApplyOnReturn({ asked: false, proEffects: 0, hasChanges: true, storeShell: false }), 'none');
  assert.equal(unlockAndApplyOnReturn({ asked: true, proEffects: 0, hasChanges: true, storeShell: true }), 'none');
  assert.equal(unlockAndApplyOnReturn({ asked: true, proEffects: 0, hasChanges: false, storeShell: false }), 'none');
});

test('Unlock Pro and Apply · the button goes through the ONE purchase page and asks it to come back', () => {
  assert.equal(unlockAndApplyHref('/dashboard/E/studio/website-pro?from=maker'), '/dashboard/E/studio/website-pro?from=maker&then=apply');
  const sheet = code('app/dashboard/[eventId]/website/_components/apply-pro-sheet.tsx');
  assert.match(sheet, /href=\{unlockAndApplyHref\(proHref\)\}/);
  const buy = code('app/dashboard/[eventId]/studio/website-pro/page.tsx');
  assert.match(buy, /search\.then === 'apply' \? `\?\$\{UNLOCK_AND_APPLY_PARAM\}=1` : ''/, 'the purchase page does not come back to finish the Apply');
});
