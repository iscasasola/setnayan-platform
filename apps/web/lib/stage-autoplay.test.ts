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
 *
 * 🧩 AND EVERY SCENE (owner 2026-09-29: *"Save the Date auto-play walks the
 * widget scenes too"*). Auto read only the fixed anchors, so the navigator's
 * `w:countdown` and `w:our_love_story` were never a stop:
 *   6. RENDER: the page stamps every scene it draws with its navigator key, in
 *      the navigator's order, from the ONE list it renders (`HubScenes`) — for
 *      the stranger's tree and the guest's — and stamps nothing when off.
 *   7. Each scene carries its OWN clock (its canvas's Auto speed), and a mark
 *      never goes INSIDE a pinned scene (it would make an empty one non-empty).
 *   8. The stops: a scene that drew nothing is skipped, an Auto run is one stop
 *      that plays all its scenes, and each step holds for its own clock.
 *   9. SOURCE: the scenes are stamped exactly where the runner runs, never in the
 *      Maker's canvas; the runner reads the marks; reduced motion runs no clock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { HUB_AUTO_SCENE_SECONDS, HUB_AUTO_SPEED_FACTOR } from './hub-scenes';
import { makerStageList, widgetsGuestsMeet, type MakerStageInput } from './maker-scene-list';
import { resolveSiteBodyPlan } from './site-body-plan';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';
import {
  STAGE_AUTO_HOLD_MS,
  STAGE_SCENE_ANCHOR,
  stageAutoplaySchedule,
  stageAutoplaySteps,
  stageKeyForAnchor,
  stageSceneHoldMs,
  stageStops,
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
  // Owner 2026-09-27, "EACH STAGE DOES ONE JOB": the Save the Date holds the
  // date — film → names & date → countdown → Love Story (its prompt, while
  // unwritten, in the Maker) — and no longer carries the entourage.
  assert.deepEqual(navigator, ['f:film', 'f:hero', 'w:countdown', 'w:our_love_story'], 'the fixture must be the owner’s stage');
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
  assert.match(RUN, /stageAutoplaySteps\(\['f:film', \.\.\.stops\]\)/);
  assert.match(RUN, /new CustomEvent\(STD_FILM_EXIT_EVENT\)/, 'the film lifts, the same way "See our page" lifts it');
  const HANDOFF = stripComments(readFileSync(join(import.meta.dirname, '../app/[slug]/_components/std-film-handoff.tsx'), 'utf8'));
  assert.match(HANDOFF, /\{autoplay \? <StageAutoplay \/> : null\}/);
  const BODY = stripComments(readFileSync(join(import.meta.dirname, '../app/[slug]/_components/site-body.tsx'), 'utf8'));
  assert.match(BODY, /asSlide=\{isMakerCanvas\}\s*autoplay=\{!isMakerCanvas\}/, 'Auto runs for guests and the preview tab, never in the canvas');
});

/* ── 🧩 EVERY SCENE ─────────────────────────────────────────────────────── */

type Row = InvitationWidgetRow;
async function renderScenes(rows: readonly Row[], opts: { scrubAllowed: boolean; stageMarks?: boolean }) {
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubScenes } = await import('../app/[slug]/_components/hub-scenes');
  const Scenes = HubScenes as unknown as React.FunctionComponent<Record<string, unknown>>;
  const kids = rows.map((w) => React.createElement('section', { key: w.widget_id }, w.widget_type));
  return {
    html: renderToStaticMarkup(React.createElement(Scenes, { widgets: rows, ...opts }, kids)),
    plain: renderToStaticMarkup(React.createElement(React.Fragment, null, kids)),
  };
}
const marksIn = (html: string) => [...html.matchAll(/data-stage-scene="([^"]+)"/g)].map((m) => m[1]!);
const holdsIn = (html: string) => [...html.matchAll(/data-stage-hold="(\d+)"/g)].map((m) => Number(m[1]));
const withCanvas = (rows: readonly Row[], canvas: Partial<Record<WidgetType, Record<string, unknown>>>): Row[] =>
  rows.map((w) => (canvas[w.widget_type] ? { ...w, config_json: { canvas: canvas[w.widget_type] } } : w));

/** The stage's own list, as each of the page's two trees renders it. */
const stageList = (rows: readonly Row[], identity: 'anonymous' | 'guest') => {
  const plan = resolveSiteBodyPlan({
    identity, phasesEnabled: true, lifecyclePhase: 'save_the_date', stdFilm: true, isSample: false,
    hasHeroMedia: false, hasBgMusic: false, liveMediaPublic: false,
    widgets: widgetsGuestsMeet(rows, 'save_the_date'), openBrowse: false, content: {},
  });
  return identity === 'anonymous' ? plan.publicSafeWidgets : plan.hideableInOrder;
};
const sceneKeys = (input: MakerStageInput) =>
  makerStageList(input).shown.filter((t) => t.key.startsWith('w:')).map((t) => t.key);

test('6 · RENDER: every scene the Save the Date draws is stamped with its navigator key, in the navigator’s order', async () => {
  const navigatorScenes = sceneKeys(CALE_ICE);
  assert.deepEqual(navigatorScenes, ['w:countdown', 'w:our_love_story'], 'the owner’s stage has two scenes of its own');
  for (const identity of ['anonymous', 'guest'] as const) {
    const list = stageList(widgets, identity);
    const { html, plain } = await renderScenes(list, { scrubAllowed: false, stageMarks: true });
    console.log(`  ${identity} stage marks: ${marksIn(html).join(' → ')}`);
    assert.deepEqual(marksIn(html), navigatorScenes, `${identity}: Auto stops on every scene the navigator lists, in its order`);
    // The scenes themselves are untouched — each mark is hidden, in front of its scene.
    assert.equal(html.replace(/<span hidden="" data-stage-scene="[^"]+" data-stage-hold="\d+"><\/span>/g, ''), plain);
    // Off (every other stage, and the Maker's canvas): not one mark.
    const off = await renderScenes(list, { scrubAllowed: false });
    assert.equal(off.html, off.plain, `${identity}: without stageMarks the page is byte-identical`);
  }
  // …and the order is the couple's: drag the Love Story first and the marks follow.
  const dragged = widgets.map((w) =>
    w.widget_type === 'our_love_story' ? { ...w, config_json: { stage_order: { save_the_date: 0 } } }
    : w.widget_type === 'countdown' ? { ...w, config_json: { stage_order: { save_the_date: 1 } } } : w,
  );
  const nav = sceneKeys({ ...CALE_ICE, widgets: dragged });
  assert.deepEqual(nav, ['w:our_love_story', 'w:countdown']);
  const { html } = await renderScenes(stageList(dragged, 'anonymous'), { scrubAllowed: false, stageMarks: true });
  assert.deepEqual(marksIn(html), nav);
});

test('7 · each scene holds for its OWN clock, and a mark never goes inside a pinned scene', async () => {
  const slow = Math.round(HUB_AUTO_SCENE_SECONDS * HUB_AUTO_SPEED_FACTOR.slow * 1000);
  const fast = Math.round(HUB_AUTO_SCENE_SECONDS * HUB_AUTO_SPEED_FACTOR.fast * 1000);
  assert.equal(stageSceneHoldMs({ transition: 'auto', speed: 'slow' }), slow);
  assert.equal(stageSceneHoldMs({ transition: 'auto', speed: 'fast' }), fast);
  assert.equal(stageSceneHoldMs({ transition: 'scroll', speed: 'slow' }), STAGE_AUTO_HOLD_MS, 'only Auto carries a speed');
  assert.equal(stageSceneHoldMs({ transition: 'scrub', speed: 'normal' }), STAGE_AUTO_HOLD_MS);

  const list = stageList(widgets, 'anonymous');
  // Countdown set to Auto · Slow: with Event Hub Pro it is an Auto run.
  const auto = withCanvas(list, { countdown: { transition: 'auto', autoSpeed: 'slow' } });
  const pro = await renderScenes(auto, { scrubAllowed: true, stageMarks: true });
  assert.deepEqual(marksIn(pro.html), ['w:countdown', 'w:our_love_story']);
  assert.equal(holdsIn(pro.html)[0], slow, 'the countdown holds for its own Slow clock');
  assert.match(pro.html, /class="hub-scene hub-auto" data-stage-scene="w:countdown"/, 'on the run’s own scene wrapper');
  // Without Pro the page scrolls, so the countdown holds one ordinary beat.
  const free = await renderScenes(auto, { scrubAllowed: false, stageMarks: true });
  assert.deepEqual(holdsIn(free.html), [STAGE_AUTO_HOLD_MS, STAGE_AUTO_HOLD_MS]);

  // A Scrub run: the marks sit ON the pinned wrappers — never a child inside
  // one (an empty pinned scene must stay `:empty`) — and never on a spacer.
  const scrub = withCanvas(list, { countdown: { transition: 'scrub' } });
  const run = await renderScenes(scrub, { scrubAllowed: true, stageMarks: true });
  assert.deepEqual(marksIn(run.html), ['w:countdown', 'w:our_love_story']);
  assert.doesNotMatch(run.html, /<span hidden/, 'no marker element inside a scene wrapper');
  assert.match(run.html, /class="hub-scene hub-scrub" style="--hub-tl:--hub-s0" data-stage-scene="w:countdown"/);
  assert.doesNotMatch(run.html, /class="hub-sp"[^>]*data-stage-scene/);
  // Off, the run is exactly the run it was.
  const off = await renderScenes(scrub, { scrubAllowed: true });
  assert.doesNotMatch(off.html, /data-stage-/);
});

test('8 · the stops: an empty scene is skipped, an Auto run is ONE stop that plays through, each holds its own clock', () => {
  const RUN = 'the-run';
  const stops = stageStops([
    { key: 'f:hero', el: 'hero', drew: true },
    { key: 'w:countdown', el: 'countdown', drew: false, holdMs: 4500 }, // a countdown with no date
    { key: 'w:custom_1', el: 'c1', drew: true, holdMs: 6300, run: { el: RUN, live: 2 } },
    { key: 'w:custom_2', el: 'c2', drew: true, holdMs: 6300, run: { el: RUN, live: 2 } },
    { key: 'w:our_love_story', el: 'story', drew: true, holdMs: 2700 },
    { key: 'w:our_love_story', el: 'again', drew: true },
  ]);
  assert.deepEqual(stops.map((s) => s.key), ['f:hero', 'w:custom_1', 'w:our_love_story'], 'empty dropped, run collapsed, duplicate once');
  assert.equal(stops[1]!.el, RUN, 'the run is brought into view, not one of its scenes');
  assert.equal(stops[1]!.holdMs, 2 * 6300, 'held while both of its scenes play at the run’s clock');
  assert.equal(stops[0]!.holdMs, STAGE_AUTO_HOLD_MS, 'a fixed scene holds one beat');

  const steps = stageAutoplaySteps(['f:film', ...stops]);
  assert.deepEqual(steps.map((s) => s.key), ['f:film', 'f:hero', 'w:custom_1', 'w:our_love_story']);
  assert.deepEqual(steps.map((s) => s.holdMs), [STAGE_AUTO_HOLD_MS, STAGE_AUTO_HOLD_MS, 12600, 0], 'the last scene is where the stage rests');
  const at = stageAutoplaySchedule(steps).map((s) => s.at);
  assert.deepEqual(at, [0, STAGE_AUTO_HOLD_MS, 2 * STAGE_AUTO_HOLD_MS, 2 * STAGE_AUTO_HOLD_MS + 12600]);
});

test('9 · SOURCE: the scenes are stamped where the runner runs — never in the Maker’s canvas', () => {
  const BODY = stripComments(readFileSync(join(import.meta.dirname, '../app/[slug]/_components/site-body.tsx'), 'utf8'));
  assert.match(BODY, /const stageAutoplayOn = plan\.body === 'save_the_date' && !isMakerCanvas;/);
  assert.equal((BODY.match(/<HubScenes [^>]*stageMarks=\{stageAutoplayOn\}/g) ?? []).length, 2, 'both trees — the stranger’s and the guest’s — stamp their scenes');
  assert.doesNotMatch(BODY, /stageMarks=\{(?!stageAutoplayOn\})/, 'no other value turns the marks on');
  const RUN = stripComments(readFileSync(join(import.meta.dirname, '../app/[slug]/_components/stage-autoplay.tsx'), 'utf8'));
  assert.match(RUN, /querySelectorAll<HTMLElement>\(\[`\[\$\{STAGE_SCENE_ATTR\}\]`, \.\.\.ids\]/, 'the runner reads the stamped scenes AND the fixed anchors, in one document-order pass');
  assert.match(RUN, /const stops = stageStops\(scenesOnPage\(\)\)/);
  assert.match(RUN, /prefers-reduced-motion: reduce\)'\)\.matches\) return;/, 'reduced motion: no clock');
});
