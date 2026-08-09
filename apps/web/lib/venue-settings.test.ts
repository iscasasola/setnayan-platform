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
  const src = read('app/explore/page.tsx');
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

test('the database constraint and the code agree', () => {
  // The newest migration that (re)states the constraint. Reading the migration
  // rather than the live DB keeps this a unit test; the migration itself
  // asserts against the catalog when it runs.
  const migration = readFileSync(
    join(REPO, 'supabase', 'migrations', '20271114090000_venue_setting_restaurant.sql'),
    'utf8',
  );
  for (const setting of VENUE_SETTINGS) {
    assert.ok(
      migration.includes(`'${setting}'::text`),
      `The CHECK constraint does not allow '${setting}'. The UI would offer it ` +
        `and the write would fail at the database — the worst of the four ` +
        `failure modes, because the couple sees a valid form and a broken save.`,
    );
  }
});

test('every reception setting maps to a marketplace venue type', () => {
  for (const setting of VENUE_SETTINGS) {
    if (setting === 'civil_registrar') {
      // Deliberately unmapped: a registrar's office is a CEREMONY venue and the
      // reception filter never offers it. Pinned so the exception stays a
      // decision rather than becoming an oversight someone "fixes".
      assert.equal(VENUE_SETTING_TO_DIRECTORY_TYPE[setting], undefined);
      continue;
    }
    assert.ok(
      VENUE_SETTING_TO_DIRECTORY_TYPE[setting],
      `'${setting}' maps to no venue_directory_type, so the marketplace can ` +
        `never recommend a venue for a host who chose it.`,
    );
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
