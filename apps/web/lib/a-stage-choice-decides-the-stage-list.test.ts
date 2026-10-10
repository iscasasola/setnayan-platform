/**
 * a-stage-choice-decides-the-stage-list.test.ts — "WHAT GUESTS SEE" (DECISION_LOG 2026-10-10): the couple's per-stage
 * choice (`config_json.stage_show`, `lib/stage-scenes.ts`) and the list of scenes a stage draws.
 *
 * THE READER HELD HERE is the guest page's plan — `resolveSiteBodyPlan` (`hideableInOrder` for a listed guest,
 * `publicSafeWidgets` for a reader with no key), on both of its paths, and what follows from it on the real page:
 * the Invitation's Welcome (`welcomeParts`, which takes its scenes from the plan), the reply (`rsvpReplyOpen`) and
 * the stage's full order (`stageRowOrder`, the list a drag swaps in).
 *
 *   1. `false` takes a scene off THAT stage and no other — for both readers, with open browsing off and on;
 *   2. `true` shows a scene over the event-wide eye (and over a Hidden mode), on that stage only;
 *   3. `true` ADDS a scene to a stage whose own list leaves it out: drawn there, last by default, at its saved
 *      place once it has one — and the stage's full order has it, so it can be dragged;
 *   4. where a scene cannot be, `true` is refused — each refusal named with the rule that decides it;
 *   5. an always-on row takes no choice: the reply, the greeting and the ticket are where they were;
 *   6. with stages switched off there is no stage to choose for: the page is the one it was;
 *   7. open browsing keeps what it adds for a `true`: nothing empty, nothing "guests only" for a reader with no key;
 *   8. ON THE REAL PAGE: a scene hidden on the Invitation is not on the Invitation and still on Post Event; the
 *      dress code hidden on the Invitation takes the guest's look off its Welcome with it; a schedule added to the
 *      Save the Date is drawn there by the schedule's own component.
 *
 * SABOTAGES RUN (each seen red, then put back and re-checked by hash):
 *   A · `sceneInStageList` made deaf to `false` (the `choice === false` line removed)            → 1, 8 red;
 *   B · the plan made to filter by the stage's own list again (`stageListRows` not asked)          → 1, 2, 3, 7, 8 red;
 *   C · `whyNotInStageList` made to refuse nothing                                                → 4 red;
 *   D · `stageChoice` made to answer for every row (both of its refusals removed: the always-on flag and
 *       "a type no stage's list names")                                                             → 5 red.
 *       Removing the always-on flag ALONE stays green, and is not a hole: every always-on type is also a type no
 *       stage's list names, so it is refused twice;
 *   E · `stageChoice` made to answer with stages off                                               → 6 red
 *       (the plan itself only asks inside `if (phasesEnabled)`; the off-the-list readers pass the switch in);
 *   F · `stageRowOrder` made blind to an added scene                                               → 3 red;
 *   G · the "added goes last" rank in `inStageOrder` removed                                       → 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
/* FIRST: the page renderer's seam (see `lib/stage-pages-fixture.ts`). */
import { STAGE_WORDS, renderStagePage, stageWidgets, type RowPatch } from './stage-pages-fixture';
import { FIXTURE_BLOCKS, FIXTURE_WORDS } from './site-body-fixture';
import { STAGE_SCENES, STAGE_SHOW_KEY, stageRowOrder, stageShown } from './stage-scenes';
import { isWidgetType, widgetInPhase, type InvitationWidgetRow, type LifecyclePhase, type WidgetType } from './invitation-widgets';
import { resolveSiteBodyPlan, rsvpReplyOpen } from './site-body-plan';
import { welcomeParts } from './invitation-welcome';
import { hiddenOnStage, stageChoice, stageChoiceOf, stageChoiceOr, whyNotInStageList } from './what-guests-see';

const STAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
const show = (choices: Partial<Record<LifecyclePhase, boolean>>, more: Record<string, unknown> = {}) => ({ config: { [STAGE_SHOW_KEY]: choices, ...more } });

type PlanOpts = { openBrowse?: boolean; phasesEnabled?: boolean; content?: Partial<Record<WidgetType, boolean>> };
const plan = (rows: readonly InvitationWidgetRow[], stage: LifecyclePhase, o: PlanOpts = {}) =>
  resolveSiteBodyPlan({
    identity: 'guest', phasesEnabled: o.phasesEnabled ?? true, lifecyclePhase: stage, stdFilm: true, isSample: false,
    hasHeroMedia: false, hasBgMusic: false, liveMediaPublic: false, widgets: rows, openBrowse: o.openBrowse ?? false, content: o.content ?? {},
  });
const guest = (rows: readonly InvitationWidgetRow[], stage: LifecyclePhase, o: PlanOpts = {}) => plan(rows, stage, o).hideableInOrder.map((w) => w.widget_type);
const stranger = (rows: readonly InvitationWidgetRow[], stage: LifecyclePhase, o: PlanOpts = {}) => plan(rows, stage, o).publicSafeWidgets.map((w) => w.widget_type);
const rows = (patch: Partial<Record<WidgetType, RowPatch>> = {}) => stageWidgets(patch);

test('1 · false takes a scene off THAT stage and no other — both readers, open browsing off and on', () => {
  for (const openBrowse of [false, true]) {
    const before = Object.fromEntries(STAGES.map((s) => [s, { g: guest(rows(), s, { openBrowse }), a: stranger(rows(), s, { openBrowse }) }]));
    for (const type of ['special_message', 'our_love_story', 'schedule', 'countdown', 'custom_1'] as const) {
      const on = STAGES.filter((s) => before[s]!.g.includes(type));
      assert.ok(on.length >= 2, `anti-vacuity: ${type} is on ${on.length} stage(s)`);
      const off = on[0]!;
      const stored = rows({ [type]: show({ [off]: false }) });
      for (const s of STAGES) {
        const g = guest(stored, s, { openBrowse });
        const a = stranger(stored, s, { openBrowse });
        if (s === off) {
          assert.ok(!g.includes(type) && !a.includes(type), `${type} hidden on ${off} is still in its list (openBrowse ${openBrowse})`);
          assert.deepEqual(g, before[s]!.g.filter((t) => t !== type), 'the rest of the stage moved');
        } else {
          assert.deepEqual(g, before[s]!.g, `${type} hidden on ${off} changed ${s} (guest, openBrowse ${openBrowse})`);
          assert.deepEqual(a, before[s]!.a, `${type} hidden on ${off} changed ${s} (no key, openBrowse ${openBrowse})`);
        }
      }
    }
  }
});

test('2 · true shows a scene over the event-wide eye — and over a Hidden mode — on that stage only', () => {
  const hidden = rows({ special_message: { is_visible: false } });
  assert.ok(STAGES.every((s) => !guest(hidden, s).includes('special_message')), 'anti-vacuity: the eye hides it everywhere');
  const back = rows({ special_message: { is_visible: false, ...show({ rsvp: true }) } });
  assert.ok(guest(back, 'rsvp').includes('special_message') && stranger(back, 'rsvp').includes('special_message'));
  assert.deepEqual(guest(back, 'rsvp'), guest(rows(), 'rsvp'), 'it is back at its own place on the stage');
  assert.ok(!guest(back, 'editorial').includes('special_message'), 'the eye still decides the stage with no choice');
  // Open browsing: the mode is the eye there.
  const mode = rows({ special_message: { mode: 'hidden', ...show({ editorial: true }) } });
  assert.ok(guest(mode, 'editorial', { openBrowse: true }).includes('special_message'));
  assert.ok(!guest(mode, 'rsvp', { openBrowse: true }).includes('special_message'));
});

test('3 · true ADDS a scene to a stage whose own list leaves it out: last by default, at its place once placed, and draggable', () => {
  const inStage = (t: string, s: LifecyclePhase) => isWidgetType(t) && widgetInPhase(t, s);
  for (const [type, stage] of [['schedule', 'save_the_date'], ['special_message', 'event'], ['dress_code', 'editorial'], ['venue_map', 'save_the_date'], ['photo_moments', 'rsvp']] as const) {
    assert.ok(!STAGE_SCENES[stage].includes(type), `anti-vacuity: ${type} is already the ${stage}'s`);
    const base = guest(rows({ our_photos: { config: { std_lead: 'photos' } } }), stage);
    const added = rows({ our_photos: { config: { std_lead: 'photos' } }, [type]: show({ [stage]: true }) });
    const got = guest(added, stage);
    assert.deepEqual(got, [...base, type], `${type} added to ${stage}: ${got.join(' → ')}`);
    assert.equal(got[got.length - 1], type, 'an added scene goes after the stage’s own scenes and the couple’s own');
    for (const s of STAGES) if (s !== stage) assert.deepEqual(guest(added, s), guest(rows({ our_photos: { config: { std_lead: 'photos' } } }), s), `adding to ${stage} changed ${s}`);
    // With a saved place it sits there.
    const placed = rows({ our_photos: { config: { std_lead: 'photos' } }, [type]: show({ [stage]: true }, { stage_order: { [stage]: 0 } }) });
    assert.equal(guest(placed, stage)[0], type, 'its saved place decides');
    // The stage's FULL order (what a drag swaps in) has it — and did not before.
    assert.ok(stageRowOrder(added, stage, inStage).some((r) => r.widget_type === type), `${type} cannot be dragged on ${stage}`);
    assert.ok(!stageRowOrder(rows(), stage, inStage).some((r) => r.widget_type === type));
  }
});

test('4 · where a scene cannot be, true is refused — and the rule that refuses it is named', () => {
  const refused: Array<[WidgetType, LifecyclePhase, string, Partial<Record<WidgetType, RowPatch>>?]> = [
    ['countdown', 'editorial', 'resolveWidgetTerminalState'],
    ['what_to_bring', 'editorial', 'resolveWidgetTerminalState'],
    ['photo_moments', 'editorial', 'resolveWidgetTerminalState'],
    // On The Day the Countdown has already retired (it counts to the START of the day, `CountdownWidget`).
    ['countdown', 'event', 'SCENES_RETIRED_ON_THE_DAY'],
    // On The Day the dress code and the reminders have ONE home, the Welcome — never a second copy in the list.
    ['dress_code', 'event', 'DAY_WELCOME_SCENES'],
    ['what_to_bring', 'event', 'DAY_WELCOME_SCENES'],
    // "Two ways to celebrate" is on no stage.
    ['tier_comparison', 'rsvp', 'STAGE_SCENES'],
    ['tier_comparison', 'editorial', 'STAGE_SCENES'],
  ];
  for (const [type, stage, rule, extra] of refused) {
    const stored = rows({ ...(extra ?? {}), [type]: show({ [stage]: true }) });
    assert.ok(!guest(stored, stage).includes(type) && !stranger(stored, stage).includes(type), `${type} × ${stage} was drawn`);
    assert.ok(!guest(stored, stage, { openBrowse: true }).includes(type), `${type} × ${stage} was drawn with open browsing on`);
    assert.equal(whyNotInStageList(stored.find((r) => r.widget_type === type)!, { stage, reader: 'guest', film: false }), rule);
  }
  // 🎞 Under the film the gallery is the film's own; led by the photos it is the stage's.
  const gallery = rows({ our_photos: show({ save_the_date: true }) });
  assert.equal(plan(gallery, 'save_the_date').body, 'save_the_date');
  assert.ok(!guest(gallery, 'save_the_date').includes('our_photos'));
  assert.equal(whyNotInStageList(gallery.find((r) => r.widget_type === 'our_photos')!, { stage: 'save_the_date', reader: 'guest', film: true }), 'stdShows');
  // A scene made from a Post Event preset is Post Event's and nowhere else's.
  const preset = rows({ custom_1: show({ rsvp: true }, { canvas: { postEventPreset: 'the_toast' } }) });
  const presetRow = preset.find((r) => r.widget_type === 'custom_1')!;
  assert.equal(whyNotInStageList(presetRow, { stage: 'rsvp', reader: 'guest', film: false }), 'sceneMeetsGuestsOn');
  assert.ok(!guest(preset, 'rsvp').includes('custom_1'));
  assert.equal(whyNotInStageList(presetRow, { stage: 'editorial', reader: 'guest', film: false }), null);
  assert.ok(guest(preset, 'editorial').includes('custom_1'), 'on Post Event it is drawn');
  // A reader with no key never gets a guest's own scene, whatever is stored.
  const own = rows({ event_details: show({ event: true }), your_photos: show({ rsvp: true }) });
  assert.ok(guest(own, 'event').includes('event_details') && guest(own, 'rsvp').includes('your_photos'), 'a guest does');
  assert.ok(!stranger(own, 'event').includes('event_details') && !stranger(own, 'rsvp').includes('your_photos'));
  assert.equal(whyNotInStageList(own.find((r) => r.widget_type === 'event_details')!, { stage: 'event', reader: 'anonymous', film: false }), 'PUBLIC_WIDGET_ALLOWLIST');
});

test('5 · an always-on row takes no choice: the reply, the greeting, the ticket and the names are where they were', () => {
  const stored = rows({ rsvp: show({ rsvp: false, event: true }), greeting: show({ rsvp: false }), qr_card: show({ rsvp: false, save_the_date: true }), hero: show({ rsvp: false }) });
  for (const s of STAGES) {
    for (const openBrowse of [false, true]) {
      const a = plan(rows(), s, { openBrowse });
      const b = plan(stored, s, { openBrowse });
      assert.deepEqual(
        [b.heroShouldRender, b.greetingShouldRender, b.qrCardShouldRender, b.rsvpShouldRender],
        [a.heroShouldRender, a.greetingShouldRender, a.qrCardShouldRender, a.rsvpShouldRender],
        `an always-on row moved on ${s}`,
      );
      assert.equal(
        rsvpReplyOpen({ widgets: stored, openBrowse, phasesEnabled: true, lifecyclePhase: s }),
        rsvpReplyOpen({ widgets: rows(), openBrowse, phasesEnabled: true, lifecyclePhase: s }),
      );
    }
  }
  assert.equal(plan(stored, 'rsvp').rsvpShouldRender, true, 'anti-vacuity: the reply is on the Invitation');
  // …and none of them is "added" to a stage's list of scenes by a true (the ticket on the Save the Date, the reply on the day).
  for (const s of STAGES) {
    assert.deepEqual(guest(stored, s), guest(rows(), s), `an always-on row joined the scenes of ${s}`);
    for (const r of stored.filter((w) => w.is_always_on)) assert.equal(stageChoice(r, s, true), null, `${r.widget_type} answered for ${s}`);
  }
  assert.equal(stageChoice(stored.find((r) => r.widget_type === 'qr_card')!, 'save_the_date', true), null);
  assert.equal(stageShown(stored.find((r) => r.widget_type === 'qr_card')!.config_json, 'save_the_date'), true, 'anti-vacuity: it IS stored on the row');
});

test('6 · with stages switched off there is no stage to choose for: the page is the one it was', () => {
  const stored = rows({ special_message: show({ rsvp: false }), schedule: show({ save_the_date: true }), dress_code: { is_visible: false, ...show({ rsvp: true }) } });
  const plain = rows({ dress_code: { is_visible: false } });
  for (const s of STAGES) {
    for (const openBrowse of [false, true]) {
      assert.deepEqual(guest(stored, s, { phasesEnabled: false, openBrowse }), guest(plain, s, { phasesEnabled: false, openBrowse }));
      assert.deepEqual(stranger(stored, s, { phasesEnabled: false, openBrowse }), stranger(plain, s, { phasesEnabled: false, openBrowse }));
    }
  }
  assert.ok(guest(stored, 'rsvp', { phasesEnabled: false }).includes('special_message'), 'anti-vacuity: the choice is stored and not read');
  // The places that draw a scene off the list ask the same question, and get "no choice" too.
  assert.equal(stageChoiceOf(stored, 'special_message', 'rsvp', true), false, 'anti-vacuity');
  assert.equal(stageChoiceOf(stored, 'special_message', 'rsvp', false), null);
  assert.equal(stageChoiceOr(stored, 'special_message', 'rsvp', false, true), true);
  assert.equal(hiddenOnStage(stored, 'special_message', 'rsvp', false), false);
  assert.equal(hiddenOnStage(stored, 'special_message', 'rsvp', true), true);
});

test('7 · open browsing keeps what it adds for a true: nothing empty, nothing "guests only" for a reader with no key', () => {
  const stored = rows({ schedule: show({ save_the_date: true }), venue_map: { audience: 'guests_only', ...show({ save_the_date: true }) } });
  const o = { openBrowse: true };
  assert.ok(guest(stored, 'save_the_date', o).includes('venue_map') && !stranger(stored, 'save_the_date', o).includes('venue_map'));
  assert.ok(guest(stored, 'save_the_date', o).includes('schedule'));
  assert.ok(!guest(stored, 'save_the_date', { openBrowse: true, content: { schedule: false } }).includes('schedule'), 'an empty schedule was drawn');
  // With open browsing off neither rule exists, and a true is a true.
  assert.ok(stranger(stored, 'save_the_date').includes('venue_map'));
  assert.ok(guest(stored, 'save_the_date', { content: { schedule: false } }).includes('schedule'));
});

test('8 · on the REAL page: hidden on the Invitation only; the guest’s look leaves with the dress code; an added schedule is drawn', async () => {
  const c = (stage: LifecyclePhase, arrangement: 'plain' | 'photos' = 'plain') => ({ stage, reader: 'guest' as const, arrangement });
  // The note: off the Invitation, still on Post Event.
  const note = rows({ special_message: show({ rsvp: false }) });
  assert.ok((await renderStagePage(c('rsvp'))).html.includes(FIXTURE_WORDS.message), 'anti-vacuity');
  const invite = await renderStagePage(c('rsvp'), note);
  assert.deepEqual(invite.complaints, []);
  assert.ok(!invite.html.includes(FIXTURE_WORDS.message), 'the note hidden on the Invitation is on the Invitation');
  assert.ok((await renderStagePage(c('editorial'), note)).html.includes(FIXTURE_WORDS.message), 'hiding it on the Invitation took it off Post Event');

  // The dress code: off the Invitation's Details AND the guest's look on its Welcome (`welcomeParts` reads the plan).
  const dress = rows({ dress_code: show({ rsvp: false }) });
  assert.ok(welcomeParts({ stage: 'rsvp', bodyNormal: true, scenes: guest(rows(), 'rsvp'), identified: true, reminders: null, giftHref: null, maker: false }).includes('look'), 'anti-vacuity');
  assert.ok(!welcomeParts({ stage: 'rsvp', bodyNormal: true, scenes: guest(dress, 'rsvp'), identified: true, reminders: null, giftHref: null, maker: false }).includes('look'));
  const noDress = await renderStagePage(c('rsvp'), dress);
  assert.ok(!noDress.html.includes(FIXTURE_WORDS.dressTitle), 'the dress code hidden on the Invitation is on the Invitation');

  // A schedule added to the Save the Date (led by the photos) is drawn by the schedule's own component.
  const base = { our_photos: { config: { std_lead: 'photos' } } };
  const before = await renderStagePage(c('save_the_date', 'photos'), rows(base));
  /* (The first moment and "Ceremony" are printed elsewhere on a guest's page — the arrival line, a venue's label —
     so the run of show is told by the moments only IT prints, and by every moment being printed once more.) */
  const labels = FIXTURE_BLOCKS.map((b) => b.label.replace('&', '&amp;'));
  const times = (html: string, word: string) => html.split(word).length - 1;
  for (const m of labels.slice(2)) assert.equal(times(before.html, m), 0, `anti-vacuity: the Save the Date already prints "${m}"`);
  const added = await renderStagePage(c('save_the_date', 'photos'), rows({ ...base, schedule: show({ save_the_date: true }) }));
  assert.deepEqual(added.complaints, []);
  for (const m of labels) assert.equal(times(added.html, m), times(before.html, m) + 1, `the added schedule prints "${m}" once`);
  assert.ok(added.html.includes(STAGE_WORDS.howWeMet), 'the stage’s own scenes are still there');
});
