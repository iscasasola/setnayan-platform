/**
 * maker-live-savers-draft.test.ts — THE MAKER'S LIVE SAVERS NOW SAVE TO THE DRAFT.
 *
 * Owner, 2026-09-25: he edits his own PUBLIC Event Hub in the Maker, and every
 * "Saves immediately ⓘ" there was a half-finished edit a guest could read. The
 * Colors panel, the Text panels, Our story, the Love Story moments, Dress code
 * and Camera cues now divert to `event_site_drafts` on `draft=1`.
 *
 * Proven two ways, both in `lib/` (the node glob misses `[eventId]` folders):
 *
 *   1. THE PATH, on the source — each writer's draft door (`draftEventsAndReturn`
 *      / `saveHubDraftPatch`) sits BEFORE its first live `.update(` and the door
 *      redirects/returns, so a draft save never reaches the live row. And Apply
 *      writes every drafted `events` column through ONE generic UPDATE.
 *   2. THE VALUES, on the pure rules — a saved patch lands in the draft, the
 *      live row the guest loader holds is untouched (and the host's overlay
 *      shows the draft), and Apply's plan then copies the drafted value over —
 *      with the Pro half refused for a free couple and applied for an owning one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import {
  HUB_DRAFT_EVENT_COLUMNS,
  HUB_DRAFT_LOOK_COLUMNS,
  HUB_DRAFT_WORDS_COLUMNS,
  emptyHubDraft,
  mergeHubDraft,
  overlayHubDraftEvent,
  planHubDraftApply,
  sanitizeHubDraft,
  undoHubDraft,
  type HubLiveState,
} from './hub-draft';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** One function's text, up to the next top-level function. */
function fn(src: string, name: string): string {
  const start = src.search(new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`, 'm'));
  assert.ok(start >= 0, `function ${name} not found`);
  const rest = src.slice(start + 1);
  const next = rest.search(/^(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/m);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

const W = 'app/dashboard/[eventId]/website/';

/* ── 1 · THE PATH ─────────────────────────────────────────────────────────── */

const WRITERS: Array<[file: string, name: string, door: RegExp, columns: string[]]> = [
  [`${W}colors/actions.ts`, 'updateSiteColors', /draftEventsAndReturn\(/, ['site_bg_color', 'site_button_color', 'site_art_direction', 'site_font_key', 'site_magic_traveller']],
  [`${W}special-message/actions.ts`, 'updateSpecialMessage', /draftEventsAndReturn\(/, ['special_message']],
  [`${W}what-to-bring/actions.ts`, 'updateWhatToBring', /draftEventsAndReturn\(/, ['what_to_bring']],
  [`${W}our-story/actions.ts`, 'updateOurStory', /draftEventsAndReturn\(/, ['love_story', 'together_since']],
  [`${W}our-story/actions.ts`, 'loveStoryMomentAction', /draftEventsAndReturn\(/, ['love_story']],
  [`${W}dress-code/actions.ts`, 'updateDressCode', /draftEventsAndReturn\(/, ['dress_code_config']],
  [`${W}photo-moments/actions.ts`, 'updatePhotoMoments', /saveHubDraftPatch\(/, ['photo_moments_config']],
];

test('each moved writer saves to the draft BEFORE its live write, and the draft path never reaches it', () => {
  for (const [file, name, door, columns] of WRITERS) {
    const body = fn(read(file), name);
    const gate = body.search(/isHubDraftWrite\(formData\)/);
    const d = body.search(door);
    const live = body.search(/\.update\s*\(/);
    console.log(`[live-savers] ${name}: gate@${gate} door@${d} live@${live}`);
    assert.ok(gate > 0, `${name} must decide by the form's draft field`);
    assert.ok(d > gate, `${name} has no draft door after its draft decision`);
    assert.ok(live > d, `${name} writes live before it can divert to the draft`);
    // Every column the live write names is a column the draft can hold.
    for (const c of columns) {
      assert.ok((HUB_DRAFT_EVENT_COLUMNS as readonly string[]).includes(c), `${c} is not draftable`);
      assert.match(body.slice(d, live), new RegExp(`\\b${c}\\b`), `${name}'s door does not carry ${c}`);
    }
  }
});

test('the doors leave before the live write: the redirecting door returns never; the returning one returns', () => {
  const store = read('lib/hub-draft-store.ts');
  assert.match(fn(store, 'draftEventsAndReturn'), /Promise<never>[\s\S]*redirect\(resolveReturnTo\(formData, fallback\)\)/);
  const photo = fn(read(`${W}photo-moments/actions.ts`), 'updatePhotoMoments');
  const door = photo.slice(photo.search(/if \(isHubDraftWrite\(formData\)\)/), photo.search(/\.update\s*\(/));
  assert.match(door, /saveHubDraftPatch\([\s\S]*return \{ ok: true \};\s*\}\s*const \{ error \} = await supabase/, 'the Camera cues door must return before the live write');
});

test('a Pro colour is tried in the draft: updateSiteColors leaves for the draft BEFORE its Pro gate', () => {
  const body = fn(read(`${W}colors/actions.ts`), 'updateSiteColors');
  const door = body.search(/if \(isHubDraftWrite\(formData\)\) await draftEventsAndReturn\(/);
  const gate = body.search(/requireLookPro\(/);
  assert.ok(door > 0 && gate > door, 'the draft door must come before requireLookPro — Pro is asked at Apply');
});

test('a Love Story moment keeps its cap and photo screen on the draft path, built on the DRAFTED moments', () => {
  const body = fn(read(`${W}our-story/actions.ts`), 'loveStoryMomentAction');
  const base = body.search(/draftedEventColumn\(eventId, 'love_story'\)/);
  const cap = body.search(/momentCapRefusal\(/);
  const screen = body.search(/screenNewPhotoRefs\(/);
  const door = body.search(/draftEventsAndReturn\(/);
  assert.ok(base > 0 && cap > base && screen > cap && door > screen, 'draft base → cap → screen → door, in that order');
});

test('Apply re-screens a drafted Love Story\'s NEW photos before the live write', () => {
  const body = fn(read(`${W}hub-draft-actions.ts`), 'hubDraftAction');
  const screen = body.search(/screenNewPhotoRefs\(fresh\)/);
  const write = body.search(/\.from\('events'\)\s*\.update\(eventsPatch\)/);
  assert.ok(screen > 0 && write > screen, 'the screen must run before the events UPDATE');
});

test('the Maker panels post the draft field (and the scrapbook, and the Details special message)', () => {
  const C = `${W}editor/_components/`;
  const cases: Array<[string, RegExp]> = [
    [`${C}pro-panels.tsx`, /export function ColorsPanel[\s\S]*?<form action=\{action\}[^>]*>[\s\S]*?<HubDraftField \/>/],
    [`${C}text-panel.tsx`, /<form action=\{action\}[^>]*>[\s\S]*?<HubDraftField \/>/],
    [`${C}authoring-panels.tsx`, /export function StoryPanel[\s\S]*?<HubDraftField \/>/],
    [`${C}authoring-panels.tsx`, /export function DressCodePanel[\s\S]*?<HubDraftField \/>/],
    [`${C}authoring-panels.tsx`, /<PhotoMomentsEditor eventId=\{eventId\} initial=\{initial\} draft \/>/],
    [`${C}media-panels.tsx`, /export function HeroPhotoPanel[\s\S]*?<HubDraftField \/>[\s\S]*?export function GalleryPanel/],
    [`${W}photo-moments/_components/photo-moments-editor.tsx`, /if \(draft\) formData\.set\(HUB_DRAFT_FIELD, '1'\)/],
    ['app/dashboard/[eventId]/launch/_components/maker-details.tsx', /data-details-special=""[^>]*>\s*<HubDraftField \/>/],
  ];
  for (const [file, re] of cases) assert.match(read(file), re, `${file}: ${re}`);
  for (const f of ['page.tsx', '_components/love-story-book.tsx', '_components/moment-sheet.tsx', '_components/pick-from-our-events.tsx']) {
    const src = read(`${W}our-story/${f}`);
    assert.doesNotMatch(src, /HubSavesImmediately/, `${f} still says it saves immediately`);
    assert.match(src, /<HubDraftField \/>/, `${f} does not post the draft field`);
  }
});

test("the host's canvas wears the drafted colours; a guest's render never builds that look", () => {
  const page = read('app/[slug]/page.tsx');
  const at = page.indexOf('const draftLook =');
  assert.ok(at > 0, 'the page must resolve the drafted look');
  const draftRead = page.indexOf('loadHostPreviewDraft(admin');
  assert.ok(draftRead > 0 && draftRead < at, 'the look is built after the host-only draft read');
  assert.match(page.slice(at, at + 300), /hostDraft && HUB_DRAFT_LOOK_COLUMNS\.some/, 'only a host draft builds it');
  // Through the ONE theme gate, like `loadGuestLook` (every-guest-page-wears-the-theme #5):
  // a drafted look never paints a Pro theme the gate would not.
  assert.match(
    page.slice(at, at + 400),
    /await resolveHubTheme\(event\)\s*\.then\(\(hub\) => guestLookFrom\(event, hub, true\)\)/,
    'the host draft look must resolve its theme through resolveHubTheme',
  );
  const wraps = [...page.matchAll(/return wearDraft\(|renderAnonymous = \(reason: AnonymousReason\) => wearDraft\(/g)].length;
  console.log(`[live-savers] InvitationBody renders wrapped in wearDraft: ${wraps}`);
  assert.equal(wraps, 3, 'the anonymous view, the ?as= preview and the guest view are all wrapped');
  // The layout and the canvas dress the page through ONE translation.
  assert.match(read('app/[slug]/layout.tsx'), /<GuestLookScope \{\.\.\.lookScopeProps\(look\)\}>/);
  assert.match(read('app/[slug]/_components/host-draft-look.tsx'), /<GuestLookScope \{\.\.\.lookScopeProps\(look\)\}>/);
});

/* ── 2 · THE VALUES ───────────────────────────────────────────────────────── */

const LIVE_ROW = {
  event_id: 'e1',
  site_bg_color: '#ffffff',
  site_button_color: null,
  site_art_direction: null,
  site_font_key: null,
  site_magic_traveller: null,
  special_message: 'See you there',
  what_to_bring: null,
  love_story: { how_we_met: 'At school', moments: [{ id: 'm1', date: { y: 2015 }, line: 'We met', canvas: {} }] },
  together_since: '2015',
  dress_code_config: null,
  photo_moments_config: null,
};

const live = (): HubLiveState => ({
  events: Object.fromEntries(
    HUB_DRAFT_EVENT_COLUMNS.map((c) => [c, (LIVE_ROW as Record<string, unknown>)[c] ?? null]),
  ) as HubLiveState['events'],
  widgets: [],
});

test('ColorsPanel: a save goes to the draft, the live row is unchanged, the host sees it, Apply copies it', () => {
  const liveRow = structuredClone(LIVE_ROW);
  const d = mergeHubDraft(emptyHubDraft(), {
    events: { site_bg_color: '#1A2B3C', site_button_color: '#aa0000', site_font_key: 'not-a-face' },
  });
  // Sanitised through the writer's own parses: hex lower-cased, an unknown face dropped.
  assert.deepEqual(d.events, { site_bg_color: '#1a2b3c', site_button_color: '#aa0000' });
  // The live row is untouched; the host's overlay shows the draft.
  assert.deepEqual(liveRow, LIVE_ROW);
  const host = overlayHubDraftEvent(liveRow as Record<string, unknown>, d);
  assert.equal(host.site_bg_color, '#1a2b3c');
  assert.equal(liveRow.site_bg_color, '#ffffff', 'the overlay must never mutate the shared live row');

  // Apply — a free couple: the background (free) is applied; the button (Pro) is held.
  const free = planHubDraftApply(d, live(), false);
  assert.deepEqual(free.apply.map((i) => i.kind === 'event' && [i.column, i.value]), [['site_bg_color', '#1a2b3c']]);
  assert.deepEqual(free.refused.map((i) => i.kind === 'event' && i.column), ['site_button_color']);
  assert.deepEqual(free.remaining.events, { site_button_color: '#aa0000' }, 'a refused Pro colour stays in the draft');
  // An owning couple: both are applied.
  const pro = planHubDraftApply(d, live(), true);
  assert.equal(pro.refused.length, 0);
  assert.deepEqual(pro.apply.map((i) => i.kind === 'event' && i.column).sort(), ['site_bg_color', 'site_button_color']);
});

test('ColorsPanel: Candlelight is Pro to turn on and free to turn off; Daylight over nothing is no change', () => {
  const on = planHubDraftApply(mergeHubDraft(emptyHubDraft(), { events: { site_art_direction: 'candlelight' } }), live(), false);
  assert.equal(on.refused.length, 1);
  const lit: HubLiveState = { ...live(), events: { ...live().events, site_art_direction: 'candlelight' } };
  const off = planHubDraftApply(mergeHubDraft(emptyHubDraft(), { events: { site_art_direction: 'daylight' } }), lit, false);
  assert.equal(off.refused.length, 0);
  assert.equal(off.apply.length, 1);
  const same = planHubDraftApply(mergeHubDraft(emptyHubDraft(), { events: { site_art_direction: 'daylight' } }), live(), false);
  assert.equal(same.apply.length + same.refused.length, 0);
});

test('TextPanel: the words go to the draft, live stays, Apply copies them — never Pro', () => {
  const d = mergeHubDraft(emptyHubDraft(), { events: { special_message: '  A new note  ', what_to_bring: '' } });
  assert.deepEqual(d.events, { special_message: 'A new note', what_to_bring: null }, 'trimmed; empty clears');
  assert.equal(overlayHubDraftEvent(LIVE_ROW as Record<string, unknown>, d).special_message, 'A new note');
  assert.equal(LIVE_ROW.special_message, 'See you there');
  const plan = planHubDraftApply(d, live(), false);
  assert.equal(plan.refused.length, 0, 'words are never Pro');
  // what_to_bring: '' → null over a live null is no change, so only the message is written.
  assert.deepEqual(plan.apply.map((i) => i.kind === 'event' && [i.column, i.value]), [['special_message', 'A new note']]);
  // A text over the writer's cap is cut to it, as the writer cuts it.
  const long = mergeHubDraft(emptyHubDraft(), { events: { special_message: 'x'.repeat(900) } });
  assert.equal((long.events.special_message as string).length, 600);
});

test('StoryPanel + Love Story moments: drafted words apply free; a new moment photo is Pro; Undo walks back', () => {
  const words = {
    ...LIVE_ROW.love_story,
    how_we_met: 'At a friend’s wedding',
  };
  let d = mergeHubDraft(emptyHubDraft(), { events: { love_story: words, together_since: '2014' } });
  assert.equal(overlayHubDraftEvent(LIVE_ROW as Record<string, unknown>, d).together_since, '2014');
  assert.equal(LIVE_ROW.love_story.how_we_met, 'At school', 'the live story is untouched by a draft save');
  const plan = planHubDraftApply(d, live(), false);
  assert.equal(plan.refused.length, 0, 'the couple’s own words are free');
  assert.deepEqual(plan.apply.map((i) => i.kind === 'event' && i.column).sort(), ['love_story', 'together_since']);

  // A moment with a photo the live story never held — Pro (`momentCapRefusal`).
  const withPhoto = {
    ...words,
    moments: [
      ...LIVE_ROW.love_story.moments,
      { id: 'm2', date: { y: 2019 }, line: 'The yes', media: ['r2://setnayan-media/events/e1/love/yes.jpg'], canvas: {} },
    ],
  };
  d = mergeHubDraft(d, { events: { love_story: withPhoto } });
  const held = planHubDraftApply(d, live(), false);
  assert.deepEqual(held.refused.map((i) => i.kind === 'event' && i.column), ['love_story']);
  assert.equal(planHubDraftApply(d, live(), true).refused.length, 0, 'an owning couple applies it');
  // Undo takes the photo moment back out of the draft.
  const back = undoHubDraft(d);
  assert.equal(planHubDraftApply(back, live(), false).refused.length, 0);
});

test('a drafted Love Story is held to the moment fence: private refs dropped, the list capped', () => {
  const d = sanitizeHubDraft({
    events: {
      love_story: {
        moments: [
          { id: 'a', date: { y: 2018 }, line: 'ok', media: ['r2://payment-proofs/secret.jpg'], canvas: {} },
          'not a moment',
        ],
      },
    },
  });
  const moments = (d.events.love_story as { moments: Array<{ media?: string[] }> }).moments;
  assert.equal(moments.length, 1);
  assert.deepEqual(moments[0]!.media ?? [], [], 'a private-bucket ref never survives into a drafted story');
});

test('the draft now holds the colours and the words — and still nothing the guest page cannot show', () => {
  for (const c of [...HUB_DRAFT_LOOK_COLUMNS, ...HUB_DRAFT_WORDS_COLUMNS]) {
    assert.ok((HUB_DRAFT_EVENT_COLUMNS as readonly string[]).includes(c));
  }
  // Every one of them is on the row the guest page overlays for the host
  // (`loadEventShell`), except `together_since`, which the invitation reads
  // from `love_story` and only the Post Event editorial reads as a column.
  const shell = read('app/[slug]/_lib/loaders.ts');
  const select = /loadEventShell = cache[\s\S]*?\.select\(\s*'([^']+)'/.exec(shell)?.[1] ?? '';
  for (const c of [...HUB_DRAFT_LOOK_COLUMNS, ...HUB_DRAFT_WORDS_COLUMNS]) {
    if (c === 'together_since') continue;
    assert.match(select, new RegExp(`\\b${c}\\b`), `${c} is not on the row the host canvas overlays`);
  }
});
