/**
 * hub-setup-steps.test.ts — "FINISH YOUR EVENT HUB", THE EVENT HUB SETUP (B).
 *
 * Owner-approved 2026-10-01 (`WEDDING_ONBOARDING_HUB_SETUP_EVENT_DETAILS_BUILD_SPEC_2026-10-01.md`,
 * THE MAP B1–B7; DECISION_LOG "ASK EVERY FACT ONCE…", "ONBOARDING + THE EVENT
 * HUB SETUP PREFILL THE MAKER — BY WRITING THE SAME FIELDS THE MAKER READS").
 *
 * Held here:
 *   (1) 🔑 THE PREFILL GUARD — each setup step IS a Maker Details item, and the
 *       field it writes is the one that item's own editor writes (so opening the
 *       Maker after the setup shows it filled in); a fact onboarding (A) asked
 *       is never a step here;
 *   (2) 🚪 THREE DOORS, ONE SET OF STEPS — the once-offer after onboarding,
 *       Home's slim card and the Maker's What's left all open the same stage
 *       picker over the same steps, counted by the same derivation (PR-2: the
 *       setup's steps are walked in the stages that show them);
 *   (3) 🔓 THE UNLOCK LABELS — every step names what it turns on, "Unlocked"
 *       once it has, and the Maker's waiting parts read "Locked — finish ___"
 *       (filled in, never a paywall);
 *   (4) the steps are built from what is MISSING (an open event, locked venues).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  HUB_SETUP_LOCKED_SCENES,
  HUB_SETUP_STEPS,
  ONBOARDING_A_FIELDS,
  hubSetupApplies,
  hubSetupProgress,
  hubSetupRound,
  hubSetupSteps,
  lockedLine,
  unlockLine,
  type HubSetupFacts,
} from './hub-setup-steps';
import { buildGuidedPlan, firstOpenScreen, isUnfinished, stageSteps, type GuidedItem } from './details-guided-flow';
import { setupProgress } from './stage-setup';
import { DETAILS_ITEM_KEYS, FREE_PRINT_KEYS, type DetailsItemKey } from './maker-details-items';
import { pickHomeNext } from './home-first-screen';
import { makerEmptyPrompt } from './maker-scene-list';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const D = 'app/dashboard/[eventId]';

/** Every item a wedding's Details draws (as `details-guided-flow.test.ts` lists them). */
const WEDDING_ITEMS: DetailsItemKey[] = [
  'theme', 'mood-board', 'logo', 'hero', 'reveal',
  'names', 'date', 'venues', 'parents', 'march',
  'special-message', 'thank-you', 'opening-line', 'kindly-reply',
  'love-story', 'schedule', 'rsvp',
  'address', 'qr', 'invitation', 'entourage', 'details', 'menu', 'pass', 'poster', 'card',
  ...FREE_PRINT_KEYS,
  'download',
];
/** A wedding straight out of onboarding: A's facts filled (names, date, theme, colours, hero). */
const AFTER_A = new Set<DetailsItemKey>(['theme', 'mood-board', 'hero', 'names', 'date']);
const items = (done: (k: DetailsItemKey) => boolean | undefined = (k) => AFTER_A.has(k)): GuidedItem[] =>
  WEDDING_ITEMS.map((k) => ({ key: k, label: k, done: done(k) }));
const WORDS = { solemn: false, parentsOffered: true };

/** Nothing of B done yet; guests reply from a list; no venue locked. */
const FRESH: HubSetupFacts = {
  guestList: true,
  arrival: false,
  venuesLocked: { ceremony: false, reception: false },
  venuesNamed: { ceremony: false, reception: false },
  loveStoryMoments: 0,
  wear: false,
  replyBy: false,
  guests: 0,
};
const ALL_ITEMS = new Set<string>(WEDDING_ITEMS);

// ── (1) THE PREFILL GUARD ─────────────────────────────────────────────────

test('🔑 each setup step opens a real Maker Details item (or the Guest list), in THE MAP order', () => {
  assert.deepEqual(
    HUB_SETUP_STEPS.map((s) => s.map),
    ['B1', 'B2', 'B3', 'B4', 'B5–6', 'B7'],
  );
  for (const s of HUB_SETUP_STEPS) {
    if (s.item === null) {
      assert.equal(s.key, 'guests', 'only the guests\' names opens a page instead of an item');
      continue;
    }
    assert.ok((DETAILS_ITEM_KEYS as readonly string[]).includes(s.item), `${s.key}: "${s.item}" is not a Details item`);
  }
});

test('🔑 each setup step writes the field its Maker place already writes — never a copy', () => {
  /* Per step: the files that ARE its Maker place, and the field each must touch. */
  const rows: ReadonlyArray<{ step: string; files: string[]; field: RegExp }> = [
    // B1 → the Schedule (Details › Schedule is the shipped Schedule page) — its rows.
    { step: 'arrive', files: [`${D}/schedule/actions.ts`], field: /from\('event_schedule_blocks'\)\.insert/ },
    // B2 → the locked venues: the Venues item reads the confirmed bookings.
    { step: 'venues', files: [`${D}/launch/_components/details-your-event-facts.ts`], field: /loadVenueBookings/ },
    // B3 → the Love Story moments (`events.love_story`) — the Story row's own writer.
    { step: 'love-story', files: [`${D}/website/our-story/actions.ts`], field: /love_story:\s*merged/ },
    // B4 → the Mood Board's dress code: the Maker's Mood Board reads it drafted, the dress-code writer stamps it.
    { step: 'wear', files: [`${D}/studio/mood-board/_components/mood-board-editor.tsx`], field: /draftedEventColumn\(eventId, 'dress_code_config'\)/ },
    { step: 'wear', files: [`${D}/studio/mood-board/dress-code-actions.ts`], field: /dress_code_config:\s*config/ },
    // B5–6 → Details › RSVP: the questions (drafted) and the reply-by date.
    { step: 'ask', files: [`${D}/launch/_components/maker-rsvp-ask.tsx`], field: /rsvp_ask_config:\s*next/ },
    { step: 'ask', files: [`${D}/launch/_components/maker-rsvp-ask.tsx`], field: /'guest_list_edit_deadline'/ },
    // B7 → the Guest list, by the template import (#6225).
    { step: 'guests', files: [`${D}/guests/import/actions.ts`], field: /\.from\('guests'\)\s*\.insert/ },
  ];
  for (const r of rows) {
    assert.ok(HUB_SETUP_STEPS.some((s) => s.key === r.step), `${r.step}: no such step`);
    for (const f of r.files) assert.match(code(f), r.field, `${r.step}: ${f} does not write/read ${r.field}`);
  }
  // Every step is covered by a row above — a new step must name its writer here.
  for (const s of HUB_SETUP_STEPS) assert.ok(rows.some((r) => r.step === s.key), `${s.key}: no writer named in the prefill guard`);
});

test('🔑 the setup\'s "done" reads those very fields — the one derivation, never a second store', () => {
  const p = code(`${D}/launch/_components/details-guided-progress.ts`);
  assert.match(p, /block_type === 'pre_ceremony'/, 'arrival = a public "Guests arrive" moment');
  assert.match(p, /readGuestsReply\(input\.rsvpAsk\)/, 'the guest-list path is onboarding\'s own answer');
  assert.match(p, /dressCodeIsSet\(input\.dressCode\)/);
  assert.match(p, /guest_list_edit_deadline/);
  assert.match(p, /resolveMoments\(facts\.story\)/, 'the Love Story counted as the Maker counts it');
  // No setup-only table or column anywhere in the setup's code.
  for (const f of ['lib/hub-setup-steps.ts', `${D}/launch/_components/details-guided-progress.ts`]) {
    assert.ok(!/hub_setup|setup_progress|setup_steps/.test(code(f)), `${f}: a setup-only store`);
  }
});

test('🔑 a fact onboarding (A) asked is never a setup step', () => {
  const a = new Set(ONBOARDING_A_FIELDS);
  for (const s of HUB_SETUP_STEPS) {
    for (const w of s.writes) assert.ok(!a.has(w), `${s.key} writes "${w}", which onboarding already asked`);
  }
  // …and the list names what the shipped wedding commit really writes.
  const commit = code('app/onboarding/wedding/actions.ts');
  for (const col of ['bride_name', 'groom_name', 'ceremony_type', 'region', 'estimated_pax', 'budget_band', 'mood_feel_key', 'invite_theme']) {
    assert.match(commit, new RegExp(`\\b${col}:`), `the wedding commit no longer writes ${col}`);
    assert.ok(a.has(`events.${col}`), `${col} is onboarding's but missing from ONBOARDING_A_FIELDS`);
  }
  // rsvp_ask_config is ONE column split by key: onboarding writes who gets in, never a question.
  const insert = code('lib/onboarding/event-insert.ts');
  const setupRsvp = /const rsvp =([\s\S]*?);\n/.exec(insert)?.[1] ?? '';
  assert.match(setupRsvp, /guestsReply/);
  assert.ok(!/plus_ones|meal|dietary|song_request|note|mobile/.test(setupRsvp), 'onboarding now writes an RSVP question — the setup would re-ask it');
  // No step re-asks names, dates, the look, the estimate, the budget or how guests get in.
  const titles = HUB_SETUP_STEPS.map((s) => `${s.title} ${s.shows}`).join(' ').toLowerCase();
  for (const asked of ['your names', 'theme', 'colour', 'budget', 'how many guests', 'how do guests get in', 'cover photo']) {
    assert.ok(!titles.includes(asked), `a setup step asks "${asked}" again`);
  }
});

// ── (4) BUILT FROM WHAT IS MISSING ──────────────────────────────────────────

test('the steps are built from what is missing — open event, locked venues, items this event lacks', () => {
  assert.deepEqual(hubSetupSteps(FRESH, ALL_ITEMS).map((s) => s.key), ['arrive', 'venues', 'love-story', 'wear', 'ask', 'guests']);
  // Open event (one QR for everyone): no questions, no reply-by, no names.
  assert.deepEqual(
    hubSetupSteps({ ...FRESH, guestList: false }, ALL_ITEMS).map((s) => s.key),
    ['arrive', 'venues', 'love-story', 'wear'],
  );
  // Both venues locked (onboarding, or a booked supplier): the venue step is not drawn.
  assert.ok(!hubSetupSteps({ ...FRESH, venuesLocked: { ceremony: true, reception: true } }, ALL_ITEMS).some((s) => s.key === 'venues'));
  // One locked, one not: drawn, and still left.
  const half = hubSetupSteps({ ...FRESH, venuesLocked: { ceremony: false, reception: true }, venuesNamed: { ceremony: false, reception: true } }, ALL_ITEMS);
  assert.equal(half.find((s) => s.key === 'venues')?.state, 'left');
  // A type with no Love Story item: no Love Story step.
  const noStory = new Set([...ALL_ITEMS].filter((k) => k !== 'love-story'));
  assert.ok(!hubSetupSteps(FRESH, noStory).some((s) => s.key === 'love-story'));
  // An unread fact makes no claim.
  assert.equal(hubSetupSteps({ ...FRESH, arrival: null }, ALL_ITEMS)[0]!.state, 'check');
  // Wedding first.
  assert.equal(hubSetupApplies('wedding'), true);
  assert.equal(hubSetupApplies('birthday'), false);
});

test('🏛 B2 is done when each venue is LOCKED or has a TYPED name — the Hub\'s own rule (Lane 2, owner answer #3)', () => {
  const venues = (f: Partial<HubSetupFacts>) => hubSetupSteps({ ...FRESH, ...f }, ALL_ITEMS).find((s) => s.key === 'venues');
  // Both typed ("Enter your own" never locks): done — never "Next: Parish and reception" forever.
  assert.equal(venues({ venuesNamed: { ceremony: true, reception: true } })?.state, 'done');
  // One locked, the other typed: done.
  assert.equal(venues({ venuesLocked: { ceremony: true, reception: false }, venuesNamed: { ceremony: true, reception: true } })?.state, 'done');
  // One typed, the other neither: still left.
  assert.equal(venues({ venuesNamed: { ceremony: true, reception: false } })?.state, 'left');
  // Unread: no claim.
  assert.equal(venues({ venuesNamed: null })?.state, 'check');
  // The names are read off the Hub's resolver — locked first, typed as fallback; one place answers for both.
  const p = code(`${D}/launch/_components/details-guided-progress.ts`);
  assert.match(p, /venuesNamed: input\.venuesShown \? venuesNamedOf\(input\.venuesShown\) : null/);
  assert.match(p, /v\.role === role \|\| v\.role === 'both'/);
  assert.match(p, /venuesShown: ye \? ye\.venues : null/, 'Home reads the resolved venues (`resolveEventVenues`)');
  assert.match(code(`${D}/launch/page.tsx`), /venuesShown: yourEvent \? yourEvent\.venues\.resolved : null/, 'the Maker reads the resolved venues');
  assert.match(code(`${D}/launch/_components/details-your-event-facts.ts`), /const venues = resolveEventVenues\(bookings, row\)/);
});

// ── (2) THREE DOORS, ONE SET OF STEPS ──────────────────────────────────────

test('🚪 the Maker\'s What\'s left walks the setup in the stages that show it — the very steps, one step per item', () => {
  const facts: HubSetupFacts = { ...FRESH, arrival: true, loveStoryMoments: 2 };
  const steps = hubSetupSteps(facts, ALL_ITEMS);
  const plan = buildGuidedPlan(items(), WORDS, hubSetupRound(facts, ALL_ITEMS));
  // 🗂 Owner 2026-10-04 (PR-2): the setup is no longer a round of its own — each
  // setup step is walked in every stage whose parts show its fact.
  const of = (k: string) => plan.steps.find((s) => s.key === k);
  assert.deepEqual(of('arrive')?.stages, ['rsvp', 'event'], 'when guests arrive is not the Schedule’s');
  assert.deepEqual(of('venues')?.stages, ['rsvp', 'event']);
  assert.deepEqual(of('love-story')?.stages, ['save_the_date', 'rsvp']);
  assert.deepEqual(of('wear')?.stages, ['rsvp'], 'what everyone wears is not the Dress code’s');
  assert.deepEqual(plan.links.map((l) => [l.key, l.stages]), [['guests', ['rsvp', 'event']]], 'each guest’s own greeting shows on the Invitation and The Day');
  // Every setup step with a part is in the plan; B5–6 is the RSVP stage's own three settings.
  for (const s of steps) {
    if (s.key === 'ask') continue;
    assert.ok(of(s.key) || plan.links.some((l) => l.key === s.key), `${s.key} left the plan`);
  }
  assert.equal(of('ask'), undefined, 'B5–6 is a second step on the RSVP item');
  assert.deepEqual(stageSteps(plan, 'rsvp-stage').map((s) => s.key), ['who', 'rsvp', 'reply-by']);
  // How guests get in is onboarding's answer — asked once, never again; the reply-by date is B5–6's own fact.
  assert.equal(of('who')?.state, 'done');
  assert.equal(of('reply-by')?.state, 'left');
  assert.equal(buildGuidedPlan(items(), WORDS, hubSetupRound({ ...facts, replyBy: true }, ALL_ITEMS)).steps.find((s) => s.key === 'reply-by')?.state, 'done');
  // Each setup item is ONE step — the row it stands for is gone.
  assert.equal(of('schedule'), undefined, 'the Schedule row stayed beside when guests arrive');
  assert.equal(of('colours'), undefined, 'Your colours stayed beside what everyone wears');
  for (const s of plan.steps.filter((x) => !x.piece)) {
    for (const k of s.items) assert.equal(plan.steps.filter((x) => !x.piece && x.items.includes(k)).length, 1, `${k} is in two steps`);
  }
  // Home counts the plan the Maker walks (every fact once), and the picker opens on `?guide=1`.
  assert.equal(setupProgress(plan).total, plan.steps.length + plan.links.length);
  assert.equal(setupProgress(plan).next, 'save_the_date', 'names are still to do — Save the Date first');
  assert.equal(isUnfinished(plan), true);
  // An open event (one QR for everyone): the RSVP stage asks only how guests get in.
  const open = buildGuidedPlan(items(), WORDS, hubSetupRound({ ...facts, guestList: false }, ALL_ITEMS));
  assert.deepEqual(stageSteps(open, 'rsvp-stage').map((s) => s.key), ['who']);
  assert.deepEqual(open.links, [], 'an open event is asked for guests’ names');
  // No setup (another type, or the facts unread): the generic rows, as before.
  const before = buildGuidedPlan(items(), WORDS);
  assert.ok(before.steps.some((s) => s.key === 'schedule') && before.steps.some((s) => s.key === 'colours'));
  assert.deepEqual(before.links, []);
});

test('🚪 only the guests\' names left: the Invitation opens on that step\'s own screen, which links to the import', () => {
  const facts: HubSetupFacts = {
    ...FRESH,
    arrival: true,
    venuesLocked: { ceremony: true, reception: true },
    loveStoryMoments: 1,
    wear: true,
    replyBy: true,
  };
  const all = new Set<DetailsItemKey>([...AFTER_A, 'venues', 'love-story', 'schedule', 'logo', 'parents', 'march', 'special-message']);
  const plan = buildGuidedPlan(items((k) => (all.has(k) ? true : undefined)), WORDS, hubSetupRound(facts, ALL_ITEMS));
  // 2026-10-05 (owner: Skip jumped past it): the guests' names is a screen of the walk.
  assert.deepEqual(firstOpenScreen(plan, 'rsvp'), { kind: 'link', link: 'guests', round: 'rsvp' });
  assert.equal(setupProgress(plan).next, 'rsvp');
  const ready = code(`${D}/launch/_components/details-guide.tsx`);
  assert.match(ready, /href=\{actions\.guestsHref\}/);
  assert.match(code(`${D}/launch/_components/details-workspace.tsx`), /href=\{guide\?\.actions\.guestsHref \?\? null\}/, 'the link step’s screen does not open the import');
  assert.match(code(`${D}/launch/page.tsx`), /guestsHref: hubSetupGuestsHref\(eventId\)/);
});

test('🚪 the three doors open the SAME address, read through the SAME derivation', () => {
  // Door 2 (Home's slim card) and door 1 (the once-offer's Start) are the one Next card's link.
  const home = code(`${D}/_components/home-first-screen.tsx`);
  assert.match(home, /kind: 'guide', href: `\/dashboard\/\$\{eventId\}\/launch\?tool=details&guide=1`/);
  assert.equal((home.match(/<NextCard/g) ?? []).length, 1, 'the offer is the Next card itself — not a second door');
  assert.match(home, /later=\{next\.offer \?/);
  // Door 3 (the Maker's What's left) is what `?guide=1` opens (`parseGuideParam`).
  // Both pages derive the setup from ONE function.
  const launch = code(`${D}/launch/page.tsx`);
  const progress = code(`${D}/launch/_components/details-guided-progress.ts`);
  assert.match(launch, /setupFacts = hubSetupFactsFrom\(/);
  // The Maker's decision to open on What's left counts the setup too…
  const decides = launch.slice(launch.indexOf('detailsUnfinished = isUnfinished('), launch.indexOf('const detailsLandsPlain'));
  assert.match(decides, /setup: setupRoundFor\(setupFacts,/, 'the Maker decides to open What\'s left without the setup');
  // …and Details draws the same plan.
  assert.match(launch, /setup: setupFacts,\s*guestsHref:/);
  assert.match(progress, /setup = hubSetupFactsFrom\(/);
  assert.match(progress, /guidedPlanFromFacts\(\{[\s\S]*?setup: setupRoundFor\(setup, present, ctx\)/);
  // The Maker's Details builds the round over its own navigator rows.
  assert.match(code(`${D}/launch/_components/maker-details.tsx`), /props\.guide\.setup \? hubSetupRound\(props\.guide\.setup,/);
  // The step table never rides in the Maker's first load: the plan module takes types only.
  assert.match(code('lib/details-guided-flow.ts'), /import type \{ HubSetupRound, HubSetupStepKey \} from '@\/lib\/hub-setup-steps'/);
  assert.ok(!/from '@\/lib\/hub-setup-steps'/.test(code('lib/maker-scene-list.ts')), 'the canvas list pulls the whole step table');
  // Home's card reads the plan the Maker draws (`readGuidedPlan`).
  assert.match(code(`${D}/_components/details-guide-home-card.tsx`), /readGuidedPlan\(/);
});

test('🚪 Home\'s card reads "Finish your Event Hub — n of m · Pick a stage", and the once-offer "Start / Later"', () => {
  const base = { done: 9, total: 20, stageTitle: 'Invitation', stageDone: 4, stageTotal: 8 };
  const card = pickHomeNext({ guide: base, hasDate: true, guests: null, noun: 'wedding', papicReady: false, aiOffer: false });
  assert.equal(card.title, 'Finish your Event Hub — 9 of 20');
  assert.equal(card.body, 'Next: Invitation — 4 of 8 in place');
  // The button names the action (owner, live phone test 2026-10-02): it opens the stage picker (PR-2).
  assert.equal(card.action, 'Pick a stage');
  assert.equal(card.offer, undefined);
  const offer = pickHomeNext({ guide: { ...base, done: 0, offer: true }, hasDate: true, guests: null, noun: 'wedding', papicReady: false, aiOffer: false });
  assert.equal(offer.action, 'Start');
  assert.equal(offer.offer, true);
  // Later answers the offer through the SHIPPED tour action — no new server action.
  const home = code(`${D}/_components/home-first-screen.tsx`);
  assert.match(home, /completeTour\.bind\(null, HUB_SETUP_OFFER_TOUR\)/);
  // Start opens What's left, whose first-visit tour marks the same key seen.
  assert.match(code('lib/tours.ts'), /HUB_SETUP_OFFER_TOUR: TourKey = 'customer_details_guided_v1'/);
  assert.match(code(`${D}/launch/page.tsx`), /<MiniTour tourKey="customer_details_guided_v1"/);
  assert.match(offer.body, /we won’t ask again/);
  // Home's numbers are the picker's: the same plan, every fact once, the stage's own.
  const read = code(`${D}/_components/details-guide-home-card.tsx`);
  assert.match(read, /const whole = setupProgress\(plan\);/);
  assert.match(read, /stageProgress\(plan, whole\.next\)/);
});

// ── (3) THE UNLOCK LABELS ───────────────────────────────────────────────────

test('🔓 every step names what it unlocks — "Unlocked" once done, and never a price', () => {
  for (const s of HUB_SETUP_STEPS) {
    assert.ok(s.unlocks.trim().length > 0, `${s.key}: no unlock line`);
    assert.equal(unlockLine(s, 'left'), `Unlocks: ${s.unlocks}.`);
    assert.equal(unlockLine(s, 'check'), `Unlocks: ${s.unlocks}.`);
    assert.equal(unlockLine(s, 'done'), `Unlocked: ${s.unlocks}.`);
    assert.ok(!/₱|\bpro\b|\bbuy\b|\bpay|\bpaid\b|upgrade/i.test(`${s.unlocks} ${s.title} ${s.shows}`), `${s.key}: an unlock is filled in, never paid`);
  }
  assert.equal(lockedLine('Love Story'), 'Locked — finish Love Story');
  // The plan carries each step's line; the step heading draws it.
  const plan = buildGuidedPlan(items(), WORDS, hubSetupRound({ ...FRESH, arrival: true }, ALL_ITEMS));
  assert.equal(plan.steps.find((s) => s.key === 'arrive')?.unlocks, unlockLine(HUB_SETUP_STEPS[0]!, 'done'));
  assert.equal(plan.steps.find((s) => s.key === 'wear')?.unlocks, unlockLine(HUB_SETUP_STEPS[3]!, 'left'));
  assert.match(code(`${D}/launch/_components/details-guide.tsx`), /data-details-guide-unlocks=/);
});

test('🔓 the Maker\'s waiting parts read "Locked — finish ___" (its empty-scene mechanism, not a second one)', () => {
  assert.equal(makerEmptyPrompt('our_love_story', true), 'Locked — finish Love Story.');
  assert.equal(makerEmptyPrompt('venue_map', true), 'Locked — finish your venues.');
  assert.equal(makerEmptyPrompt('schedule', true), 'Locked — finish your Schedule.');
  for (const t of Object.keys(HUB_SETUP_LOCKED_SCENES)) assert.match(makerEmptyPrompt(t as 'schedule', true), /^Locked — finish /);
  // A scene no setup step unlocks keeps its own prompt.
  assert.ok(!/^Locked/.test(makerEmptyPrompt('special_message', true)));
});

test('🔓 a lock only where there is a door: no "Locked — finish" on a type without the setup', () => {
  // Off by default — the previous empty prompts, word for word.
  assert.equal(makerEmptyPrompt('our_love_story'), 'Add your story.');
  assert.equal(makerEmptyPrompt('venue_map'), 'Add your venue.');
  assert.equal(makerEmptyPrompt('schedule'), 'Add the moments of your day in Schedule.');
  for (const t of Object.keys(HUB_SETUP_LOCKED_SCENES)) assert.ok(!/Locked/.test(makerEmptyPrompt(t as 'schedule')), `${t} locks with no setup`);
  // Both places that draw the prompt ask the ONE rule (`hubSetupApplies`) of the event's own type.
  assert.match(code('app/[slug]/_components/public-hideable-widget.tsx'), /setupLocks=\{hubSetupApplies\(props\.event\.event_type\)\}/);
  assert.match(code('app/[slug]/_components/maker-empty-scene.tsx'), /makerEmptyPrompt\(type, setupLocks\)/);
  assert.match(code(`${D}/website/editor/page.tsx`), /setupLocks: hubSetupApplies\(/);
  assert.match(code('lib/maker-scene-list.ts'), /makerEmptyPrompt\(w\.widget_type, input\.setupLocks === true\)/);
  assert.equal(hubSetupApplies('birthday'), false);
  assert.equal(hubSetupApplies('wake'), false);
});
