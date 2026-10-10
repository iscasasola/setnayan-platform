/**
 * what-guests-see.test.ts — "WHAT GUESTS SEE" (DECISION_LOG 2026-10-10): ONE ANSWER for a scene on a stage.
 *
 * `sceneOnStage` (`lib/what-guests-see.ts`) is what the table will read: is the scene (a) drawn, (b) hidden by the
 * couple, (c) not possible on this stage, and (d) is it OUR pick. The guest page and the Maker's list decide through
 * the same file, and this suite holds the three to one another:
 *
 *   1. PROPERTY — over 4,000 random events (random rows, eyes, modes, audiences, stored choices, saved places, the
 *      Save the Date's lead, a Post Event preset, what the event type may show, empty scenes, open browsing, stages
 *      on and off) and every stage: the scenes the function puts in the stage's list are EXACTLY the page's plan for
 *      a listed guest (`hideableInOrder`), for a reader with no key (`publicSafeWidgets`), and the scenes the Maker
 *      lists (`makerStageList`) — and the Maker's fold agrees about "hidden by the couple";
 *   2. PROPERTY — nothing stored: no choice is ever read, and what the function calls drawn is what it calls our pick;
 *   3. THE REAL PAGE — for 60 random arrangements, what the function calls drawn (in the list or off it) is on the
 *      page `SiteBody` draws, and what it calls not drawn is not: the note, the reminders, the love story, the
 *      countdown, the couple's own scene, the gallery, the dress code, the day's schedule;
 *   4. the four answers, by example — including each "not possible" with the rule that decides it;
 *   5. SCENE × STAGE — where a `true` is honoured and where it is refused, printed and pinned.
 *
 * The generator is seeded: a failure prints its seed, and the same seed draws the same event.
 *
 * SABOTAGES RUN (each seen red, then put back and re-checked by hash):
 *   A · `sceneInStageList` made deaf to `false`                                        → 3, 4 red. NOT 1: the plan
 *       and the Maker ask that same line, so the three go deaf together and still agree — which is the design, and
 *       why 3 (the words on the real page) and 4 (the answers by example) exist beside the property;
 *   B · the function's own restating of the eye made wrong (`shownBeforeStages`)       → 1, 3, 4 red;
 *   C · the Maker's fold made to drop its "hidden here" mark                           → 1 red;
 *   D · the Day's Welcome place dropped from the function                              → 3, 4, 5 red;
 *   E · `pristine` made to keep the stored choice (so "our pick" follows the couple)   → 4 red;
 *   F · the page's plan made deaf to the choice (a stage list of its own again)        → 1, 3 red;
 *   G · the Day's schedule block on the real page made deaf                            → 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
/* FIRST: the page renderer's seam (see `lib/stage-pages-fixture.ts`). */
import { LOOK_NOTE, STAGE_WORDS, renderStagePage, stageWidgets, withALook, type RowPatch, type StageCase } from './stage-pages-fixture';
import { FIXTURE_WORDS } from './site-body-fixture';
import { STAGE_SCENES, STAGE_SHOW_KEY } from './stage-scenes';
import { WIDGET_CATALOG_BY_TYPE, type InvitationWidgetRow, type LifecyclePhase, type WidgetType } from './invitation-widgets';
import { resolveSiteBodyPlan } from './site-body-plan';
import { makerStageList, widgetsGuestsMeet } from './maker-scene-list';
import { sceneOnStage, scenesOnStage, whatGuestsSee, type GuestsSeeInput } from './what-guests-see';

const STAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
const HIDEABLE: readonly WidgetType[] = [
  'event_details', 'countdown', 'schedule', 'venue_map', 'dress_code', 'photo_moments', 'your_photos', 'tier_comparison',
  'special_message', 'what_to_bring', 'our_photos', 'our_love_story', 'custom_1', 'custom_2',
];
const ALWAYS: readonly WidgetType[] = ['hero', 'greeting', 'qr_card', 'rsvp'];

/** A small seeded generator (mulberry32) — the same seed draws the same event. */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!, chance: (p: number) => next() < p };
}

type Drawn = {
  rows: InvitationWidgetRow[];
  openBrowse: boolean;
  phasesEnabled: boolean;
  weddingOnlyParts: { save_the_date_film: boolean; love_story: boolean };
  content: Partial<Record<WidgetType, boolean>>;
  solemn: boolean;
  countdownPast: boolean;
  stored: boolean;
};

/** One random event. `stored` false = no per-stage choice anywhere (the page as it was). */
function randomEvent(seed: number, opts: { stored?: boolean; full?: boolean } = {}): Drawn {
  const r = rng(seed);
  const stored = opts.stored ?? true;
  const types = [...ALWAYS, ...HIDEABLE.filter(() => opts.full || r.chance(0.9))];
  const rows = types.map((type, i): InvitationWidgetRow => {
    const always = WIDGET_CATALOG_BY_TYPE[type].is_always_on;
    const config: Record<string, unknown> = {};
    if (stored) {
      const show: Record<string, boolean> = {};
      for (const s of STAGES) if (r.chance(0.35)) show[s] = r.chance(0.5);
      if (Object.keys(show).length > 0) config[STAGE_SHOW_KEY] = show;
    }
    if (r.chance(0.3)) config.stage_order = Object.fromEntries(STAGES.filter(() => r.chance(0.5)).map((s) => [s, Math.floor(r.next() * 6)]));
    if (type === 'our_photos' && r.chance(0.5)) config.std_lead = r.pick(['film', 'photos'] as const);
    if (type === 'custom_2' && r.chance(0.5)) config.canvas = { postEventPreset: 'the_toast' };
    return {
      widget_id: `id-${type}`, event_id: 'e', widget_type: type, display_order: r.chance(0.2) ? 3 : i, is_always_on: always,
      is_visible: always ? true : r.chance(0.7), tier: 'basic', config_json: config, created_at: '', updated_at: '',
      mode: r.pick(['auto', 'auto', 'shown', 'hidden'] as const), audience: r.pick(['public', 'public', 'guests_only'] as const),
    };
  });
  const content: Partial<Record<WidgetType, boolean>> = {};
  for (const t of HIDEABLE) if (r.chance(0.2)) content[t] = r.chance(0.5);
  return {
    rows,
    openBrowse: r.chance(0.5),
    phasesEnabled: r.chance(0.9),
    weddingOnlyParts: { save_the_date_film: r.chance(0.8), love_story: r.chance(0.85) },
    content,
    solemn: r.chance(0.1),
    countdownPast: r.chance(0.15),
    stored,
  };
}

const planOf = (e: Drawn, stage: LifecyclePhase, identity: 'guest' | 'anonymous', content = e.content, phasesEnabled = e.phasesEnabled) =>
  resolveSiteBodyPlan({
    identity, phasesEnabled, lifecyclePhase: stage, stdFilm: true, isSample: false, hasHeroMedia: false, hasBgMusic: false,
    liveMediaPublic: false, weddingOnlyParts: e.weddingOnlyParts,
    // As the page calls it (`site-body.tsx`): the rows guests can meet on this stage.
    widgets: widgetsGuestsMeet(e.rows, stage), openBrowse: e.openBrowse, content,
  });
const sorted = (xs: readonly string[]) => [...xs].sort();

test('1 · PROPERTY: the function, the page’s plan and the Maker’s list agree on every stage of 4,000 random events', () => {
  let compared = 0;
  let stored = 0;
  let refused = 0;
  for (let seed = 1; seed <= 4000; seed += 1) {
    const e = randomEvent(seed);
    for (const stage of STAGES) {
      const base: Omit<GuestsSeeInput, 'reader'> = {
        widgets: e.rows, stage, phasesEnabled: e.phasesEnabled, openBrowse: e.openBrowse, weddingOnlyParts: e.weddingOnlyParts, content: e.content,
      };
      const where = `seed ${seed} · ${stage} · openBrowse ${e.openBrowse} · stages ${e.phasesEnabled ? 'on' : 'off'}`;
      // ── the guest page, both readers
      const g = scenesOnStage({ ...base, reader: 'guest' });
      const a = scenesOnStage({ ...base, reader: 'anonymous' });
      assert.deepEqual(sorted(g.filter((s) => s.inList).map((s) => s.type)), sorted(planOf(e, stage, 'guest').hideableInOrder.map((w) => w.widget_type)), `a listed guest — ${where}`);
      assert.deepEqual(sorted(a.filter((s) => s.inList).map((s) => s.type)), sorted(planOf(e, stage, 'anonymous').publicSafeWidgets.map((w) => w.widget_type)), `a reader with no key — ${where}`);
      // ── the Maker (its canvas is the stranger's page, stages always on, never empty-dropped; it knows two more facts)
      const maker = makerStageList({
        stage, widgets: e.rows, openBrowse: e.openBrowse, weddingOnlyParts: e.weddingOnlyParts, content: e.content, solemn: e.solemn,
        hasHeroMedia: false, hasEntourage: true, storyRenders: true, countdownPast: e.countdownPast,
      });
      const m = scenesOnStage({
        ...base, reader: 'anonymous', phasesEnabled: true, content: {}, solemn: e.solemn,
        countdownPast: e.countdownPast && e.content.countdown !== false,
      });
      const listed = maker.shown.flatMap((t) => (t.kind === 'scene' ? [t.type] : []));
      // The Maker lists what is in the list AND its own component draws (a retired countdown is folded, with why).
      const drawnInList = (s: (typeof m)[number]) => s.inList && s.notPossible === null;
      assert.deepEqual(sorted(m.filter(drawnInList).map((s) => s.type)), sorted(listed), `the Maker’s list — ${where}`);
      for (const s of m) {
        const fold = maker.folded.find((f) => f.type === s.type);
        if (drawnInList(s)) {
          assert.equal(fold, undefined, `${s.type} is listed AND folded — ${where}`);
          continue;
        }
        // A scene this event type never has, and the rows the page never meets, are simply not there.
        if (!fold) {
          assert.ok(s.notPossible?.rule === 'weddingOnlyParts.love_story' || !widgetsGuestsMeet(e.rows, stage).some((w) => w.widget_type === s.type), `${s.type} is neither listed nor folded — ${where}`);
          continue;
        }
        assert.equal(fold.hiddenHere === true, s.choice === false, `${s.type}: "hidden here" — ${where}`);
        // Off the list a scene may still be drawn (the prose, the film) — then nobody calls it hidden.
        if (s.offList === null && s.notPossible === null) assert.equal(Boolean(fold.hiddenByCouple || fold.hiddenHere), s.hiddenByCouple, `${s.type}: hidden by the couple — ${where}`);
        if (s.choice !== null) stored += 1;
        if (s.choice === true && !s.drawn) refused += 1;
      }
      compared += 1;
    }
  }
  console.log(`  compared ${compared} stage pages · ${stored} stored choices met in the fold · ${refused} of them a refused "shown"`);
  assert.equal(compared, 16_000);
  assert.ok(stored > 5_000 && refused > 500, 'anti-vacuity: the generator stopped storing choices');
});

test('2 · PROPERTY: with nothing stored no choice is read, and "drawn" is "our pick" wherever the couple switched nothing off', () => {
  let cells = 0;
  for (let seed = 1; seed <= 1000; seed += 1) {
    const e = randomEvent(seed, { stored: false });
    // The same event with every eye on: the page we ship.
    const shipped: Drawn = { ...e, rows: e.rows.map((r) => ({ ...r, is_visible: true, mode: 'auto', audience: 'public' })) };
    for (const stage of STAGES) {
      for (const reader of ['guest', 'anonymous'] as const) {
        const input = (x: Drawn): GuestsSeeInput => ({ widgets: x.rows, stage, reader, phasesEnabled: x.phasesEnabled, openBrowse: x.openBrowse, weddingOnlyParts: x.weddingOnlyParts, content: x.content });
        const now = scenesOnStage(input(e));
        const ours = scenesOnStage(input(shipped));
        for (const [i, s] of now.entries()) {
          assert.equal(s.choice, null, `seed ${seed}: a choice was read with nothing stored`);
          assert.equal(ours[i]!.drawn, ours[i]!.ourPick, `seed ${seed} · ${stage} · ${s.type}: the shipped page is not our pick`);
          assert.equal(s.ourPick, ours[i]!.ourPick, `seed ${seed} · ${stage} · ${s.type}: our pick moved when the couple switched something off`);
          cells += 1;
        }
      }
    }
  }
  assert.ok(cells > 80_000, `anti-vacuity: ${cells} cells`);
});

/** A scene the real page can be asked about: the words only IT prints (for this reader). */
const ON_THE_PAGE: Array<{ type: WidgetType; words: (reader: 'guest' | 'anonymous') => string }> = [
  { type: 'special_message', words: () => FIXTURE_WORDS.message },
  { type: 'what_to_bring', words: () => STAGE_WORDS.reminder },
  { type: 'our_love_story', words: () => STAGE_WORDS.howWeMet },
  { type: 'countdown', words: () => 'Until we say' },
  { type: 'custom_1', words: () => STAGE_WORDS.ownSceneTitle },
  { type: 'our_photos', words: () => STAGE_WORDS.photo },
  // A guest the couple dressed reads her own line wherever the dress code is drawn; a reader with no key, its title.
  { type: 'dress_code', words: (reader) => (reader === 'guest' ? LOOK_NOTE : FIXTURE_WORDS.dressTitle) },
  { type: 'schedule', words: () => 'Cocktails' },
];

test('3 · THE REAL PAGE: what the function calls drawn is on the page, what it calls not drawn is not — 60 random arrangements', async () => {
  let asked = 0;
  let offList = 0;
  let notDrawn = 0;
  for (let seed = 1; seed <= 60; seed += 1) {
    const r = rng(seed * 7919);
    const stage = STAGES[seed % 4]!;
    const reader = seed % 3 === 0 ? ('anonymous' as const) : ('guest' as const);
    const openBrowse = r.chance(0.4);
    const patch: Partial<Record<WidgetType, RowPatch>> = {};
    for (const { type } of ON_THE_PAGE) {
      const show: Record<string, boolean> = {};
      for (const s of STAGES) if (r.chance(0.4)) show[s] = r.chance(0.5);
      patch[type] = {
        is_visible: r.chance(0.75),
        ...(openBrowse ? { mode: r.pick(['auto', 'shown', 'hidden'] as const) } : {}),
        config: { ...(Object.keys(show).length > 0 ? { [STAGE_SHOW_KEY]: show } : {}), ...(type === 'our_photos' && r.chance(0.5) ? { std_lead: 'photos' } : {}) },
      };
    }
    const rows = stageWidgets(patch);
    // The Save the Date as guests get it: the film plays unless the couple leads with the photos.
    const c: StageCase = { stage, reader, arrangement: stage === 'save_the_date' ? 'film' : openBrowse ? 'browse' : 'plain' };
    const more = { ...(reader === 'guest' ? withALook(c) : {}) };
    const event = { ...((more as { event?: Record<string, unknown> }).event ?? (await import('./stage-pages-fixture')).stageProps(c).event!), website_open_browse: openBrowse };
    const page = await renderStagePage(c, rows, { ...more, event: event as never });
    assert.deepEqual(page.complaints, [], `seed ${seed}: React or the page complained`);
    for (const { type, words } of ON_THE_PAGE) {
      const s = sceneOnStage({ widgets: rows, stage, reader, openBrowse }, type)!;
      const on = page.html.includes(words(reader));
      assert.equal(
        on, s.drawn,
        `seed ${seed} · ${stage} · ${reader} · openBrowse ${openBrowse} · ${type}: the function says ${s.drawn ? `drawn (${s.inList ? 'list' : s.offList})` : 'not drawn'}, the page ${on ? 'draws it' : 'does not'} — choice ${s.choice}, eye ${rows.find((w) => w.widget_type === type)!.is_visible}`,
      );
      asked += 1;
      if (s.offList !== null && !s.inList) offList += 1;
      if (!s.drawn) notDrawn += 1;
    }
  }
  console.log(`  asked the real page ${asked} times · ${offList} drawn only off the list · ${notDrawn} not drawn`);
  assert.ok(offList >= 20 && notDrawn >= 100, 'anti-vacuity: the arrangements stopped covering both answers');
});

test('4 · the four answers, by example', () => {
  const rows = (patch: Partial<Record<WidgetType, RowPatch>> = {}) => stageWidgets(patch);
  const show = (choices: Partial<Record<LifecyclePhase, boolean>>) => ({ config: { [STAGE_SHOW_KEY]: choices } });
  const at = (w: InvitationWidgetRow[], stage: LifecyclePhase, type: WidgetType, more: Partial<GuestsSeeInput> = {}) => sceneOnStage({ widgets: w, stage, ...more }, type)!;

  // (a) drawn + (d) our pick — nothing stored.
  assert.deepEqual(at(rows(), 'rsvp', 'special_message'), { type: 'special_message', stage: 'rsvp', choice: null, drawn: true, inList: true, offList: null, hiddenByCouple: false, notPossible: null, ourPick: true });
  // Not our pick, and nothing against it: an empty box the couple may tick.
  assert.deepEqual(at(rows(), 'event', 'special_message'), { type: 'special_message', stage: 'event', choice: null, drawn: false, inList: false, offList: null, hiddenByCouple: false, notPossible: null, ourPick: false });
  // …ticked: drawn, still not our pick.
  const added = at(rows({ special_message: show({ event: true }) }), 'event', 'special_message');
  assert.deepEqual([added.choice, added.drawn, added.inList, added.ourPick], [true, true, true, false]);
  // (b) hidden by the couple: on this stage, or for the whole event — and our pick stays marked.
  const here = at(rows({ special_message: show({ rsvp: false }) }), 'rsvp', 'special_message');
  assert.deepEqual([here.choice, here.drawn, here.hiddenByCouple, here.ourPick], [false, false, true, true]);
  const eye = at(rows({ special_message: { is_visible: false } }), 'rsvp', 'special_message');
  assert.deepEqual([eye.choice, eye.drawn, eye.hiddenByCouple, eye.ourPick], [null, false, true, true]);
  // (c) not possible, with the rule and a plain line.
  assert.deepEqual(at(rows({ countdown: show({ editorial: true }) }), 'editorial', 'countdown').notPossible, { rule: 'resolveWidgetTerminalState', why: 'Retired after the day.' });
  assert.deepEqual(at(rows(), 'rsvp', 'tier_comparison').notPossible, { rule: 'STAGE_SCENES', why: 'Not shown on any stage.' });
  assert.deepEqual(at(rows(), 'rsvp', 'our_love_story', { weddingOnlyParts: { love_story: false } }).notPossible, { rule: 'weddingOnlyParts.love_story', why: 'Not part of this kind of event.' });
  assert.deepEqual(at(rows(), 'rsvp', 'countdown', { solemn: true }).notPossible, { rule: 'solemn', why: 'Not shown for this kind of event.' });
  assert.deepEqual(at(rows(), 'event', 'countdown', { countdownPast: true }).notPossible, { rule: 'countdownPast', why: 'Retired — the day has arrived.' });
  assert.deepEqual(at(rows(), 'rsvp', 'event_details', { reader: 'anonymous' }).notPossible, { rule: 'PUBLIC_WIDGET_ALLOWLIST', why: "Only on each guest's own link." });
  assert.equal(at(rows(), 'rsvp', 'event_details').notPossible, null);

  // 🧭 OFF THE LIST. The Day: the dress code and the reminders are OUR PICK there — drawn by the Welcome.
  for (const type of ['dress_code', 'what_to_bring'] as const) {
    const s = at(rows(), 'event', type);
    assert.deepEqual([s.drawn, s.inList, s.offList, s.ourPick, s.notPossible], [true, false, 'welcome', true, null], type);
    assert.equal(at(rows({ [type]: show({ event: false }) }), 'event', type).hiddenByCouple, true);
  }
  assert.equal(at(rows(), 'event', 'dress_code', { reader: 'anonymous' }).drawn, false, 'a reader with no key has no look to be shown');
  // The Day's own schedule block and directions: a guest's, and not the eye's.
  assert.deepEqual([at(rows({ schedule: { is_visible: false } }), 'event', 'schedule').drawn, at(rows({ schedule: { is_visible: false } }), 'event', 'schedule').offList], [true, 'day']);
  assert.equal(at(rows({ venue_map: show({ event: false }) }), 'event', 'venue_map').drawn, false);
  // The love story as prose on The Day; the gallery inside the film.
  assert.deepEqual([at(rows(), 'event', 'our_love_story').offList, at(rows(), 'event', 'our_love_story').ourPick], ['prose', true]);
  assert.deepEqual([at(rows(), 'save_the_date', 'our_photos').offList, at(rows(), 'save_the_date', 'our_photos').inList], ['film', false]);
  assert.deepEqual([at(rows({ our_photos: { config: { std_lead: 'photos' } } }), 'save_the_date', 'our_photos').offList, at(rows({ our_photos: { config: { std_lead: 'photos' } } }), 'save_the_date', 'our_photos').inList], [null, true]);

  // An always-on row and a type with no row take no choice: no answer.
  assert.equal(sceneOnStage({ widgets: rows(), stage: 'rsvp' }, 'rsvp'), null);
  assert.equal(sceneOnStage({ widgets: rows().filter((r) => r.widget_type !== 'schedule'), stage: 'rsvp' }, 'schedule'), null);
  // The table: every hideable row on every stage.
  const table = whatGuestsSee({ widgets: rows() });
  for (const s of STAGES) assert.equal(table[s].length, rows().filter((r) => !r.is_always_on).length);
});

test('5 · SCENE × STAGE: where a "shown" is honoured and where it is refused — printed, and pinned', () => {
  const TABLE: WidgetType[] = ['event_details', 'countdown', 'special_message', 'our_love_story', 'our_photos', 'schedule', 'venue_map', 'dress_code', 'what_to_bring', 'photo_moments', 'your_photos', 'custom_1', 'tier_comparison'];
  const cell = (type: WidgetType, stage: LifecyclePhase): string => {
    const base = stageWidgets({ our_photos: { config: { std_lead: 'photos' } } });
    const plain = sceneOnStage({ widgets: base, stage }, type)!;
    const rows = base.map((r) => (r.widget_type === type ? { ...r, config_json: { ...(r.config_json as object), [STAGE_SHOW_KEY]: { [stage]: true } } } : r));
    const s = sceneOnStage({ widgets: rows, stage }, type)!;
    if (plain.ourPick) return plain.offList && !plain.inList ? `ours:${plain.offList}` : 'ours';
    return s.drawn ? 'added' : `no:${s.notPossible?.rule ?? '?'}`;
  };
  const got = Object.fromEntries(TABLE.map((t) => [t, STAGES.map((s) => cell(t, s))]));
  for (const t of TABLE) console.log(`  ${t.padEnd(16)} ${got[t]!.map((c) => c.padEnd(30)).join('')}`);
  assert.deepEqual(got, {
    //                 Save the Date                 Invitation   The Day          Post Event
    event_details:   ['added',                      'ours',      'added',         'added'],
    countdown:       ['ours',                       'ours',      'added',         'no:resolveWidgetTerminalState'],
    special_message: ['added',                      'ours',      'added',         'ours'],
    our_love_story:  ['ours',                       'ours',      'ours:prose',    'ours'],
    our_photos:      ['ours',                       'added',     'added',         'ours'],
    schedule:        ['added',                      'ours',      'ours',          'added'],
    venue_map:       ['added',                      'ours',      'ours',          'added'],
    dress_code:      ['added',                      'ours',      'ours:welcome',  'added'],
    what_to_bring:   ['added',                      'ours',      'ours:welcome',  'no:resolveWidgetTerminalState'],
    photo_moments:   ['added',                      'added',     'ours',          'no:resolveWidgetTerminalState'],
    your_photos:     ['added',                      'added',     'ours',          'ours'],
    custom_1:        ['ours',                       'ours',      'ours',          'ours'],
    tier_comparison: ['no:STAGE_SCENES',            'no:STAGE_SCENES', 'no:STAGE_SCENES', 'no:STAGE_SCENES'],
  });
  // The table of our picks is `STAGE_SCENES` — plus the three places off the list.
  for (const s of STAGES) for (const t of STAGE_SCENES[s]) assert.ok(got[t]![STAGES.indexOf(s)]!.startsWith('ours'), `${t} × ${s} is the stage’s own and not our pick`);
});
