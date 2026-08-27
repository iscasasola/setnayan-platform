/**
 * HOST AND CELEBRANT ARE TWO WORDS — and a wedding must not move.
 *
 * ── THE RULING THIS PINS ────────────────────────────────────────────────────
 * Owner 2026-08-27, verbatim: *"each event can be set to a single host or
 * multiple host. depending on the type of event. yes, there can be multiple
 * hosts for every event, but the one celebratiing is the celebrant that can be
 * single, couple, or multiple people."*
 *
 * `terminology.organizer_noun` had been doing both jobs since the profiles were
 * seeded: 'celebrant' / 'graduate' / 'couple' name whoever is HONOURED, while
 * 'host' / 'organizer' / 'family' name whoever RUNS it. For a wedding they are
 * the same two people, which is why nobody felt it for months.
 *
 * ── THE SAFETY PROPERTY, ASSERTED IN BOTH DIRECTIONS ────────────────────────
 * 🔒 A WEDDING READS BYTE-IDENTICALLY. Prod is weddings, simple events and one
 * date, so the wedding arm is the ONLY arm anybody has ever seen. Both nouns
 * are 'couple', and 'couple' is collective — no shape can pluralise it — so a
 * wedding is pinned under all three shapes, not just its own.
 *
 * 🔒 AND SO DOES EVERY SEEDED TYPE WHOSE ROW PREDATES THE NEW KEYS. The
 * fallback runs through the row's OWN organiser noun, never through the code
 * profile's: defaulting a birthday's celebrant to GENERIC_PROFILE would have
 * downgraded fifteen types to "the host" — a regression dressed as a default.
 *
 * ── MUTATIONS, EACH MEASURED BY OCCURRENCE COUNT ────────────────────────────
 * · make `defaultHostNoun` return the organiser noun unconditionally · RED
 *   (a birthday's admin sentences name the seven-year-old again).
 * · make `shapedCelebrant` pluralise collectives · RED ("the couples").
 * · default `celebrantNoun` to `fb.terminology.celebrantNoun` · RED (15 types).
 * · restore any one of the seven `organizerIsHonoree` forks in the guest tree ·
 *   RED — the source scan counts them and the bill is exactly 0.
 * An unmeasured mutation proves nothing; five guards have shipped in this repo
 * protecting nothing, and every one was found by counting.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyEventCelebrantShape,
  celebrantShapeIsVisible,
  defaultHostNoun,
  WAKE_PROFILE,
  GENERIC_PROFILE,
  isCelebrantShape,
  shapedCelebrant,
  toProfile,
  WEDDING_PROFILE,
  type CelebrantShape,
  type EventTypeProfile,
  type ProfileRow,
} from '@/lib/event-type-profile';
import { eventWordsFromProfile } from './event-words';

const SHAPES: CelebrantShape[] = ['single', 'couple', 'multiple'];

/** A profile shaped like a SEEDED ROW that predates the new keys: the resolver
 *  filled host/celebrant from `organizerNoun` and the shape from the code
 *  fallback. Built through the same defaults `toProfile` applies. */
function seededRow(organizerNoun: string, shape: CelebrantShape = 'single'): EventTypeProfile {
  return {
    ...GENERIC_PROFILE,
    terminology: {
      ...GENERIC_PROFILE.terminology,
      organizerNoun,
      hostNoun: defaultHostNoun(organizerNoun),
      celebrantNoun: organizerNoun,
      celebrantShape: shape,
    },
  };
}

// ── 1 · THE WEDDING DOES NOT MOVE ────────────────────────────────────────────

test('a wedding reads "the couple" on BOTH axes, under EVERY shape', () => {
  for (const shape of SHAPES) {
    const w = eventWordsFromProfile({
      ...WEDDING_PROFILE,
      terminology: { ...WEDDING_PROFILE.terminology, celebrantShape: shape },
    });
    assert.equal(w.theHost, 'the couple', `host moved under shape=${shape}`);
    assert.equal(w.TheHost, 'The couple', `host moved under shape=${shape}`);
    assert.equal(w.theHostPossessive, 'the couple’s');
    assert.equal(w.theCelebrant, 'the couple', `celebrant moved under shape=${shape}`);
    assert.equal(w.TheCelebrant, 'The couple');
    assert.equal(w.theCelebrantPossessive, 'the couple’s');
    // The pre-existing organiser axis is untouched by any of this.
    assert.equal(w.theOrganizer, 'the couple');
    assert.equal(w.TheOrganizer, 'The couple');
  }
});

test('a wake speaks of the family on both axes, and no shape pluralises it', () => {
  for (const shape of SHAPES) {
    const w = eventWordsFromProfile({
      ...WAKE_PROFILE,
      terminology: { ...WAKE_PROFILE.terminology, celebrantShape: shape },
    });
    assert.equal(w.theHost, 'the family');
    assert.equal(w.theCelebrant, 'the family');
    assert.equal(w.solemn, true, 'the register must survive the new fields');
  }
});

// ── 2 · THE FALLBACK, WHICH IS WHERE A REGRESSION WOULD HIDE ─────────────────

test('a row carrying ONLY an organiser noun keeps every word it reads today', () => {
  // The five nouns seeded across the 16 types in production.
  for (const noun of ['couple', 'host', 'organizer', 'celebrant', 'graduate']) {
    const w = eventWordsFromProfile(seededRow(noun));
    assert.equal(
      w.theCelebrant,
      `the ${noun}`,
      `${noun}: the celebrant word must be the row's OWN noun, not a code default`,
    );
    assert.equal(w.theOrganizer, `the ${noun}`, `${noun}: the organiser axis must not move`);
  }
});

/** A row exactly as it sits in production today: a terminology blob with the
 *  pre-2026-08-27 keys and NOTHING else. This is the shape the fallback has to
 *  survive, and building it by hand is what made an earlier version of this
 *  suite pass through a mutation that broke fifteen event types. */
function rowAsSeeded(eventType: string, organizerNoun: string): ProfileRow {
  return {
    event_type: eventType,
    terminology: {
      organizer_noun: organizerNoun,
      person_a: null,
      person_b: null,
      seat_word: 'table',
      event_word: eventType,
      vip_tier_label: 'Guests of honor',
    },
    enabled_surfaces: null,
    marketplace_enabled: null,
    event_class: null,
    layer_mode: null,
    multi_day: null,
    onboarding_flow_key: null,
    role_set_key: null,
    template_pack_key: null,
    monogram_set_key: null,
    reveal_pack_key: null,
    budget_taxonomy_key: null,
    schedule_seed_key: null,
    statutory_pack_key: null,
  };
}

test('THE REAL PARSER fills both nouns from the row, never from the code profile', () => {
  // 🔴 THE LINE THIS EXISTS FOR. Defaulting `celebrantNoun` to the fallback
  // profile's would answer 'host' for a birthday (organiser 'celebrant', code
  // fallback GENERIC) — fifteen of the sixteen seeded types silently downgraded
  // to "the host" while every hand-built fixture still agreed with itself.
  const seeded: [string, string][] = [
    ['wedding', 'couple'],
    ['birthday', 'celebrant'],
    ['debut', 'celebrant'],
    ['graduation', 'graduate'],
    ['corporate', 'organizer'],
    ['christening', 'host'],
  ];
  for (const [type, noun] of seeded) {
    const t = toProfile(rowAsSeeded(type, noun)).terminology;
    assert.equal(t.celebrantNoun, noun, `${type}: celebrant word must be the row's own`);
    assert.equal(t.hostNoun, defaultHostNoun(noun), `${type}: host word`);
    assert.equal(t.organizerNoun, noun, `${type}: the organiser axis must not move`);
  }
});

test('THE REAL PARSER honours the new keys when a row carries them', () => {
  const row = rowAsSeeded('birthday', 'celebrant');
  row.terminology = {
    ...(row.terminology as Record<string, unknown>),
    host_noun: 'family',
    celebrant_noun: 'child',
    celebrant_shape: 'multiple',
  };
  const t = toProfile(row).terminology;
  assert.equal(t.hostNoun, 'family');
  assert.equal(t.celebrantNoun, 'child');
  assert.equal(t.celebrantShape, 'multiple');
  // 'child' is the realistic admin-typed noun and the regular rule would render
  // "the childs" to a guest.
  assert.equal(eventWordsFromProfile(toProfile(row)).theCelebrant, 'the children');
});

test('THE REAL PARSER refuses a malformed shape rather than guessing', () => {
  const row = rowAsSeeded('birthday', 'celebrant');
  row.terminology = { ...(row.terminology as Record<string, unknown>), celebrant_shape: 'pair' };
  // GENERIC_PROFILE is the code fallback for 'birthday'.
  assert.equal(toProfile(row).terminology.celebrantShape, GENERIC_PROFILE.terminology.celebrantShape);
});

test('the host noun is the organiser noun UNLESS it names the honoree', () => {
  // At a seven-year-old's birthday the celebrant is the seven-year-old, so
  // "The celebrant is still arranging the venue layout" names the wrong person.
  assert.equal(defaultHostNoun('celebrant'), 'host');
  assert.equal(defaultHostNoun('graduate'), 'host');
  // Everything else runs its own event and keeps being named.
  assert.equal(defaultHostNoun('couple'), 'couple');
  assert.equal(defaultHostNoun('host'), 'host');
  assert.equal(defaultHostNoun('organizer'), 'organizer');
  assert.equal(defaultHostNoun('family'), 'family');
  // A noun added later is treated as an organiser — the safe direction: naming
  // a real organiser reads fine, naming a child who arranged nothing does not.
  assert.equal(defaultHostNoun('convenor'), 'convenor');

  assert.equal(eventWordsFromProfile(seededRow('celebrant')).theHost, 'the host');
  assert.equal(eventWordsFromProfile(seededRow('graduate')).TheHost, 'The host');
});

// ── 3 · THE SHAPE ────────────────────────────────────────────────────────────

test('only "multiple" pluralises, and only a countable noun', () => {
  assert.equal(shapedCelebrant('celebrant', 'single'), 'celebrant');
  // 'couple' as a SHAPE means the noun already names two people — never that a
  // singular noun should be doubled.
  assert.equal(shapedCelebrant('celebrant', 'couple'), 'celebrant');
  assert.equal(shapedCelebrant('celebrant', 'multiple'), 'celebrants');
  assert.equal(shapedCelebrant('graduate', 'multiple'), 'graduates');
  assert.equal(shapedCelebrant('host', 'multiple'), 'hosts');
});

test('a collective noun is never pluralised, under any shape', () => {
  for (const shape of SHAPES) {
    assert.equal(shapedCelebrant('couple', shape), 'couple', 'the wedding defect');
    assert.equal(shapedCelebrant('family', shape), 'family');
  }
});

test('a pluralised celebrant takes the bare possessive mark', () => {
  const w = eventWordsFromProfile(seededRow('graduate', 'multiple'));
  assert.equal(w.theCelebrant, 'the graduates');
  assert.equal(w.theCelebrantPossessive, 'the graduates’', 'never "graduates’s"');
  // The HOST axis is independent and stays singular — a graduation is run by a
  // host whether one graduate walks or four do.
  assert.equal(w.theHost, 'the host');
});

test('the shape is only OFFERED where it could change a word', () => {
  assert.equal(celebrantShapeIsVisible('couple'), false, 'a wedding is always a couple');
  assert.equal(celebrantShapeIsVisible('family'), false, 'a wake has no celebrant to count');
  assert.equal(celebrantShapeIsVisible('celebrant'), true);
  assert.equal(celebrantShapeIsVisible('graduate'), true);
  assert.equal(celebrantShapeIsVisible('host'), true);
});

// ── 4 · THE PER-EVENT OVERRIDE ───────────────────────────────────────────────

test('a celebration may say how many it is for; null leaves the type alone', () => {
  const base = seededRow('celebrant', 'single');
  assert.equal(
    applyEventCelebrantShape(base, null),
    base,
    'NULL — every row in production today — must not even rebuild the object',
  );
  assert.equal(applyEventCelebrantShape(base, 'single'), base, 'same value, same object');

  const twins = applyEventCelebrantShape(base, 'multiple');
  assert.equal(twins.terminology.celebrantShape, 'multiple');
  assert.equal(eventWordsFromProfile(twins).theCelebrant, 'the celebrants');
  // The type default is untouched — an override is per event, never a write-back.
  assert.equal(base.terminology.celebrantShape, 'single');
});

test('the stored shape is parsed strictly — a typo takes the default, not a guess', () => {
  for (const bad of ['', 'SINGLE', 'pair', 'many', null, undefined, 3, {}]) {
    assert.equal(isCelebrantShape(bad), false, `${String(bad)} is not a shape`);
  }
  for (const good of SHAPES) assert.equal(isCelebrantShape(good), true);
});

// ── 5 · THE SEVEN SENTENCES THAT USED TO NAME NOBODY ─────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..'); // apps/web/app
const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');
const count = (h: string, n: string) => h.split(n).length - 1;

/** The guest-tree files that carried an `organizerIsHonoree` fork. */
const FORKED = [
  join('[slug]', 'find-seat', 'page.tsx'),
  join('[slug]', 'find-my-table', 'page.tsx'),
  join('[slug]', 'seat', 'page.tsx'),
  join('[slug]', 'hub', 'page.tsx'),
  join('[slug]', '_components', 'guest-hub-card.tsx'),
];

test('no admin sentence drops the person any more — it names the host', () => {
  // The 2026-08-18 workaround: with one noun available, six sentences removed
  // the person rather than print "The celebrant hasn't published the seating
  // plan". With two nouns the sentence can name the right people instead of
  // naming nobody, which is what they were always trying to do.
  const forks = FORKED.map((f) => count(read(f), 'words.organizerIsHonoree'));
  assert.deepEqual(
    forks,
    [0, 0, 0, 0, 0],
    'a person-dropping fork came back. The host noun is what these sentences ' +
      'name now — reach for words.TheHost / words.theHost, never a fork.',
  );

  // …and the replacement is actually THERE. A bill of zero forks is satisfied
  // just as well by deleting the sentences, so the positive count is the half
  // that makes this a guard.
  const named = FORKED.map((f) => count(read(f), 'words.TheHost') + count(read(f), 'words.theHost'));
  assert.deepEqual(
    named,
    [1, 2, 2, 2, 1],
    'each sentence must name the host; the counts are per file and exact',
  );
});
