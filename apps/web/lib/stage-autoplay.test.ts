/**
 * stage-autoplay.test.ts — owner 2026-09-26, verbatim: *"i am looking at
 * cale-ice save the date. the sequence created on their save the date has a
 * sequence. all is on autoplay. but the slides do not follow."*
 *
 * The Save the Date is three scenes — film → names & date → entourage — and only
 * the film ever played: its close beat holds forever (`dur: Infinity`) and
 * nothing handed over to the next scene. This holds the Auto sequence:
 *   1. The steps are the NAVIGATOR's order for the stage (`makerStageList`),
 *      film first, each scene once — for a page shaped like the owner's.
 *   2. Each scene is held for one Auto beat — the page's own Auto-scroll clock,
 *      not a new number — and the last one is where the stage comes to rest.
 *   3. The schedule is strictly increasing in that same order.
 *   4. Every fixed scene the stage can show has an anchor on the guest page
 *      (else the runner would silently skip it).
 *   5. SOURCE: the film announces its close; the runner lifts the film and
 *      walks the page's scenes; it runs for guests and the preview tab — never
 *      in the Maker's canvas, where the film is a slide to edit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { HUB_AUTO_SCENE_SECONDS } from './hub-scenes';
import { makerStageList, type MakerStageInput } from './maker-scene-list';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';
import {
  STAGE_AUTO_HOLD_MS,
  STAGE_SCENE_ANCHOR,
  stageAutoplaySchedule,
  stageAutoplaySteps,
  stageKeyForAnchor,
} from './stage-autoplay';

const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const ORDER: WidgetType[] = [
  'hero', 'greeting', 'qr_card', 'event_details', 'countdown', 'schedule', 'rsvp', 'venue_map',
  'dress_code', 'photo_moments', 'your_photos', 'tier_comparison', 'special_message',
  'what_to_bring', 'our_photos', 'our_love_story',
];
const widgets: InvitationWidgetRow[] = ORDER.map((t, i) => ({
  widget_id: `id-${t}`,
  event_id: 'e1',
  widget_type: t,
  display_order: i + 1,
  is_visible: true,
  is_always_on: ALWAYS.has(t),
  tier: 'basic',
  config_json: {},
  created_at: '',
  updated_at: '',
  mode: 'auto',
  audience: 'public',
}));
/** Shaped like cale-ice on prod (2026-09-26): all sixteen rows visible, every
 *  `config_json` `{}`, an entourage, no love story, open browsing off. */
const CALE_ICE: MakerStageInput = {
  stage: 'save_the_date',
  widgets,
  openBrowse: false,
  content: { schedule: true, venue_map: true, our_love_story: false, our_photos: false, special_message: false, what_to_bring: false, countdown: true },
  solemn: false,
  hasHeroMedia: false,
  hasEntourage: true,
  storyRenders: false,
};

test('1 · the Auto steps are the navigator’s order for the stage — film first, each scene once', () => {
  const navigator = makerStageList(CALE_ICE).shown.map((t) => t.key);
  assert.deepEqual(navigator, ['f:film', 'f:hero', 'f:entourage'], 'the fixture must be the owner’s stage');
  const steps = stageAutoplaySteps(navigator);
  console.log(`  Save the Date plays: ${steps.map((s) => s.key).join(' → ')}`);
  assert.deepEqual(steps.map((s) => s.key), navigator);
  assert.equal(steps[0]!.kind, 'film');
  // a page read out of order is NOT re-sorted: the order given is the order played
  assert.deepEqual(stageAutoplaySteps(['f:film', 'f:entourage', 'f:hero']).map((s) => s.key), ['f:film', 'f:entourage', 'f:hero']);
  // the film leads even when the page's scan finds the scenes first, and duplicates play once
  assert.deepEqual(stageAutoplaySteps(['f:hero', 'f:film', 'f:hero', 'f:entourage']).map((s) => s.key), ['f:film', 'f:hero', 'f:entourage']);
  // no film → just the scenes
  assert.deepEqual(stageAutoplaySteps(['f:hero', 'f:entourage']).map((s) => s.kind), ['scene', 'scene']);
});

test('2 · each scene holds one Auto beat — the page’s own Auto clock — and the last comes to rest', () => {
  assert.equal(STAGE_AUTO_HOLD_MS, HUB_AUTO_SCENE_SECONDS * 1000, 'a stage’s Auto must use the same clock as the page’s Auto-scroll');
  const steps = stageAutoplaySteps(['f:film', 'f:hero', 'f:entourage']);
  assert.deepEqual(steps.map((s) => s.holdMs), [STAGE_AUTO_HOLD_MS, STAGE_AUTO_HOLD_MS, 0]);
});

test('3 · the schedule starts each scene where the one before it ended', () => {
  const schedule = stageAutoplaySchedule(stageAutoplaySteps(['f:film', 'f:hero', 'f:entourage']));
  assert.deepEqual(schedule, [
    { key: 'f:film', at: 0 },
    { key: 'f:hero', at: STAGE_AUTO_HOLD_MS },
    { key: 'f:entourage', at: 2 * STAGE_AUTO_HOLD_MS },
  ]);
  for (let i = 1; i < schedule.length; i++) assert.ok(schedule[i]!.at > schedule[i - 1]!.at);
});

test('4 · every fixed scene after the film has an anchor the runner can find', () => {
  for (const key of ['f:hero', 'f:entourage', 'f:story']) {
    const id = STAGE_SCENE_ANCHOR[key];
    assert.ok(id, `${key} has no anchor — Auto would skip it`);
    assert.equal(stageKeyForAnchor(id!), key);
  }
  const BODY = stripComments(readFileSync(join(import.meta.dirname, '../app/[slug]/_components/site-body.tsx'), 'utf8'));
  assert.match(BODY, /id="site-entourage"/, 'the entourage anchor is on the page');
  const MENU = stripComments(readFileSync(join(import.meta.dirname, '../app/[slug]/_lib/site-menu.ts'), 'utf8'));
  assert.match(MENU, /home: 'site-home'/);
  assert.match(MENU, /story: 'site-story'/);
});

test('5 · SOURCE: the film announces its close, the runner hands over, and never in the canvas', () => {
  const FILM = stripComments(readFileSync(join(import.meta.dirname, '../app/[slug]/_components/save-the-date-film.tsx'), 'utf8'));
  assert.match(FILM, /export const STD_FILM_CLOSE_EVENT = 'std:film-close'/);
  assert.match(FILM, /window\.dispatchEvent\(new CustomEvent\(STD_FILM_CLOSE_EVENT\)\)/, 'the film must say when it reaches its close');
  const RUN = stripComments(readFileSync(join(import.meta.dirname, '../app/[slug]/_components/stage-autoplay.tsx'), 'utf8'));
  assert.match(RUN, /window\.addEventListener\(STD_FILM_CLOSE_EVENT, onClose\)/);
  assert.match(RUN, /stageAutoplaySteps\(\['f:film', \.\.\.sceneKeysOnPage\(\)\]\)/);
  assert.match(RUN, /new CustomEvent\(STD_FILM_EXIT_EVENT\)/, 'the film lifts, the same way "See our page" lifts it');
  const HANDOFF = stripComments(readFileSync(join(import.meta.dirname, '../app/[slug]/_components/std-film-handoff.tsx'), 'utf8'));
  assert.match(HANDOFF, /\{autoplay \? <StageAutoplay \/> : null\}/);
  const BODY = stripComments(readFileSync(join(import.meta.dirname, '../app/[slug]/_components/site-body.tsx'), 'utf8'));
  assert.match(BODY, /asSlide=\{isMakerCanvas\}\s*autoplay=\{!isMakerCanvas\}/, 'Auto runs for guests and the preview tab, never in the canvas');
});
