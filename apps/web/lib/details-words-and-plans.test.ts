/**
 * details-words-and-plans.test.ts — Details PART 2b (DECISION_LOG 2026-09-28
 * "DETAILS IS THE ONE FILL-IN AREA; STAGES ARE LOOK AND MOTION; TAP IS A
 * SHORTCUT", "NO 'GO EDIT IT OVER THERE' LINKS", "OPTION B — EVERYTHING MADE
 * ONCE LIVES IN DETAILS"; 2026-09-29 "THE PLAN ADAPTS TO EVERY EVENT TYPE").
 *
 * Held here:
 *   1 · Words (Special message · Thank-you · Opening line · Kindly reply) and
 *       Story & plans (Love Story · Schedule · RSVP) are Details items, and
 *       every old door to the moved pages lands on its item.
 *   2 · A FACT TAPPED ON A STAGE OPENS THE SAME COMPONENT AS ITS DETAILS ITEM —
 *       one set of editors, built once, handed to Details AND to the stage;
 *       a design word keeps its part sheet.
 *   3 · One field, two doors — a fact drawn in two items is one value.
 *   4 · A birthday and a wake: no Love Story, every other item, no wedding word.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { GENERIC_PROFILE, WAKE_PROFILE, WEDDING_PROFILE } from './event-type-profile';
import { eventWordsFromProfile } from '../app/[slug]/_lib/event-words';
import {
  DETAILS_ITEM_GROUPS,
  DETAILS_ITEM_KEYS,
  STORY_ITEM_KEYS,
  WORDS_ITEM_KEYS,
  detailsDoorHref,
  detailsItemFor,
  detailsItemLayout,
  detailsNavigatorKeys,
  makerHasWork,
  makerToolFor,
  movedPageItem,
  RSVP_PIECES,
  schedulePieces,
  wordsAndPlansItem,
  type DetailsItemContext,
  type DetailsItemKey,
  type WordsAndPlansInput,
} from './maker-details-items';
import { detailsItemForSection, detailsItemForTap } from './maker-details-selection';

(globalThis as unknown as { React: unknown }).React = React;
/* The RSVP settings import the draft action, whose module is `server-only`:
   stubbed for this render, as `the-rsvp-page-follows-the-maker.test.ts` does. */
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const SHELL = 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx';

/* ── 1 · the items, and the old doors ─────────────────────────────────── */

test('Words and Story & plans are Details rows, in the owner’s order', () => {
  /* 🗂 2026-10-06 ("EVENT DETAILS IS REBUILT"): the words are fields of the ONE
     Your event form (Kindly reply left for the RSVP stage); Story & plans holds
     the items with an editor of their own (RSVP left for the RSVP stage). */
  const event = DETAILS_ITEM_GROUPS.find((g) => g.group === 'event')!;
  const story = DETAILS_ITEM_GROUPS.find((g) => g.group === 'story')!;
  const elsewhere = DETAILS_ITEM_GROUPS.find((g) => g.group === 'elsewhere')!;
  assert.equal(event.form, true, 'Your event is one form');
  assert.deepEqual(
    [...event.keys].filter((k) => ['special-message', 'thank-you', 'opening-line'].includes(k)),
    ['thank-you', 'opening-line', 'special-message'],
  );
  assert.deepEqual([...story.keys], ['march', 'love-story', 'schedule', 'seating']);
  assert.equal(elsewhere.hidden, true);
  assert.ok(elsewhere.keys.includes('kindly-reply') && elsewhere.keys.includes('rsvp'), 'Kindly reply and RSVP stay addressable');
  assert.equal(new Set(DETAILS_ITEM_KEYS).size, DETAILS_ITEM_KEYS.length, 'one key names two items');
});

test('every old door to a moved page lands on its Details item', () => {
  // The address: `?tool=love-story` · `?tool=rsvp-page` are Details now.
  assert.equal(makerToolFor('love-story'), 'details');
  assert.equal(makerToolFor('rsvp-page'), 'details');
  assert.equal(makerToolFor('post-event'), 'post-event', 'a stage tool did not move');
  assert.equal(detailsItemFor({ tool: 'love-story' }), 'love-story');
  assert.equal(detailsItemFor({ tool: 'rsvp-page' }), 'rsvp');
  // A selection (a scene's "Open … editor", a restored tab) lands on the item —
  // the ONE translation part 3 built (`movedPageItem`), now that the items exist.
  assert.equal(movedPageItem('love-story'), 'love-story');
  assert.equal(movedPageItem('rsvp-page'), 'rsvp');
  assert.equal(movedPageItem('post-event'), null, 'a stage tool is not a Details item');
  // The old ROUTES carry their own query onto the item.
  assert.equal(
    detailsDoorHref('e-1', 'schedule', { view: 'preparation', note: undefined, ros: '' }),
    '/dashboard/e-1/launch?tool=details&item=schedule&view=preparation',
  );
  assert.equal(detailsDoorHref('e-1', 'love-story', { error: 'a & b' }), '/dashboard/e-1/launch?tool=details&item=love-story&error=a%20%26%20b');
  // …and every one of them passes through the ONE translation, in the shell.
  const shell = read(`${L}/maker-shell.tsx`);
  assert.match(shell, /const item = next\?\.kind === 'tool' \? movedPageItem\(next\.key\) : null;/);
  assert.equal((shell.match(/movedSelection\(/g) ?? []).length >= 4, true, 'the address, memory and every select must pass through it');
  assert.doesNotMatch(read('lib/maker-details-selection.ts'), /export function landInDetails|TOOLS_IN_DETAILS/, 'a second translation came back');
  // The bar no longer offers them as pages of their own.
  const bar = read(`${L}/maker-bar.ts`);
  assert.doesNotMatch(bar, /key: 'love-story', label|key: 'rsvp-page', label/);
});

test('the old routes redirect ONLY where Details draws the item, and never inside the Maker', () => {
  const schedule = read('app/dashboard/[eventId]/schedule/page.tsx');
  assert.match(
    schedule,
    /if \(!inMaker && \(await detailsIsTheDoor\(supabase, eventId, user\.id\)\)\) \{\s*redirect\(detailsDoorHref\(eventId, 'schedule',/,
  );
  const story = read('app/dashboard/[eventId]/website/our-story/page.tsx');
  assert.match(
    story,
    /if \(!inMaker && \(await eventWordsForEvent\(eventId\)\)\.twoPeople && \(await detailsIsTheDoor\(supabase, eventId, user\.id\)\)\) \{\s*redirect\(\s*detailsDoorHref\(eventId, 'love-story',/,
  );
  const door = read('lib/maker-details-door.server.ts');
  assert.match(door, /return makerHasWork\(memberType, surfaceEnabled\(await resolveProfileByEvent\(eventId\), 'website'\)\);/, 'the door is not the launch page’s own rule');
  assert.match(door, /if \(error\) \{[\s\S]{0,160}return false;/, 'a refused read is not a yes');
  assert.equal(makerHasWork('couple', true), true);
  assert.equal(makerHasWork('moderator', true), false, 'a coordinator keeps the standalone page');
  assert.equal(makerHasWork('couple', false), false, 'a type with no Event Hub keeps the page');
  // Inside Details the pages are drawn with `maker: '1'`, so they never bounce.
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /<CoupleSchedulePage[\s\S]{0,160}maker: '1'/);
  assert.match(launch, /<OurStoryEditorPage[\s\S]{0,160}maker: '1'/);
});

test('Story & plans draw the SHIPPED pages whole — the same components, never re-drawn', () => {
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /import OurStoryEditorPage from '\.\.\/website\/our-story\/page';/);
  assert.match(launch, /import CoupleSchedulePage from '\.\.\/schedule\/page';/);
  assert.match(launch, /<MakerRsvpCanvas questionsSrc=\{rsvpSrc\} repliedSrc=\{rsvpRepliedSrc\}/);
  assert.match(launch, /settings: \(\s*<MakerRsvpSettings\b/);
  const details = read(`${L}/maker-details.tsx`);
  // Love Story's words: in the Maker the instant panel (2026-09-30, "so hard to
  // edit … the delay of response is terrible"), handed down by the Maker and
  // drawing the SHIPPED `LoveStoryChaptersPanel`; without the Maker, the Story
  // row's own panel (`StoryPanel`, `updateOurStory`).
  assert.match(details, /'love-story': \(\s*<InMakerLiveStoryPanel panel=\{[^}]*\}\}>\s*<StoryPanel\s+action=\{updateOurStory\.bind\(null, eventId\)\}/);
  const live = read('app/dashboard/[eventId]/website/our-story/_components/love-story-live.tsx');
  assert.match(live, /<LoveStoryChaptersPanel story=\{story as LoveStoryBlob\} ownsPro=\{ownsPro\} \/>/);
  // 🧩 Three parts, never a whole page dropped in (DECISION_LOG "A TOOL MOVED
  // INTO THE MAKER IS REBUILT INTO THE THREE PARTS"): the Schedule's rail is
  // the picture and its OWN inspector fills the right column.
  assert.equal(detailsItemLayout('schedule'), 'flow');
  assert.equal(detailsItemLayout('rsvp'), 'fill');
  assert.equal(detailsItemLayout('love-story'), 'flow');
  assert.match(details, /\.\.\.\(schedule \? \{ schedule: <ScheduleSlots \/> \} : \{\}\)/, 'the Schedule has no right column');
  assert.match(details, /schedule: <ItemPieces item="schedule" pieces=\{schedule\.pieces\} \/>/, 'the Schedule lists no moments');
  assert.match(details, /'love-story': <ItemPieces item="love-story"/);
  assert.match(details, /rsvp: <ItemPieces item="rsvp" pieces=\{RSVP_PIECES\} \/>/);
  const page = read('app/dashboard/[eventId]/schedule/page.tsx');
  assert.match(page, /inspectorSlot=\{inMaker \? DETAILS_SCHEDULE_INSPECTOR_SLOT : null\}/, 'the rail keeps its inspector to itself in the Maker');
  assert.match(page, /<InSlot id=\{inMaker \? DETAILS_SCHEDULE_ANNOUNCE_SLOT : null\}>/);
  const rail = read('app/dashboard/[eventId]/schedule/_components/day-rail.tsx');
  assert.match(rail, /\{inspectorSlot \? <InSlot id=\{inspectorSlot\}>\{side\}<\/InSlot> : null\}/);
  assert.match(rail, /isDesktop && !inspectorSlot/, 'the page’s own side column is drawn beside the Maker’s');
  assert.match(rail, /!isDesktop && selected && !inspectorSlot/, 'the phone panel rises over the Maker too');
  // 📵 The reminder tour rode the RSVP picture until 2026-09-29, when guest
  // reminder emails were switched off (owner: no email to guests) — gone with them.
  const rsvpItem = launch.slice(launch.indexOf('const rsvpItem = {'), launch.indexOf('settings: ('));
  assert.doesNotMatch(rsvpItem, /customer_guest_reminders_v1/);
});

test('RSVP links out to nothing: "Reply by" is a date field right there, and the Requests rows are in place', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerRsvpSettings } = await import(`../${L}/maker-rsvp-ask`);
  const html = renderToStaticMarkup(
    React.createElement(MakerRsvpSettings, {
      eventId: 'e-1',
      current: {},
      drafted: false,
      replyBy: { date: '2026-11-18', isDefault: false },
      replyByOwn: { deadline: '2026-11-18', pricingMode: 'final_only' },
      requests: { count: 2, list: React.createElement('ul', { 'data-stub': 'the-shipped-requests-rows' }) },
    }),
  );
  assert.doesNotMatch(html, /<a\b[^>]*href=/, 'the RSVP settings still link out');
  const replyBy = html.slice(html.indexOf('data-rsvp-setting="reply-by"'), html.indexOf('data-rsvp-setting="requests"'));
  assert.match(replyBy, /<input[^>]*type="date"[^>]*value="2026-11-18"/, 'reply-by is not a field here');
  /* ⏳ Reply by is DRAFTED in the Maker since 2026-10-08 (owner "draft 1-3") — no "saves immediately". */
  assert.doesNotMatch(replyBy, /data-hub-saves-immediately/, 'a drafted Reply by still says it saves immediately');
  assert.match(html, /data-rsvp-requests-list=""[\s\S]*data-stub="the-shipped-requests-rows"/, 'the Requests rows are not in place');
  // The one writer of that column, with the pricing view posted back unchanged.
  const src = read(`${L}/maker-rsvp-ask.tsx`);
  assert.match(src, /import \{ updatePaxSettings \} from '\.\.\/\.\.\/actions';/);
  /* The field is the shared `ReplyBy` part (2026-10-07, one setting two doors). */
  const part = read('app/dashboard/[eventId]/_components/guest-setup/reply-by.tsx');
  assert.match(part, /fd\.set\('adaptive_pricing_mode', pricingMode\);/, 'a reply-by save would reset the pricing view');
  // The rows are the Requests page itself, drawn with `maker=1` (no way back, saves stay put).
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /<RequestsPage params=\{Promise\.resolve\(\{ eventId \}\)\} searchParams=\{Promise\.resolve\(\{ maker: '1' \}\)\} \/>/);
  const claims = read('app/dashboard/[eventId]/guests/claims/page.tsx');
  assert.match(claims, /\{inMaker \? null : <input type="hidden" name="from" value="requests" \/>\}/, 'a save in the Maker would leave it');
});

test('a schedule MOMENT tapped on a stage opens Details › Schedule with that moment selected', () => {
  const widget = read('app/[slug]/_components/schedule-widget.tsx');
  assert.match(widget, /data-schedule-moment=\{b\.block_id\}/, 'the guest schedule does not name its moments');
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  assert.match(bridge, /closest\?\.\('\[data-schedule-moment\]'\)/);
  assert.match(bridge, /t: 'edit', key, \.\.\.empty, \.\.\.moment \}/, 'the tap does not carry the moment');
  const shell = read(SHELL);
  const at = shell.indexOf("if (data.key === 'w:schedule' && typeof moment === 'string'");
  assert.ok(at > 0, 'the Maker does not act on a tapped moment');
  const branch = shell.slice(at, at + 400);
  assert.match(branch, /openDetailsItemRef\.current\('schedule'\)/);
  assert.match(branch, /select\?\.\(\{ kind: 'tool', key: 'details' \}\)/);
  assert.match(branch, /askScheduleFocus\(moment\)/);
  const rail = read('app/dashboard/[eventId]/schedule/_components/day-rail.tsx');
  assert.match(rail, /focus\(takeQueuedScheduleFocus\(\)\);/, 'the rail does not take an ask made before it mounted');
  assert.match(rail, /setSelectedId\(id\);/);
  assert.match(rail, /data-rail-moment=\{m\.block_id\}/);
  // …and in the Maker the Schedule opens on the day itself, where the rail is.
  assert.match(read('app/dashboard/[eventId]/schedule/page.tsx'), /inMaker\s*\? 'event-day'/);
});

/* ── 2 · a tapped fact opens the SAME component ───────────────────────── */

test('a fact on a stage names its Details item; a design word does not', () => {
  assert.equal(detailsItemForTap('w:special_message', 'body'), 'special-message');
  assert.equal(detailsItemForTap('w:special_message', undefined), 'special-message', 'the empty space of a words scene is its words');
  assert.equal(detailsItemForTap('w:special_message', 'heading'), null, 'a scene heading is a design word');
  assert.equal(detailsItemForTap('w:special_message', 'label'), null);
  assert.equal(detailsItemForTap('w:our_love_story', 'body'), 'love-story');
  assert.equal(detailsItemForTap('f:story', null), 'love-story');
  assert.equal(detailsItemForTap('f:hero', 'joiner'), null, 'the joiner stays on its part');
  assert.equal(detailsItemForSection('w:our_love_story'), 'love-story');
  assert.equal(detailsItemForSection('w:countdown'), null);
});

test('🔑 a tapped fact opens the SAME component its Details item shows — one set, built once, handed to both', async () => {
  // SOURCE — ONE builder, called ONCE by the launch page, its result handed to
  // BOTH Details (`facts`) and the Maker shell (`factEditors`).
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.equal((launch.match(/detailsFactEditors\(/g) ?? []).length, 1, 'the fact editors are built more than once');
  assert.match(launch, /factEditors = detailsFactEditors\(\{/);
  assert.match(launch, /facts=\{factEditors\}/, 'Details is not handed the fact editors');
  assert.match(launch, /factEditors=\{factEditors\}/, 'the stage is not handed the fact editors');
  const details = read(`${L}/maker-details.tsx`);
  assert.match(details, /'special-message': \(\s*<SpecialMessageField\b/, 'the special message editor is not the shared component');
  assert.match(details, /'special-message': facts\['special-message'\],/, 'the Words item draws its own copy');
  assert.match(details, /'thank-you': facts\['thank-you'\],/);
  assert.match(details, /'love-story': facts\['love-story'\] \?\? \(/, 'the Love Story item draws its own words editor');
  const shell = read(SHELL);
  assert.match(shell, /const node = factEditors\?\.\[item\];/, 'the stage builds its own editor');
  assert.doesNotMatch(shell, /<SpecialMessageField\b|<StoryPanel\b|<LiveStoryPanel\b/, 'the stage draws a second copy of a Details editor');

  // RENDER — the stage's inspector, with a special message scene open on
  // Content, draws the very node the Details item was handed.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerWork } = await import(`../${SHELL.replace(/\.tsx$/, '')}`);
  const { MakerContext } = await import(`../${L}/maker-context`);
  const SENTINEL = React.createElement('i', { 'data-sentinel': 'the-details-special-message-editor' });
  const factEditors: Partial<Record<DetailsItemKey, React.ReactNode>> = { 'special-message': SENTINEL };
  const html = renderToStaticMarkup(paint(MakerContext, MakerWork, { kind: 'scene', id: 'w-sm', tab: 'content' }, factEditors));
  assert.match(html, /data-maker-fact-editor="special-message"[\s\S]*data-sentinel="the-details-special-message-editor"/, 'the stage did not open the Details editor');
  assert.doesNotMatch(html, /data-details-bound="|Change it everywhere/, 'the stage opened its own box instead');
  // …and with no Details editor handed down (outside the Maker), nothing is invented.
  const bare = renderToStaticMarkup(paint(MakerContext, MakerWork, { kind: 'scene', id: 'w-sm', tab: 'content' }, {}, { bound: false }));
  assert.doesNotMatch(bare, /data-maker-fact-editor=/);
});

test('the shared special message editor posts its one writer, drafted, and previews on the tapped scene', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SpecialMessageField } = await import(`../${L}/special-message-field`);
  const html = renderToStaticMarkup(
    React.createElement(SpecialMessageField, { action: async () => {}, initial: 'See you there.', back: '/dashboard/e-1/launch?tool=details&item=special-message' }),
  );
  assert.match(html, /<form[^>]*data-details-special=""/);
  assert.match(html, /<input type="hidden" name="draft" value="1"\/>/, 'it does not post to the draft');
  assert.match(html, /<textarea[^>]*name="message"[^>]*data-same-field="special_message"|<textarea[^>]*data-same-field="special_message"[^>]*name="message"/);
  assert.match(html, />See you there\.<\/textarea>/);
  const src = read(`${L}/special-message-field.tsx`);
  assert.match(src, /const scene = useDetailsFactScene\(\);\s*const preview = useSceneWordsBox\(scene, box,/, 'no live preview on the tapped scene');
});

test('🧩 a tool’s pieces: LEFT under its item, the picked one’s controls RIGHT — hidden, never unmounted', async () => {
  // The pieces are the tools' own.
  assert.deepEqual(RSVP_PIECES.map((p) => p.key), ['questions', 'who', 'reply-by', 'requests']);
  const settings = read(`${L}/maker-rsvp-ask.tsx`);
  for (const key of RSVP_PIECES.map((p) => p.key)) {
    assert.match(settings, new RegExp(`<DetailsPieceOnly item="rsvp" piece="${key}">`), `RSVP piece ${key} wraps no settings`);
  }
  assert.match(read('app/dashboard/[eventId]/website/our-story/_components/love-story-chapters-panel.tsx'), /<DetailsPieceOnly key=\{chapter\} item="love-story" piece=\{chapter\}>/);
  assert.deepEqual(
    schedulePieces([{ id: 'b1', label: 'Ceremony', time: '3:00 PM' }, { id: 'b2', label: '', time: '' }], true),
    [
      { key: 'b1', label: 'Ceremony', sub: '3:00 PM' },
      { key: 'b2', label: 'A moment' },
      { key: 'announcements', label: 'Announcements' },
    ],
  );
  assert.equal(schedulePieces([], false).length, 0);

  // RENDERED on part 3's one mechanism (`details-go.tsx`): the picked item
  // lists its pieces (the workspace's `pieces` prop), the first is picked…
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DetailsWorkspace } = await import(`../${L}/details-workspace`);
  const { DetailsPieceOnly, ItemPieces } = await import(`../${L}/details-piece`);
  const { DetailsPieceContext } = await import(`../${L}/details-go`);
  const html = renderToStaticMarkup(
    React.createElement(DetailsWorkspace, {
      groups: [{ key: 'story', label: 'Story & plans', items: [{ key: 'rsvp', group: 'story', label: 'RSVP', icon: null }] }],
      bodies: { rsvp: 'THE-GUEST-RSVP' },
      editors: { rsvp: 'SETTINGS' },
      pieces: { rsvp: React.createElement(ItemPieces, { item: 'rsvp', pieces: RSVP_PIECES }) },
      initial: 'rsvp',
    }),
  );
  for (const p of RSVP_PIECES) assert.match(html, new RegExp(`data-details-piece="${p.key}"`), `the navigator does not list ${p.key}`);
  assert.match(html, /aria-pressed="true"[^>]*data-details-piece="questions"/, 'the first piece is not picked');
  // …and only the picked piece's controls show — the others hidden, never unmounted.
  const controls = renderToStaticMarkup(
    React.createElement(
      DetailsPieceContext.Provider,
      { value: { piece: () => 'questions', setPiece: () => {} } },
      React.createElement(DetailsPieceOnly, { item: 'rsvp', piece: 'questions' }, React.createElement('i', { 'data-stub': 'Q' })),
      React.createElement(DetailsPieceOnly, { item: 'rsvp', piece: 'reply-by' }, React.createElement('i', { 'data-stub': 'R' })),
    ),
  );
  assert.match(controls, /<div class="contents" data-details-piece-only="questions"><i data-stub="Q">/, 'the picked piece’s controls are not shown');
  assert.match(controls, /<div hidden="" class="hidden" data-details-piece-only="reply-by"><i data-stub="R">/, 'another piece’s controls are unmounted or shown');
});

/* ── 3 · one field, two doors ─────────────────────────────────────────── */

test('a fact drawn in two items is ONE value — every door carries its fact, and Details keeps them in step', () => {
  const details = read(`${L}/maker-details.tsx`);
  assert.match(details, /name="rsvp_choice"\s+data-same-field="rsvp_choice"/);
  assert.match(details, /name="rsvp_manual"\s+data-same-field="rsvp_manual"/);
  // Each door of a two-door fact is the SAME node, drawn in its Words item and under its print's switch.
  assert.equal((details.match(/\{openingLine\}/g) ?? []).length, 2, 'the opening line is not in both doors');
  assert.equal((details.match(/\{kindlyReply\}/g) ?? []).length, 2, '"Kindly reply" is not in both doors');
  assert.match(read(`${L}/opening-line-field.tsx`), /name="opening_line"\s+data-same-field="opening_line"/);
  assert.match(read('app/dashboard/[eventId]/pabuya/_components/pabuya-message-editor.tsx'), /data-same-field="pabuya_message"/);
  assert.match(read(`${L}/details-workspace.tsx`), /useSameFieldDoors\(\);/, 'the doors are not kept in step');
  const same = read(`${L}/same-field.ts`);
  assert.match(same, /Object\.getOwnPropertyDescriptor\(proto, 'value'\)\?\.set\?\.call\(el, from\.value\)/, 'a React-controlled door would swallow the copy');
  assert.match(same, /if \(copying \|\| !isDoor\(from\)\) return 0;/, 'a copy would echo forever');
});

/* ── 4 · every event type ─────────────────────────────────────────────── */

const ctx = (profile: typeof WEDDING_PROFILE): DetailsItemContext => ({ profile, solemn: eventWordsFromProfile(profile).solemn });
const BIRTHDAY = { ...GENERIC_PROFILE, eventType: 'birthday' };
const ALL = new Set<DetailsItemKey>(DETAILS_ITEM_KEYS);

test('a birthday and a wake: every Words item, the Schedule and RSVP — and no Love Story', () => {
  const keysFor = (p: typeof WEDDING_PROFILE) => detailsNavigatorKeys(ctx(p), ALL).flatMap((g) => g.keys);
  for (const p of [BIRTHDAY, WAKE_PROFILE]) {
    const keys = keysFor(p);
    for (const k of [...WORDS_ITEM_KEYS, 'schedule', 'rsvp'] as const) assert.ok(keys.includes(k), `${p.eventType} lost ${k}`);
    assert.ok(!keys.includes('love-story'), `${p.eventType} was offered a love story`);
  }
  assert.equal(ctx(WAKE_PROFILE).solemn, true, 'the wake fixture is not the solemn register');
  for (const k of STORY_ITEM_KEYS) assert.ok(keysFor(WEDDING_PROFILE).includes(k), `a wedding lost ${k}`);
});

test('no wedding word — and nothing celebratory — in any Words or Story & plans item, for a birthday or a wake', () => {
  const inputs: WordsAndPlansInput[] = [
    {
      specialMessage: null,
      thankYou: null,
      openingLine: null,
      kindlyReply: false,
      include: { specialMessage: false, thankYou: false, openingLine: false, rsvp: false, loveStory: false, schedule: false },
      loveStoryMoments: null,
      scheduleMoments: null,
    },
    {
      specialMessage: 'Thank you for being here.',
      thankYou: 'Salamat po.',
      openingLine: 'With gratitude',
      kindlyReply: true,
      include: { specialMessage: true, thankYou: true, openingLine: true, rsvp: true, loveStory: true, schedule: true },
      loveStoryMoments: 1,
      scheduleMoments: 3,
    },
  ];
  const WEDDING_WORDS = /\b(wedding|couple|bride|groom|celebrat\w*|party)\b/i;
  for (const p of [BIRTHDAY, WAKE_PROFILE]) {
    const keys = detailsNavigatorKeys(ctx(p), ALL)
      .flatMap((g) => g.keys)
      .filter((k): k is (typeof WORDS_ITEM_KEYS)[number] | (typeof STORY_ITEM_KEYS)[number] =>
        ([...WORDS_ITEM_KEYS, ...STORY_ITEM_KEYS] as readonly string[]).includes(k),
      );
    for (const input of inputs) {
      for (const k of keys) {
        const m = wordsAndPlansItem(k, input);
        for (const text of [m.label, m.sub ?? '', ...(m.usedOn ?? [])]) {
          assert.doesNotMatch(text, WEDDING_WORDS, `${p.eventType} · ${k}: "${text}"`);
        }
      }
    }
  }
  // …and the part-2b files type no wedding word of their own (comments aside).
  for (const f of [`${L}/special-message-field.tsx`, `${L}/same-field.ts`, 'lib/maker-details-selection.ts', 'lib/maker-details-door.server.ts']) {
    assert.doesNotMatch(read(f), /\b(wedding|bride|groom)\b/i, `${f} types a wedding word`);
  }
});

/* ── helpers ──────────────────────────────────────────────────────────── */

const STAGES = ['save_the_date', 'rsvp', 'event', 'editorial'] as const;

function paint(
  MakerContext: React.Context<unknown>,
  MakerWork: React.ComponentType<Record<string, unknown>>,
  selection: unknown,
  factEditors: Partial<Record<DetailsItemKey, React.ReactNode>>,
  opts: { bound?: boolean } = {},
) {
  const bound = opts.bound ?? true;
  const noop = () => {};
  const value = {
    eventId: 'ev-1',
    stage: 'rsvp',
    setStage: noop,
    device: 'phone',
    navOpen: true,
    selection,
    select: noop,
    moreOpen: false,
    renderStamp: '1',
    storeShell: false,
    seeAs: null,
    addScene: null,
    setAddScene: noop,
    factEditors,
  };
  return React.createElement(
    MakerContext.Provider,
    { value },
    React.createElement(MakerWork, {
      eventId: 'ev-1',
      publicLandingUrl: '/ana-ben',
      scenes: [{ id: 'w-sm', type: 'special_message', label: 'Special message', mode: 'shown', isVisible: true, hasContent: true, transitionLabel: 'Scroll' }],
      navigator: {
        stageLists: Object.fromEntries(STAGES.map((s) => [s, { stage: s, shown: [], folded: [] }])),
        fullOrders: Object.fromEntries(STAGES.map((s) => [s, []])),
        stdLead: null,
        minis: {},
        tint: { canvas: '#fff', ink: '#111', accent: '#a55' },
      },
      scenePanels: {},
      rows: {},
      themes: [],
      themeHref: '/x',
      ownsPro: true,
      toggleAction: noop,
      setModeAction: noop,
      moveUpAction: noop,
      moveDownAction: noop,
      proUnlockHref: '/pro',
      proPriceLabel: null,
      showProCta: false,
      revealStages: ['save_the_date'],
      madeOnce: {},
      detailsBound: bound
        ? { values: { message: 'See you there.' }, ownWords: [], tour: null, startingPoint: null, startingHint: '' }
        : null,
      elementEditing: bound
        ? {
            canvases: { special_message: {} },
            palette: { ink: '#111', heading: '#111', accent: '#a55', muted: '#666', surface: '#fff' },
            draftAction: async () => ({ ok: true }),
          }
        : null,
    }),
  );
}
