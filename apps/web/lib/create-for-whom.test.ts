/**
 * "For ▾" on the create-event grid — WHO a type can be for (owner 2026-10-26).
 *
 * Owner, verbatim: "if i click for you, and it i don't have a debut, it should not show. same concept to the
 * christening, wake, and whatever is not needed for that person. if it is for you, the name of the celebrant should
 * automatically be me … If it is for a business, only business related events … For someone else, shows
 * everything." · "wake is if your declared passed away. so the event you can only make is anniversary or
 * wake/funeral." · "debut 17-18 woman, 20-21 men. so if no gender for 17-21."
 *
 * Three halves, each held here:
 *  1. the RULE is data (`event_type_vocab.for_whom` → `EventTypeRow.forWhom`) and the grid reads it — one source;
 *  2. the debut AGE BAND, with every missing fact failing OPEN (shown);
 *  3. the celebrant is filled per answer — you by name, a shop by its name, a stranger asked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BUSINESS_SUBJECT_ID,
  buildBusinessSubject,
  buildCreateRoster,
  buildMemorialSubject,
  buildSelfSubject,
  buildUnspecifiedSubject,
  dependentSubjects,
  forWhomHiddenTypes,
  forWhomModeOf,
  gridHiddenTypes,
  selfCelebrantName,
  subjectHonoreeDependentId,
  subjectHonoreeLabel,
} from './create-subjects';
import { debutConcernsBirthdate } from './life-event-gate';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const TODAY = '2026-10-26';

/** A roster shaped like production's, rule as the migration seeds it. Keys are only fixtures here. */
const ROWS = [
  { key: 'wedding', forWhom: ['self', 'someone'] },
  { key: 'debut', forWhom: ['self', 'someone'] },
  { key: 'christening', forWhom: ['someone'] },
  { key: 'anniversary', forWhom: ['self', 'someone', 'memorial', 'business'] },
  { key: 'corporate', forWhom: ['someone', 'business'] },
  { key: 'gala_night', forWhom: ['self', 'someone', 'business'] },
  { key: 'wake', forWhom: ['memorial'] },
  { key: 'admin_new', forWhom: null }, // the fallback roster / a row read before the column
];
const shown = (subject: Parameters<typeof forWhomHiddenTypes>[1]) => {
  const hidden = forWhomHiddenTypes(ROWS, subject);
  return ROWS.map((r) => r.key).filter((k) => !hidden.includes(k));
};

// ── 1. the rule ──────────────────────────────────────────────────────────────
test('For you: no christening, no wake — everything else that can be yours', () => {
  // Corporate is a business's own (owner on #6974, 2026-10-27) — not offered "for you".
  assert.deepEqual(shown(buildSelfSubject('Ice')), ['wedding', 'debut', 'anniversary', 'gala_night', 'admin_new']);
});

test('Someone else (living): everything but a wake', () => {
  assert.deepEqual(shown(buildUnspecifiedSubject()), ['wedding', 'debut', 'christening', 'anniversary', 'corporate', 'gala_night', 'admin_new']);
});

test('Someone who passed away: only an anniversary and a wake', () => {
  assert.deepEqual(shown(buildMemorialSubject()), ['anniversary', 'wake', 'admin_new']);
});

test('A business: only what a business throws', () => {
  assert.deepEqual(shown(buildBusinessSubject('Aling Nena’s Store')), ['anniversary', 'corporate', 'gala_night', 'admin_new']);
});

test('a loved one on file reads "someone"; a shop alaga reads "business"', () => {
  const [lola, shop] = dependentSubjects(
    [
      { dependent_id: 'd1', name: 'Lola', dependent_kind: 'person', birth_date: null, sex: null },
      { dependent_id: 'd2', name: 'My Shop', dependent_kind: 'business', birth_date: null, sex: null },
    ],
    null,
  );
  assert.equal(forWhomModeOf(lola!), 'someone');
  assert.equal(forWhomModeOf(shop!), 'business');
});

test('unknown rule fails OPEN, and no subject (samahan, QR fast-lane) folds nothing', () => {
  for (const s of [buildSelfSubject('A'), buildMemorialSubject(), buildBusinessSubject(null)]) {
    assert.ok(!forWhomHiddenTypes(ROWS, s).includes('admin_new'));
  }
  assert.deepEqual(forWhomHiddenTypes(ROWS, null), []);
});

// ── 2. the debut age band ────────────────────────────────────────────────────
/** A birthdate that makes someone exactly `age` today (well inside the year). */
const bornAged = (age: number) => `${2026 - age}-03-01`;

test('debut: women 17–18', () => {
  for (const [age, want] of [[16, false], [17, true], [18, true], [19, false]] as const) {
    assert.equal(debutConcernsBirthdate(bornAged(age), 'female', TODAY), want, `female ${age}`);
  }
});

test('debut: men 20–21', () => {
  for (const [age, want] of [[19, false], [20, true], [21, true], [22, false]] as const) {
    assert.equal(debutConcernsBirthdate(bornAged(age), 'male', TODAY), want, `male ${age}`);
  }
});

test('debut: sex unknown (or not consented) → 17–21', () => {
  for (const [age, want] of [[16, false], [17, true], [19, true], [21, true], [22, false]] as const) {
    assert.equal(debutConcernsBirthdate(bornAged(age), null, TODAY), want, `unknown ${age}`);
  }
});

test('For you: a 30-year-old folds the debut; no birth date on file SHOWS it', () => {
  const me30 = buildSelfSubject('Ice', { birth_date: bornAged(30), sex: 'male' });
  assert.ok(gridHiddenTypes(me30, [], TODAY).includes('debut'), 'no debut for a 30-year-old');
  const noDate = buildSelfSubject('Ice', { birth_date: null, sex: 'female' });
  assert.ok(!gridHiddenTypes(noDate, [], TODAY).includes('debut'), 'missing birth date → shown, never guessed');
  const teen = buildSelfSubject('Bea', { birth_date: bornAged(18), sex: 'female' });
  assert.ok(!gridHiddenTypes(teen, [], TODAY).includes('debut'), 'an 18-year-old woman keeps her own debut');
});

test('a loved one with a known age and sex is measured the same way', () => {
  const [boy19] = dependentSubjects(
    [{ dependent_id: 'd3', name: 'Jun', dependent_kind: 'person', birth_date: bornAged(19), sex: 'male' }],
    null,
  );
  assert.ok(gridHiddenTypes(boy19!, [], TODAY).includes('debut'), 'a 19-year-old man is not yet 20');
});

test('the create page passes sex ONLY with its consent stamp', () => {
  const page = read('app/dashboard/(account)/create-event/page.tsx');
  assert.match(page, /\.select\('display_name, birth_date, sex, sex_consent_at'\)/);
  assert.match(page, /const consentedSex = profile\?\.sex_consent_at \? /);
  assert.match(page, /sex: consentedSex,/);
});

// ── 3. the celebrant, per answer ─────────────────────────────────────────────
test('For you: the celebrant is you, by name — and the cap key stays blank', () => {
  const me = buildSelfSubject('Ice Casasola');
  assert.equal(selfCelebrantName(me), 'Ice Casasola');
  assert.equal(subjectHonoreeLabel(me), '', 'blank = the account holder’s own slot; a name would open a second one');
  assert.equal(subjectHonoreeDependentId(me), null);
  assert.equal(selfCelebrantName(buildSelfSubject(null)), '', 'no display name → never invented');
});

test('A business: the shop’s own name, or asked when there is no shop', () => {
  const shop = buildBusinessSubject('Aling Nena’s Store');
  assert.equal(subjectHonoreeLabel(shop), 'Aling Nena’s Store');
  assert.equal(subjectHonoreeDependentId(shop), null, 'the generic row is not a dependents record');
  assert.equal(subjectHonoreeLabel(buildBusinessSubject(null)), '');
  assert.equal(buildBusinessSubject(null).name, 'A business');
});

test('Someone else / passed away: nothing filled — the name is asked', () => {
  for (const s of [buildUnspecifiedSubject(), buildMemorialSubject()]) {
    assert.equal(subjectHonoreeLabel(s), '');
    assert.equal(subjectHonoreeDependentId(s), null);
    assert.equal(selfCelebrantName(s), '');
  }
});

test('a picked loved one fills their own name and record', () => {
  const [lola] = dependentSubjects(
    [{ dependent_id: 'd1', name: 'Lola Rosa', dependent_kind: 'person', birth_date: null, sex: null }],
    null,
  );
  assert.equal(subjectHonoreeLabel(lola!), 'Lola Rosa');
  assert.equal(subjectHonoreeDependentId(lola!), 'd1');
});

// 2026-10-28 (prototype who_is_it_for_2026-10-28 frame A): a shop's business alaga sits under "Your business", after
// Someone else and the groups — no longer among the loved ones.
test('the roster: You · loved ones · Someone else · A business · Someone who passed away — one business row', () => {
  const me = buildSelfSubject('Ice');
  assert.deepEqual(buildCreateRoster(me, [], 'Shop').map((s) => s.id), ['self', 'unspecified', BUSINESS_SUBJECT_ID, 'memorial']);
  const alaga = dependentSubjects(
    [{ dependent_id: 'd2', name: 'My Shop', dependent_kind: 'business', birth_date: null, sex: null }],
    null,
  );
  assert.deepEqual(buildCreateRoster(me, alaga, 'My Shop').map((s) => s.id), ['self', 'unspecified', 'd2', 'memorial']);
});

// ── wiring: one source, end to end ───────────────────────────────────────────
// SABOTAGE: drop `...forWhomHiddenTypes(types, subject),` from the picker → RED.
// SABOTAGE: drop `for_whom` from the vocab select → RED.
test('the grid folds by the DB rule, read from the one roster read', () => {
  const picker = read('app/dashboard/(account)/create-event/_components/event-type-picker.tsx');
  assert.match(picker, /\.\.\.forWhomHiddenTypes\(types, subject\),/);
  const db = read('lib/event-types-db.ts');
  assert.match(db, /'event_type, label_en, emoji, enabled, status, sort_order, onboarding_href, hero_photo_url, description, for_whom'/);
  assert.match(db, /forWhom: Array\.isArray\(v\.for_whom\) \? v\.for_whom : null,/);
  const admin = read('app/admin/categories/_components/event-type-panel.tsx');
  assert.match(admin, /<form action=\{updateEventTypeForWhom\}/, 'Admin › Event types edits the rule');
});

test('no event-type key is written into the rule’s code', () => {
  const src = read('lib/create-subjects.ts');
  const body = src.slice(src.indexOf('export function forWhomModeOf'), src.indexOf('/**\n * Life types that belong to a PERSON'));
  assert.ok(body.length > 200, 'the rule block moved — re-anchor this guard');
  for (const key of ['christening', 'wake', 'debut', 'anniversary', 'corporate', 'funeral', 'memorial_service']) {
    assert.doesNotMatch(body, new RegExp(`'${key}'`), `the rule names '${key}' in code — it belongs in event_type_vocab.for_whom`);
  }
});

// SABOTAGE: drop `if (carried.forSelf) setMomentForSelf(true);` → RED.
test('"For you" reaches the wizard as the settled "This one’s yours", by name', () => {
  const picker = read('app/dashboard/(account)/create-event/_components/event-type-picker.tsx');
  assert.match(picker, /forSelf: subject\?\.kind === 'self',/);
  const wizard = read('app/onboarding/[type]/_components/generic-onboarding.tsx');
  assert.match(wizard, /if \(carried\.forSelf\) setMomentForSelf\(true\);/);
  assert.match(wizard, /data-self-celebrant>\{selfName\?\.trim\(\) \|\| 'you'\}/);
});
