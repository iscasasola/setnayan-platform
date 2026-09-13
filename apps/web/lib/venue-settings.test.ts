/**
 * venue-settings.test.ts — one vocabulary, seven copies, and the drift between
 * them is silent.
 *
 * `events.venue_setting` was hand-written in SEVEN places: the DB CHECK
 * constraint, three server-action allowlists (create-event · the couple's
 * details page · the vendor's compatibility picker), the couple's own
 * `<select>`, and two label maps on Explore.
 *
 * 🔑 EACH OMISSION FAILS DIFFERENTLY, AND NONE OF THEM THROW:
 *
 *   · miss an allowlist  → the couple picks it and the save is silently rejected
 *   · miss the picker    → the value is legal and nobody can choose it
 *   · miss a label map   → the chip renders `outdoor_tent` in raw snake_case
 *   · miss the CHECK     → the write fails at the database, after the UI accepted it
 *
 * That is why adding `restaurant` (owner, 2026-08-05) came with this file
 * rather than with a careful grep. The list is `VENUE_SETTINGS`; every copy is
 * checked against it here.
 *
 * ⚠ THIS TEST READS SOURCE TEXT ON PURPOSE. The copies are literals inside
 * server actions and JSX, not exported values — importing them would mean
 * importing `'use server'` modules and a React tree. Reading the files is how a
 * cross-file vocabulary gets checked at all; the alternative was a second
 * hand-typed list, which is the bug.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  VENUE_SETTINGS,
  VENUE_SETTING_LABEL,
  VENUE_SETTING_SHORT_LABEL,
  VENUE_SETTING_TO_DIRECTORY_TYPE,
  isVenueSetting,
  CEREMONY_VENUE_SETTINGS,
  CEREMONY_VENUE_SETTING_LABEL,
  CEREMONY_VENUE_SETTING_SHORT_LABEL,
  isCeremonyVenueSetting,
  receptionVenuePhrase,
  AMBIGUOUS_VENUE_SETTING,
} from './venue-settings';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const REPO = join(WEB, '..', '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

/**
 * Every file that still RESTATES the list as literals.
 *
 * The vendor side left this list on 2026-08-05: its copy derives from
 * `lib/vendor-compatibility.ts`, which re-exports VENUE_SETTINGS. A derived
 * copy cannot drift, so checking it for literals would fail on correct code —
 * the fastest way to get a guard deleted. The import itself is asserted below
 * instead, so the file cannot quietly go back to hand-typing.
 */
const ALLOWLISTS = [
  'app/dashboard/(account)/create-event/actions.ts',
  'app/dashboard/[eventId]/actions.ts',
];

test('every server-side allowlist holds the whole vocabulary', () => {
  for (const file of ALLOWLISTS) {
    const src = read(file);
    for (const setting of VENUE_SETTINGS) {
      assert.ok(
        src.includes(`'${setting}'`),
        `${file} is missing '${setting}'. A host who picks it gets their save ` +
          `REJECTED, with no message that names the reason.`,
      );
    }
  }
});

/**
 * ⚠ This pointed at `app/vendor-dashboard/actions.ts` until 2026-08-09, when
 * the orphaned full-form `saveVendorProfile` was deleted and took the last
 * vendor-side allowlist reference in that file with it. The allowlist now lives
 * with its ONLY writer — the card that actually renders the checkboxes — which
 * is where it should have been all along. Repointed rather than dropped: a
 * guard deleted because its subject moved is a guard that stops guarding.
 */
test("the vendor allowlist derives the list, and hasn't gone back to typing it", () => {
  const src = read('app/vendor-dashboard/shop/venue-match-actions.ts');
  assert.ok(
    /from '@\/lib\/vendor-compatibility'/.test(src),
    'The vendor save action stopped importing the shared vocabulary. Whatever ' +
      'replaced it is a second hand-typed list — the exact thing this file exists ' +
      'to prevent.',
  );
  // A re-typed set beside the import is the realistic regression: someone adds
  // `const ALLOWED_VENUE_SETTINGS = new Set([...])` back and the import lingers
  // unused. Assert the file declares neither.
  assert.ok(
    !/const ALLOWED_VENUE_SETTINGS[^=]*=\s*new Set\(\[/.test(src),
    'A local ALLOWED_VENUE_SETTINGS is declared again. Two lists, one of which ' +
      'nobody will remember to update.',
  );
});

test('the couple can actually choose every one of them', () => {
  const src = read('app/dashboard/[eventId]/details/_components/governed-fields.tsx');
  for (const setting of VENUE_SETTINGS) {
    assert.ok(
      src.includes(`value: '${setting}'`),
      `The picker does not offer '${setting}'. A legal value nobody can select ` +
        `is the same as no value at all — see the livestream audience switch, ` +
        `which shipped with no control and sat at its default on every event.`,
    );
  }
});

test('both Explore label maps cover every one of them', () => {
  const src = read('app/(shell)/explore/page.tsx');
  for (const setting of VENUE_SETTINGS) {
    // Either quote style — `civil_registrar`'s label is double-quoted because
    // it contains an apostrophe ("Civil Registrar's Office"). A single-quote
    // check fails on correct code, which is how a guard earns itself deleted.
    const long = new RegExp(`\\n  ${setting}: ['"]`).test(src);
    assert.ok(
      long,
      `Explore has no label for '${setting}'. The fallback prints the raw key, ` +
        `so a guest sees "outdoor_tent" where a name should be.`,
    );
  }
  // Both maps, not just the one that happens to be first in the file.
  const occurrences = VENUE_SETTINGS.map(
    (s) => (src.match(new RegExp(`\\n  ${s}: ['"]`, 'g')) ?? []).length,
  );
  assert.ok(
    occurrences.every((n) => n >= 2),
    'A setting appears in only ONE of the two label maps (long and short). The ' +
      'banner and the chips would disagree about the same venue.',
  );
});

test('the labels themselves are complete and human', () => {
  for (const setting of VENUE_SETTINGS) {
    assert.ok(VENUE_SETTING_LABEL[setting], `no long label for ${setting}`);
    assert.ok(VENUE_SETTING_SHORT_LABEL[setting], `no short label for ${setting}`);
    assert.ok(
      !VENUE_SETTING_LABEL[setting].includes('_'),
      `${setting}'s label still looks like a database key`,
    );
  }
});

/**
 * The newest migration that (re)states BOTH venue constraints. Reading the
 * migration rather than the live DB keeps this a unit test; the migration
 * itself asserts against the catalog when it runs.
 *
 * ⚠ REPOINT THIS WHEN A NEWER MIGRATION RESTATES A CONSTRAINT. It moved off
 * 20271114090000 (the `restaurant` widening) on 2026-09-03. A stale pointer
 * here does not fail — it passes while checking a file the database no longer
 * reflects, which is the quietest way for a guard to stop guarding.
 */
const CONSTRAINT_MIGRATION = readFileSync(
  join(
    REPO,
    'supabase',
    'migrations',
    '20271197508087_ceremony_venue_setting_and_reception_venue_narrowed.sql',
  ),
  'utf8',
);

/** Only the ADD CONSTRAINT body, so prose in the header block cannot satisfy a
 *  membership check. Both constraints name every value they allow as
 *  `'value'::text` inside their own ARRAY[…]. */
function constraintBody(name: string): string {
  const start = CONSTRAINT_MIGRATION.indexOf(`ADD CONSTRAINT ${name}`);
  assert.notEqual(start, -1, `${name} is not (re)stated in the pinned migration.`);
  const end = CONSTRAINT_MIGRATION.indexOf(');', start);
  assert.notEqual(end, -1, `could not find the end of ${name}`);
  return CONSTRAINT_MIGRATION.slice(start, end);
}

test('the database constraint and the code agree', () => {
  const body = constraintBody('events_venue_setting_check');
  for (const setting of VENUE_SETTINGS) {
    assert.ok(
      body.includes(`'${setting}'::text`),
      `The CHECK constraint does not allow '${setting}'. The UI would offer it ` +
        `and the write would fail at the database — the worst of the four ` +
        `failure modes, because the couple sees a valid form and a broken save.`,
    );
  }
});

/**
 * The other direction, and the one the `restaurant` widening never needed: the
 * CHECK must not allow MORE than the code offers.
 *
 * `civil_registrar` moved to the ceremony list on 2026-09-03 (owner). If the
 * constraint kept it, the couple's reception could still be stored as a
 * registrar's office by any writer that isn't the picker — and "Make it real"
 * would bill them for a banquet rendered inside one.
 */
test('the reception constraint allows NOTHING the reception list omits', () => {
  const body = constraintBody('events_venue_setting_check');
  const allowed = [...body.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]!);
  assert.deepEqual(
    [...allowed].sort(),
    [...VENUE_SETTINGS].sort(),
    'The reception CHECK and VENUE_SETTINGS hold different value sets. An extra ' +
      'value in the CHECK is storable and unpickable; a missing one is pickable ' +
      'and unstorable.',
  );
  assert.ok(
    !allowed.includes('civil_registrar'),
    'civil_registrar is a CEREMONY venue and must not be storable as a reception.',
  );
});

test('the ceremony constraint and the ceremony list are the same set', () => {
  const body = constraintBody('events_ceremony_venue_setting_check');
  const allowed = [...body.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]!);
  assert.deepEqual([...allowed].sort(), [...CEREMONY_VENUE_SETTINGS].sort());
});

test('isCeremonyVenueSetting accepts the list and nothing else', () => {
  for (const setting of CEREMONY_VENUE_SETTINGS) assert.ok(isCeremonyVenueSetting(setting));
  for (const bad of [
    null,
    undefined,
    '',
    'CHURCH',
    'churches',
    'catholic_church', // the DIRECTORY's word — faith belongs in ceremony_type
    'inc_chapel', // ditto: 'inc' + 'chapel' already says this
    'banquet_hall', // a RECEPTION setting; the two lists are not interchangeable
    'destination',
  ]) {
    assert.equal(
      isCeremonyVenueSetting(bad),
      false,
      `"${String(bad)}" must not pass as a ceremony venue.`,
    );
  }
});

test('no ceremony venue value encodes a faith', () => {
  // The rule the list is built on: ceremony_venue_setting names the KIND OF
  // PLACE, events.ceremony_type names the RITE. A value carrying a faith would
  // make one fact true in two columns — two mechanisms that can disagree while
  // each passes its own suite.
  for (const setting of CEREMONY_VENUE_SETTINGS) {
    for (const faith of ['catholic', 'christian', 'inc', 'muslim', 'cultural', 'civil_rite']) {
      assert.ok(
        !setting.includes(faith),
        `'${setting}' names the faith '${faith}', which events.ceremony_type ` +
          `already carries. (Note 'civil_registrar' is a BUILDING — the city ` +
          `hall — not the civil rite, which is why it is allowed here.)`,
      );
    }
  }
});

test('every ceremony venue is labelled, and none looks like a database key', () => {
  for (const setting of CEREMONY_VENUE_SETTINGS) {
    assert.ok(CEREMONY_VENUE_SETTING_LABEL[setting], `no long label for ${setting}`);
    assert.ok(CEREMONY_VENUE_SETTING_SHORT_LABEL[setting], `no short label for ${setting}`);
    assert.ok(
      !CEREMONY_VENUE_SETTING_LABEL[setting].includes('_'),
      `${setting}'s label still looks like a database key`,
    );
  }
});

test('the couple can actually choose every ceremony venue', () => {
  // The picker DERIVES its options from CEREMONY_VENUE_SETTINGS, so this
  // asserts the derivation rather than a re-typed list — a hand-written copy is
  // what left ten faiths unpickable on this very card.
  const src = read('app/dashboard/[eventId]/details/_components/governed-fields.tsx');
  assert.ok(
    /CEREMONY_VENUE_OPTIONS[\s\S]{0,200}CEREMONY_VENUE_SETTINGS\.map\(/.test(src),
    'The ceremony-venue picker stopped deriving its options from ' +
      'CEREMONY_VENUE_SETTINGS. Whatever replaced it is a second hand-typed list.',
  );
  assert.ok(
    src.includes('CEREMONY_VENUE_OPTIONS.map('),
    'CEREMONY_VENUE_OPTIONS is built but never rendered — a list of options ' +
      'nobody can see is the same as no options at all.',
  );
});

test('the ceremony venue has a server-side allowlist that holds the whole vocabulary', () => {
  const src = read('app/dashboard/[eventId]/actions.ts');
  const start = src.indexOf('const ALLOWED_CEREMONY_VENUE_SETTINGS');
  assert.notEqual(start, -1, 'the ceremony-venue allowlist is gone or renamed');
  const body = src.slice(start, src.indexOf('] as const', start));
  for (const setting of CEREMONY_VENUE_SETTINGS) {
    assert.ok(
      body.includes(`'${setting}'`),
      `updateCeremonyVenueSetting rejects '${setting}'. A host who picks it gets ` +
        `"Invalid ceremony venue" with nothing naming the reason.`,
    );
  }
});

test('every reception setting maps to a marketplace venue type', () => {
  // The one that never could map — `civil_registrar` — is no longer a reception
  // setting at all (2026-09-03), so the exception this loop used to carry is
  // gone and EVERY value must map. Its absence is asserted separately below, so
  // deleting this line cannot quietly bring it back.
  for (const setting of VENUE_SETTINGS) {
    assert.ok(
      VENUE_SETTING_TO_DIRECTORY_TYPE[setting],
      `'${setting}' maps to no venue_directory_type, so the marketplace can ` +
        `never recommend a venue for a host who chose it.`,
    );
  }
});

test('civil_registrar is a ceremony venue and ONLY a ceremony venue', () => {
  assert.ok(
    !(VENUE_SETTINGS as readonly string[]).includes('civil_registrar'),
    'civil_registrar is back on the RECEPTION list. It is where you marry, not ' +
      'where you dine — a "Make it real" render would put a banquet inside a ' +
      "registrar's office.",
  );
  assert.equal(isVenueSetting('civil_registrar'), false);
  assert.ok((CEREMONY_VENUE_SETTINGS as readonly string[]).includes('civil_registrar'));
  assert.equal(isCeremonyVenueSetting('civil_registrar'), true);
});

/**
 * ── THE ONE VALUE A PAID RENDER MAY NOT ASSERT ──────────────────────────────
 * `events.venue_setting` cannot distinguish "chose a ballroom" from "never
 * answered": both writers stamp `banquet_hall` when nothing was picked, and
 * events_wedding_fields_consistency forbids NULL on a wedding row, so there is
 * nowhere for "unknown" to live. Everything ELSE in the vocabulary can only
 * arrive from a real pick.
 */
test('receptionVenuePhrase refuses the one value that might be a default', () => {
  assert.equal(
    receptionVenuePhrase(AMBIGUOUS_VENUE_SETTING),
    null,
    'A bare read of banquet_hall was turned into a claim about the room. That ' +
      'is a paid render depicting a ballroom the couple may never have chosen.',
  );
  // …and yields to actual evidence.
  assert.ok(receptionVenuePhrase(AMBIGUOUS_VENUE_SETTING, { chosen: true }));
});

test('receptionVenuePhrase names every setting that can only be a real choice', () => {
  for (const setting of VENUE_SETTINGS) {
    if (setting === AMBIGUOUS_VENUE_SETTING) continue;
    const phrase = receptionVenuePhrase(setting);
    assert.ok(
      phrase,
      `'${setting}' produces no scene phrase, so a couple who chose it gets the ` +
        `generic brief — the defect this exists to fix, just quieter.`,
    );
    assert.ok(!phrase!.includes('_'), `'${setting}' phrase still reads like a database key`);
  }
});

test('receptionVenuePhrase asserts nothing about a value it does not know', () => {
  for (const bad of [null, undefined, '', 'civil_registrar', 'hotel_ballroom', 'castle']) {
    assert.equal(receptionVenuePhrase(bad), null, `"${String(bad)}" must not be asserted`);
    assert.equal(receptionVenuePhrase(bad, { chosen: true }), null, 'not even when claimed chosen');
  }
});

test('BOTH directions of the mapping are wired, separately', () => {
  const rec = read('lib/venue-recommendations.ts');

  // ⚠ SLICE EACH FUNCTION. A whole-file `includes` cannot tell the two
  // directions apart: with only the inverse wired, `case 'restaurant':` is
  // still somewhere in the file and the check passes — which is precisely the
  // half-wired state this test claims to prevent. Caught by deleting one
  // direction and watching nothing go red.
  const slice = (fn: string) => {
    const start = rec.indexOf(`export function ${fn}(`);
    assert.notEqual(start, -1, `${fn} is gone or renamed — update this test.`);
    const next = rec.indexOf('\nexport ', start + 10);
    return rec.slice(start, next === -1 ? undefined : next);
  };
  const forward = slice('venueSettingToDirectoryType');
  const inverse = slice('venueTypeToSetting');

  for (const [setting, directoryType] of Object.entries(VENUE_SETTING_TO_DIRECTORY_TYPE)) {
    assert.ok(
      forward.includes(`case '${setting}':`),
      `venueSettingToDirectoryType has no case for '${setting}', so a host who ` +
        `chose it is never matched to a venue.`,
    );
    assert.ok(
      inverse.includes(`case '${directoryType}':`),
      `venueTypeToSetting has no case for '${directoryType}' — the INVERSE ` +
        `direction. Mapping one way only means a host can filter to it but the ` +
        `venue card cannot say which filter would surface it.`,
    );
  }
});

test('the 3D plan maps every setting deliberately, never by fallthrough', () => {
  const decor = read('app/_components/plan3d/venue-decor.tsx');
  // Not a completeness check — `default` legitimately catches the ambiguous
  // ones. What is asserted is that `restaurant` was DECIDED: it renders as the
  // indoor hall because a restaurant is an indoor room, not because nobody
  // thought about it. `heritage`, `destination` and `civil_registrar` still
  // fall through, and that is a known, recorded gap, not this test's business.
  assert.ok(
    decor.includes("case 'restaurant':"),
    'restaurant fell back to the default archetype. It renders the same either ' +
      'way — the point is whether the next reader can tell it was considered.',
  );
});

test('isVenueSetting accepts the list and nothing else', () => {
  for (const setting of VENUE_SETTINGS) assert.ok(isVenueSetting(setting));
  for (const bad of [null, undefined, '', 'RESTAURANT', 'restaurants', 'hotel_ballroom']) {
    assert.equal(
      isVenueSetting(bad),
      false,
      `"${String(bad)}" must not pass — note 'hotel_ballroom' is the DIRECTORY's ` +
        `word for the same idea, and the two vocabularies must not blur.`,
    );
  }
});
