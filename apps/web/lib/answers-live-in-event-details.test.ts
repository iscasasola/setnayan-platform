/**
 * answers-live-in-event-details.test.ts — every onboarding answer has ONE home,
 * shows in Your info, and the app OBEYS it.
 *
 * ⚖ Owner 2026-10-02 (DECISION_LOG "EVERY ANSWER ABOUT AN EVENT LIVES IN EVENT
 * DETAILS ("YOUR INFO") — ONE HOME, MAPPED"): *"when questions are asked, and
 * information is placed, let us place them all to there so everything is
 * mapped properly"*. The four answers that used to sit unread in
 * `style_preferences.setup` — Papic, gifts, logo, event photo — each have a
 * column (`lib/event-answers.ts`), a Your info row, and a consumer.
 *
 * The rule each test holds is MOVE THE INPUT → THE OUTPUT MOVES: the same event,
 * only the answer changed, and the thing the answer governs changes with it.
 * Where the consumer cannot be imported here (`server-only` is not installed in
 * this repo, so a module carrying it cannot be loaded by a test), the decision
 * is a pure function exercised directly AND the call site is held to calling it.
 *
 * SABOTAGE (each run once, 2026-10-02 — see the PR body):
 *   · `rowAcceptsNewCaptures` without its papic_on line → "Papic No takes no shot" red;
 *   · `welcomeCarriesGifts` without `|| input.giftsOff` → "Gifts No: the Maker draws no gift place" red;
 *   · `guidedFactsFrom` back to the bare logo test → "the logo answer is obeyed by What's left" red;
 *   · `setupColumns` storing the whole answers again → "no copy" red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { profileSetup, toProfile, type ProfileRow } from '@/lib/event-type-profile';
import { pickableInviteThemes } from '@/lib/invite-themes';
import { setupViewFor } from './onboarding/flow-config';
import { sanitizeSetupAnswers, setupDefaults, setupLanding, type SetupAnswers, type SetupView } from './onboarding/setup-answers';
import { setupColumns } from './onboarding/event-insert';
import {
  EVENT_ANSWER_COLUMNS,
  answerKeyOf,
  answerSub,
  answerValueOf,
  coverChoices,
  coverStepAnswered,
  giftsAreOn,
  giftsChoices,
  logoChoices,
  logoStepAnswered,
  papicChoices,
  papicIsOn,
  setupArmsPapic,
  type EventAnswerColumn,
} from './event-answers';
import { rowAcceptsNewCaptures } from './event-accepts-captures-rule';
import { welcomeParts } from './invitation-welcome';
import { buildGuidedPlan, stepOf } from './details-guided-flow';
import { eventColumnChange, eventItemIsPro, HUB_DRAFT_EVENT_LABEL, isHubDraftEventColumn, sanitizeHubDraftEventValue } from './hub-draft';
import { DETAILS_ITEM_GROUPS, detailsItemHref } from './maker-details-items';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function row(eventType: string, extra: Partial<ProfileRow>): ProfileRow {
  return {
    event_type: eventType,
    terminology: { register: 'celebratory' },
    enabled_surfaces: null,
    marketplace_enabled: null,
    event_class: null,
    layer_mode: null,
    multi_day: null,
    onboarding_flow_key: eventType,
    role_set_key: null,
    template_pack_key: null,
    monogram_set_key: null,
    reveal_pack_key: null,
    budget_taxonomy_key: null,
    schedule_seed_key: null,
    statutory_pack_key: null,
    ...extra,
  };
}
const BIRTHDAY = toProfile(row('birthday', { role_set_key: 'birthday', guest_word: 'guests', gifts_mode: 'gifts', look_set: ['whimsical', 'house'], camera_default: 'on' }));
const VIEW: SetupView = setupViewFor(BIRTHDAY, profileSetup(BIRTHDAY), pickableInviteThemes());

/** The onboarding as a couple answers it, re-read through the commit's own sanitizer. */
function onboard(patch: Partial<SetupAnswers>): SetupAnswers {
  const a = sanitizeSetupAnswers({ ...setupDefaults(VIEW), guests: 'later', ...patch }, VIEW);
  assert.ok(a, 'the commit refused the answers');
  return a;
}

/* ══ ROUND TRIP — onboarding → the column → Your info shows the same answer ══ */

test('round trip: every choice the onboarding card offers comes back in Your info as the same choice, in the same words', () => {
  const cases: Array<{ key: 'papic' | 'gifts' | 'logo' | 'photo'; column: EventAnswerColumn; choices: readonly { key: string; label: string }[] }> = [
    { key: 'papic', column: 'papic_on', choices: papicChoices() },
    { key: 'gifts', column: 'gifts_on', choices: giftsChoices() },
    { key: 'logo', column: 'logo_wanted', choices: logoChoices(false) },
    { key: 'photo', column: 'cover_photo_wanted', choices: coverChoices(false) },
  ];
  let checked = 0;
  for (const c of cases) {
    for (const choice of c.choices) {
      const answers = onboard({ [c.key]: choice.key } as Partial<SetupAnswers>);
      const stored = setupColumns(answers).answers[c.column];
      // What Your info's dropdown shows for the stored column…
      const shown = answerKeyOf(c.column, stored);
      assert.equal(shown, choice.key, `${c.key}: "${choice.label}" came back as "${shown}"`);
      // …in the onboarding card's own words…
      assert.equal(answerSub(c.choices, shown), choice.label);
      // …and picking it in Your info writes the same value back.
      assert.equal(answerValueOf(c.column, shown), stored);
      checked += 1;
    }
  }
  assert.equal(checked, 8, 'two choices for each of the four answers');
});

test('no copy: the commit writes each answer to its column and NOT into style_preferences.setup', () => {
  const cols = setupColumns(onboard({ papic: 'no', gifts: 'yes', logo: 'yes', photo: 'upload' }));
  assert.deepEqual(cols.answers, { papic_on: false, gifts_on: true, logo_wanted: true, cover_photo_wanted: true });
  for (const k of ['papic', 'gifts', 'logo', 'photo']) {
    assert.ok(!(k in cols.setup), `the ${k} answer is still copied into the blob`);
  }
  // Every other answer stays in the blob Home's "Set up" line reads.
  assert.equal(cols.setup.guests, 'later');
  // …and all three commits put the columns on the insert.
  for (const rel of ['lib/onboarding/event-insert.ts', 'app/onboarding/wedding/actions.ts', 'app/onboarding/simple/actions.ts']) {
    assert.match(read(rel), /\.\.\.\(setup \? setup\.answers : \{\}\)/, `${rel} no longer writes the answers' columns`);
  }
});

test('never asked is not "No": Papic and gifts stay on; the logo and the photo stay unanswered', () => {
  assert.equal(papicIsOn(null), true);
  assert.equal(giftsAreOn(undefined), true);
  assert.equal(answerKeyOf('papic_on', null), 'yes');
  assert.equal(answerKeyOf('gifts_on', null), 'yes');
  assert.equal(answerKeyOf('logo_wanted', null), '', 'the dropdown names no choice nobody made');
  assert.equal(answerKeyOf('cover_photo_wanted', null), '');
});

/* ══ PAPIC ══ */

test('Papic No: no free pool is armed at the commit — in every onboarding path', () => {
  assert.equal(setupArmsPapic(onboard({ papic: 'yes' })), true);
  assert.equal(setupArmsPapic(onboard({ papic: 'no' })), false);
  assert.equal(setupArmsPapic(null), true, 'a commit with no answers arms, as before');
  for (const rel of ['app/onboarding/_shared/commit-event.ts', 'app/onboarding/wedding/actions.ts', 'app/onboarding/simple/actions.ts']) {
    const src = read(rel);
    const gate = src.search(/if \(setupArmsPapic\(/);
    assert.ok(gate > 0, `${rel} arms Papic without asking the answer`);
    const pool = src.indexOf('ensureFreePapicPoolGrantAdmin(admin', gate);
    const camera = src.indexOf('ensureFreePapicOneCameraAdmin(admin', gate);
    const close = src.indexOf('\n  }\n', gate);
    assert.ok(pool > gate && pool < close && camera > gate && camera < close, `${rel}: both grants must sit inside the answer's gate`);
  }
});

test('Papic No takes no shot (the capture gate) — Yes and never-asked do', () => {
  assert.equal(rowAcceptsNewCaptures({ archived: false, papic_on: false }, false), false, 'No must close the shutter');
  assert.equal(rowAcceptsNewCaptures({ archived: false, papic_on: true }, false), true);
  assert.equal(rowAcceptsNewCaptures({ archived: false, papic_on: null }, false), true, 'never asked = on');
  assert.equal(rowAcceptsNewCaptures(null, true), true, 'an unread row still fails open');
  assert.match(read('lib/event-accepts-captures.ts'), /\.select\('archived, papic_on'\)/, 'the gate no longer reads the answer');
});

test('Papic No closes the guest camera door for every caller; Yes turns it back on and arms the grants at Apply', () => {
  const guest = read('lib/papic-guest.ts');
  const access = guest.slice(guest.indexOf('export async function eventPapicGuestAccess'));
  assert.match(access, /select\('papic_on'\)/);
  const off = access.search(/!papicIsOn\(/);
  assert.ok(off > 0 && off < access.indexOf('owned.some(Boolean)'), 'a purchase must not reopen a camera the host said No to');
  const apply = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(apply, /if \(eventsPatch\.papic_on === true\) \{[\s\S]{0,120}ensureFreePapicPoolGrantAdmin\(admin, eventId\);\s*await ensureFreePapicOneCameraAdmin\(admin, eventId\);/);
  // The studio's self-heal leaves an answered-No event unarmed.
  assert.match(read('app/dashboard/[eventId]/studio/papic/page.tsx'), /if \(!papicAnsweredNo\) \{\s*await ensureFreePapicPoolGrantAdmin\(unlockAdmin, eventId\);/);
});

/* ══ GIFTS ══ */

test('Gifts No: the Maker draws no gift place; Yes does', () => {
  const base = { stage: 'rsvp' as const, bodyNormal: true, scenes: [], identified: false, reminders: null, giftHref: null, maker: true };
  assert.ok(welcomeParts(base).includes('gifts'), 'gifts on: the couple sees the place to fill');
  assert.ok(!welcomeParts({ ...base, giftsOff: true }).includes('gifts'), 'gifts No: still drawn');
  // …and a guest's door follows the same answer.
  assert.ok(!welcomeParts({ ...base, maker: false, giftHref: '/x/pabuya', giftsOff: true }).includes('gifts'));
  assert.ok(welcomeParts({ ...base, maker: false, giftHref: '/x/pabuya' }).includes('gifts'));
  assert.match(read('lib/maker-scene-list.ts'), /giftsOff: input\.giftsOff,/);
  assert.match(read('app/dashboard/[eventId]/website/editor/page.tsx'), /giftsOff: \(drafted as \{ gifts_on\?: boolean \| null \}\)\.gifts_on === false/);
  assert.match(read('app/[slug]/_components/site-body.tsx'), /giftsOff: event\.gifts_on === false,/);
});

test('Gifts No: the guest-facing gift reader returns nothing, and the gift page is not there', () => {
  assert.equal(giftsAreOn(false), false);
  assert.equal(giftsAreOn(true), true);
  const egift = read('lib/egift.ts');
  const fetcher = egift.slice(egift.indexOf('export async function fetchEgiftMethods'));
  assert.match(fetcher, /opts\.enabledOnly\s*\?\s*supabase\.from\('events'\)\.select\('gifts_on'\)/);
  assert.match(fetcher, /!giftsAreOn\([\s\S]{0,80}?\.gifts_on\)\) \{\s*return \[\];/);
  assert.match(read('app/[slug]/pabuya/page.tsx'), /if \(!giftsAreOn\(event\.gifts_on\)\) notFound\(\);/);
});

/* ══ LOGO · EVENT PHOTO — obeyed at the landing, then by What's left ══ */

test('"Yes, make one" lands in the Logo maker; "Upload a photo" lands where the photo goes; the guests card still comes first', () => {
  const E = 'E1';
  assert.equal(setupLanding(E, onboard({ logo: 'yes', photo: 'upload' })), detailsItemHref(E, 'logo'), 'the logo flow starts right after onboarding');
  assert.equal(setupLanding(E, onboard({ logo: 'no', photo: 'upload' })), detailsItemHref(E, 'hero'), 'the photo is prompted where it is added');
  assert.equal(setupLanding(E, onboard({ logo: 'no', photo: 'theme' })), `/dashboard/${E}`, 'nothing promised: Home');
  assert.equal(setupLanding(E, onboard({ logo: 'yes', guests: 'type' })), `/dashboard/${E}/guests/new`, 'adding guests now wins');
});
/* ══ LOGO · EVENT PHOTO — and obeyed by What's left (after the landing) ══ */

function stepState(key: 'logo' | 'hero', done: boolean): string | undefined {
  const plan = buildGuidedPlan([{ key, label: '', done }], { solemn: false, parentsOffered: false });
  return stepOf(plan, key)?.state;
}

test('the logo answer is obeyed by What\'s left: "Make one" keeps the step open, "Use our names" answers it', () => {
  assert.equal(stepState('logo', logoStepAnswered(false, true)), 'left', '"Yes, make one" with no logo yet: the Logo flow is still waiting');
  assert.equal(stepState('logo', logoStepAnswered(false, false)), 'done', '"No, use our names": nothing to make');
  assert.equal(stepState('logo', logoStepAnswered(true, true)), 'done', 'a logo was made');
  assert.match(read('app/dashboard/[eventId]/launch/_components/details-guided-progress.ts'), /logo: logoStepAnswered\([^\n]*col\('logo_wanted'\)\)/);
});

test('the photo answer is obeyed by What\'s left: "Upload a photo" keeps First screen open until one is up', () => {
  assert.equal(stepState('hero', coverStepAnswered(false, true)), 'left');
  assert.equal(stepState('hero', coverStepAnswered(false, false)), 'done', '"Use a theme picture for now" answers it');
  assert.equal(stepState('hero', coverStepAnswered(true, true)), 'done');
  assert.match(read('app/dashboard/[eventId]/launch/_components/details-guided-progress.ts'), /hero: coverStepAnswered\([^\n]*col\('cover_photo_wanted'\)\)/);
  // The Maker's and Home's reads carry the two columns (`readPrintEvent`).
  assert.match(read('lib/print-set.server.ts'), /papic_on, gifts_on, logo_wanted, cover_photo_wanted';/);
});

/* ══ YOUR INFO — the rows, and the Maker's rule: a draft until Apply ══ */

test('each answer is a Maker draft: kept as a yes or a no, never Pro, named on the Apply sheet', () => {
  for (const c of EVENT_ANSWER_COLUMNS) {
    assert.ok(isHubDraftEventColumn(c), `${c} is not draftable — Your info could not change it`);
    assert.equal(sanitizeHubDraftEventValue(c, false), false);
    assert.equal(sanitizeHubDraftEventValue(c, true), true);
    assert.equal(sanitizeHubDraftEventValue(c, 'no'), undefined, 'a string is not an answer');
    assert.equal(eventItemIsPro(c, true, 'change'), false);
    assert.ok(HUB_DRAFT_EVENT_LABEL[c].length > 0);
  }
  // Moving the answer is a change; never asked → Yes is not (Papic and gifts are on until a No).
  assert.equal(eventColumnChange('papic_on', null, false), 'change');
  assert.equal(eventColumnChange('papic_on', null, true), 'none');
  assert.equal(eventColumnChange('logo_wanted', null, true), 'add');
});

test('Your info carries the rows, and every row writes its own column through the one draft door', () => {
  const event = DETAILS_ITEM_GROUPS.find((g) => g.group === 'event')!;
  /* 🗂 2026-10-06 ("EVENT DETAILS IS REBUILT"): Gifts is a field of the Your event
     form (E-Gifts); Photos from guests left the list for The Day — still an item
     (the guided flow's step opens it), never a row. */
  assert.ok(event.keys.includes('gifts'), 'Your event lost the gifts row');
  const elsewhere = DETAILS_ITEM_GROUPS.find((g) => g.group === 'elsewhere')!;
  assert.ok(elsewhere.hidden && elsewhere.keys.includes('papic'), 'Photos from guests is no longer addressable');
  // Event settings LEFT the Maker (2026-10-02): its editors save live, and nothing
  // in the Maker may take effect before Apply. They live on the Event Details page.
  assert.ok(!(event.keys as readonly string[]).includes('settings'), 'Event settings is back in the Maker — it saves live, not at Apply');
  const parts = read('app/dashboard/[eventId]/launch/_components/details-answers-parts.tsx');
  for (const c of EVENT_ANSWER_COLUMNS) {
    assert.match(parts, new RegExp(`<AnswerPicker eventId=\\{eventId\\} column="${c}"`), `${c} has no dropdown in Your info`);
  }
  const picker = read('app/dashboard/[eventId]/launch/_components/details-answers.tsx');
  assert.match(picker, /<PickMenu\b/, 'a set of choices is one dropdown');
  assert.match(picker, /makerSave\(\(\) => hubDraftAction\(eventId, fd\), requestMakerRefresh\)/, 'an answer must wait for Apply like every Maker edit');
  assert.doesNotMatch(picker, /['"]use server['"]/, 'no new server action');
  // The logo and photo answers ride on the items they are about.
  const details = read('app/dashboard/[eventId]/launch/_components/maker-details.tsx');
  assert.match(details, /logoA\.node/);
  assert.match(details, /coverA\.node/);
});
