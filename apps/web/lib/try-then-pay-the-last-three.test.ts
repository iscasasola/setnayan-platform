/**
 * try-then-pay-the-last-three.test.ts — 💎 TRY-THEN-PAY REACHES THE LAST THREE
 * PRO TOOLS (owner 2026-09-29, verbatim: *"yes to all 3, do the follow-up"*).
 *
 * The Pro QR look, background music + the hero video, and the couple's own
 * gallery each used to save LIVE and send a couple without Pro to the buy page.
 * Held here, on the real decisions:
 *
 *   1 · each is DRAFTED — the draft keeps it, and the writer takes the draft
 *       door before any Pro question;
 *   2 · the Apply sheet names each one (one source: the same plan), and each
 *       can be taken off the draft;
 *   3 · Apply writes none of them without Pro — and all of them with it; the
 *       QR is MERGED into the live blob (the couple's other keys survive);
 *   4 · an EMPTY scene of their own takes its first words into the draft, and
 *       filling it is Pro at Apply; words it already has stay free;
 *   5 · the Love Story stays "Go to" only on the sheet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  emptyHubDraft,
  mergeHubDraft,
  overlayHubDraftEvent,
  planHubDraftApply,
  type HubLiveState,
} from './hub-draft';
import { hubDraftProEffects, hubProEffectLine } from './hub-pro-effects';
import type { InvitationWidgetRow } from './invitation-widgets';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const E = 'E1';
const ref = (path: string) => `r2://setnayan-media/events/${E}/${path}`;
const SONG = ref('site-music/song.mp3');
const CLIP = ref('landing-page-hero-video/clip.mp4');
const OLD = ref('our-photos/old.jpg');
const NEW = ref('our-photos/new.jpg');

const row = (type: string, id: string, config: unknown = null): InvitationWidgetRow =>
  ({
    widget_id: id,
    event_id: E,
    widget_type: type,
    is_visible: true,
    is_always_on: false,
    display_order: 1,
    mode: 'auto',
    config_json: config,
  }) as unknown as InvitationWidgetRow;

/** Guests see: one old gallery photo, no song, no clip, a plain QR, an empty visible scene, a scene with words. */
const LIVE: HubLiveState = {
  events: {
    our_photos: [OLD],
    site_bg_music_r2_key: null,
    site_bg_music_enabled: false,
    landing_page_hero_video_r2_key: null,
    style_preferences: { interested_categories: ['photo'], qr: {} },
  },
  widgets: [
    row('custom_1', 'W-EMPTY'),
    row('custom_2', 'W-WORDS', { custom: { title: 'Us', body: 'We met in 2019.' } }),
  ],
};

function tried() {
  let d = emptyHubDraft();
  d = mergeHubDraft(d, {
    events: {
      our_photos: [OLD, NEW],
      site_bg_music_r2_key: SONG,
      site_bg_music_enabled: true,
      landing_page_hero_video_r2_key: CLIP,
      style_preferences: { qr: { shape: 'circle', pattern: 'dots' } },
    },
  });
  d = mergeHubDraft(d, {
    widgets: {
      custom_1: { custom: { title: 'Our song', body: 'The first dance.' } },
      custom_2: { custom: { title: 'Us', body: 'We met in 2019, in Manila.' } },
    },
  });
  return d;
}

/* ═══ 1 · DRAFTED ═════════════════════════════════════════════════════════ */

test('1 · the draft keeps all three tools — and only the QR key of the preferences blob', () => {
  const d = tried();
  assert.deepEqual(d.events.our_photos, [OLD, NEW]);
  assert.equal(d.events.site_bg_music_r2_key, SONG);
  assert.equal(d.events.site_bg_music_enabled, true);
  assert.equal(d.events.landing_page_hero_video_r2_key, CLIP);
  assert.deepEqual(d.events.style_preferences, { qr: { shape: 'circle', pattern: 'dots' } });
  // A hand-crafted draft cannot smuggle another key of the blob in.
  const sneaky = mergeHubDraft(emptyHubDraft(), { events: { style_preferences: { qr: { shape: 'circle' }, pending_inquiry_dispatch: 'x' } } });
  assert.deepEqual(sneaky.events.style_preferences, { qr: { shape: 'circle' } });
  // …and the host's canvas keeps the blob's other keys while wearing the drafted QR.
  const over = overlayHubDraftEvent({ style_preferences: LIVE.events.style_preferences } as Record<string, unknown>, d);
  assert.deepEqual(over.style_preferences, { interested_categories: ['photo'], qr: { shape: 'circle', pattern: 'dots' } });
});

test('1 · every writer takes the draft door before any Pro question', () => {
  const chrome = code('app/dashboard/[eventId]/website/site-chrome/actions.ts');
  const door = chrome.indexOf('if (isHubDraftWrite(formData))');
  assert.ok(door > 0 && door < chrome.indexOf('lookProAllows('), 'the music · video draft door must come before the live Pro gate');
  assert.match(chrome.slice(door, door + 900), /return draftEventsAndReturn\(eventId, events, formData,/);

  const photos = code('app/dashboard/[eventId]/website/our-photos/actions.ts');
  assert.match(photos, /const drafting = isHubDraftWrite\(formData\);\s*if \(!drafting\) await requireLookPro\(eventId, galleryChange\(currentRefs, deduped\)\);/);
  // The screen still runs BEFORE the draft door.
  assert.ok(photos.indexOf('classifyImageBytes') < photos.indexOf('draftEventsAndReturn(eventId, { our_photos: cleared }'));

  const qr = code('app/dashboard/[eventId]/launch/qr-look-actions.ts');
  assert.doesNotMatch(qr, /eventCoupleWebsiteProActive|\.update\(/, 'the QR look still asks Pro or writes live');
  assert.match(qr, /saveHubDraftPatch\(eventId, \{ events: \{ style_preferences: \{ \[QR_STYLE_PREF_KEY\]: merged \} \} \}\)/);
  // The controls no longer send a free couple to the buy page on a pick.
  const controls = code('app/dashboard/[eventId]/launch/_components/qr-look-controls.tsx');
  assert.doesNotMatch(controls, /router\.push\(|website-pro/, 'a QR pick still leads away to the buy page');
});

/* ═══ 2 · NAMED ON THE SHEET, ONE SOURCE ══════════════════════════════════ */

test('2 · the Apply sheet names each tool (and the empty scene’s words) — nothing else', () => {
  const lines = hubDraftProEffects(tried(), LIVE, false).map(hubProEffectLine).sort();
  console.log(`[last-three] sheet: ${lines.join(' | ')}`);
  assert.deepEqual(lines, [
    'Background music · Whole Event Hub',
    'Hero video · Hero',
    'QR look · Your QR code',
    'Words · Your own section',
    'Your photos · Photos you add',
  ]);
  assert.deepEqual(hubDraftProEffects(tried(), LIVE, true), [], 'an owning couple is asked to pay');
});

test('2 · each one can be taken off the draft — exactly it', () => {
  let d = tried();
  for (let guard = 0; guard < 10; guard += 1) {
    const next = hubDraftProEffects(d, LIVE, false)[0];
    if (!next) break;
    assert.ok(next.remove, `${hubProEffectLine(next)} cannot be taken off`);
    d = mergeHubDraft(d, next.remove!);
  }
  assert.deepEqual(hubDraftProEffects(d, LIVE, false), []);
  assert.equal(planHubDraftApply(d, LIVE, false).refused.length, 0);
  // The free edit (the words a scene already had) is still in the draft.
  assert.equal(d.widgets.custom_2?.custom?.body, 'We met in 2019, in Manila.');
});

/* ═══ 3 · APPLY WRITES THEM ONLY WITH PRO ═════════════════════════════════ */

test('3 · without Pro Apply holds every one; with Pro it writes every one', () => {
  const pro = new Set(['our_photos', 'site_bg_music_r2_key', 'landing_page_hero_video_r2_key', 'style_preferences']);
  const free = planHubDraftApply(tried(), LIVE, false);
  for (const i of free.apply) {
    if (i.kind === 'event') assert.ok(!pro.has(i.column), `Apply without Pro published ${i.column}`);
    else assert.notEqual(`${i.widgetType}.${i.field}`, 'custom_1.custom', 'Apply without Pro filled an empty scene');
  }
  // Switching the song on is free — but with no song live it plays nothing.
  assert.ok(free.apply.some((i) => i.kind === 'event' && i.column === 'site_bg_music_enabled'));
  assert.ok(free.apply.some((i) => i.kind === 'widget' && i.widgetType === 'custom_2' && i.field === 'custom'), 'editing words a scene has is free');

  const owner = planHubDraftApply(tried(), LIVE, true);
  assert.equal(owner.refused.length, 0);
  for (const c of pro) assert.ok(owner.apply.some((i) => i.kind === 'event' && i.column === c), `Apply with Pro did not write ${c}`);
});

test('3 · the server merges the QR into the live blob, screens new photos, holds a foreign file, and stamps the song', () => {
  const action = code('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(action, /\.update\(\{ style_preferences: \{ \.\.\.\(prefs \?\? \{\}\), \.\.\.qrWrite \} \}\)/, 'the QR is not merged into the live blob');
  assert.match(action, /delete eventsPatch\.style_preferences;/, 'the blob rides the session UPDATE whole');
  assert.match(action, /const blocked = await screenNewPhotoRefs\(fresh\);\s*if \(blocked\.length > 0\) eventsPatch\.our_photos =/);
  assert.match(action, /!newMediaIsOwn\(item\.column, item\.value\)\s*\) \{\s*held\.push\(\{ item, reason: 'not_your_photo' \}\);/);
  assert.match(action, /eventsPatch\.site_bg_music_source = eventsPatch\.site_bg_music_r2_key \? 'upload' : null;/);
  // The Pro gate itself is unchanged.
  assert.match(action, /const ownsPro = storeShell \? false : await lookProAllows\(eventId, 'change'\);/);
});

test('3 · the QR preview draws the draft for a verified host only, never cached', () => {
  const route = code('app/api/website/qr/[slug]/route.ts');
  assert.match(route, /if \(draftAsked && \(await getHostUserId\(event\.event_id\)\.catch\(\(\) => null\)\)\) \{/);
  assert.match(route, /'Cache-Control': preview \? 'private, no-store' :/);
  assert.match(code('app/dashboard/[eventId]/launch/_components/maker-details.tsx'), /\?draft=1&v=/);
});

/* ═══ 4 · AN EMPTY SCENE'S FIRST WORDS ════════════════════════════════════ */

test('4 · an empty scene of their own takes its first words into the draft; filling it is Pro at Apply', () => {
  const d = tried();
  const plan = planHubDraftApply(d, LIVE, false);
  const fill = plan.refused.find((i) => i.kind === 'widget' && i.widgetType === 'custom_1' && i.field === 'custom');
  assert.ok(fill, 'an empty scene filled without Pro is not held');
  assert.deepEqual(plan.remaining.widgets.custom_1?.custom, { title: 'Our song', body: 'The first dance.' }, 'the held words left the draft');
  // The writer drafts words on draft=1, and the Maker sends it for an empty scene without Pro.
  const actions = code('app/dashboard/[eventId]/website/widgets/actions.ts');
  assert.match(actions, /if \(drafting\) return saveWidgetToDraft\(formData, eventId, row\.widget_type, \{ custom: input\.value \}\);/);
  assert.match(actions, /const triedInTheDraft = draftingHere && \(CANVAS_INTENTS_DRAFTED\.has\(intent\) \|\| intent === 'save'\);/);
  const panel = code('app/dashboard/[eventId]/website/editor/_components/sections-panel.tsx');
  assert.match(panel, /const wordsDrafted = !ownsPro && proUsable && emptyLive\.includes\(row\.widget_id\);/);
  assert.match(panel, /\{wordsDrafted \? <HubDraftField \/> : <HubSavesImmediately \/>\}/);
  assert.match(code('app/dashboard/[eventId]/website/editor/page.tsx'), /\.filter\(\(w\) => isCustomSectionType\(w\.widget_type\) && !customSectionHasContent\(w\.config_json\)\)/);
});

/* ═══ 5 · THE LOVE STORY STAYS "GO TO" ONLY ═══════════════════════════════ */

test('5 · a Love Story on the sheet is "Go to" only — never removed from there', () => {
  const moments = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, line: `Moment ${i + 1}` }));
  const d = mergeHubDraft(emptyHubDraft(), { events: { love_story: { moments } } });
  const [story] = hubDraftProEffects(d, LIVE, false);
  assert.ok(story);
  assert.equal(story!.remove, null);
  assert.deepEqual(story!.jump, { kind: 'tool', key: 'love-story' });
});
