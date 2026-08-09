/**
 * vendor-compatibility.test.ts — the column had a reader, a filter, a validator
 * and a public badge, and no writer. For months.
 *
 * `compatible_venue_settings` / `compatible_ceremony_types` shipped in
 * iteration 0043. Explore filters on them, the public profile renders badges
 * from them, the retired `saveVendorProfile` validated them — and the only form
 * that ever posted them went out 2026-07-05, taking the write path with it. (The
 * action followed on 2026-08-09; see the block near the foot of this file.) Nothing
 * errored. Both live shops simply kept whatever their seed row held (the
 * identical `["banquet_hall","garden","heritage"]`, one of them on a profile
 * named "(FIXTURE)"), so the marketplace's venue matching ran on a fixture.
 *
 * 🔑 THE GENERAL RULE THIS ENFORCES: grep the column and ask whether every hit
 * is a READ. Four separate features hit this same shape in one week
 * (`live_media_public`, `papic_face_mode`, the admin venue-type picker, this).
 *
 * These tests read SOURCE TEXT where the thing being checked is a cross-file
 * relationship — importing a `'use server'` module or a React tree from a unit
 * test is not possible, and a second hand-typed list would be the very bug.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALLOWED_CEREMONY_TYPES,
  ALLOWED_VENUE_SETTINGS,
  COMPATIBLE_CEREMONY_TYPES,
  COMPATIBLE_CEREMONY_TYPE_LABEL,
  COMPATIBLE_VENUE_SETTINGS,
  COMPATIBLE_VENUE_SETTING_LABEL,
  parseCompatibility,
} from './vendor-compatibility';
import { VENUE_SETTINGS } from './venue-settings';
import { ALLOWED_CEREMONY_VALUES } from './faith-registry';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

// ── THE WRITER EXISTS AND IS REACHABLE ──────────────────────────────────────

test('a form in the product actually posts both columns', () => {
  const action = read('app/vendor-dashboard/shop/venue-match-actions.ts');
  for (const col of ['compatible_venue_settings', 'compatible_ceremony_types']) {
    assert.ok(
      new RegExp(`\\.update\\([\\s\\S]*${col}`).test(action),
      `The venue-match action no longer writes ${col}. That returns the column ` +
        `to the state this whole test file exists because of: read everywhere, ` +
        `written nowhere, and silently serving whatever the seed left behind.`,
    );
  }
});

test('the card is mounted on a page a vendor can open', () => {
  const page = read('app/vendor-dashboard/shop/page.tsx');
  assert.ok(
    /<VenueMatchCard/.test(page) && /from '\.\/_components\/venue-match-card'/.test(page),
    'VenueMatchCard is not rendered on My Shop. A writer nobody can reach is ' +
      'the same as no writer — see the save-the-date exit button that only ' +
      'appeared on the film’s last beat.',
  );
});

test('the card feeds the action the values it was given', () => {
  const card = read('app/vendor-dashboard/shop/_components/venue-match-card.tsx');
  assert.ok(
    /updateVenueMatching/.test(card),
    'The card stopped calling updateVenueMatching. Ticking boxes would look ' +
      'exactly the same and save nothing.',
  );
  for (const col of ['compatible_venue_settings', 'compatible_ceremony_types']) {
    assert.ok(
      new RegExp(`append\\('${col}'`).test(card),
      `The card never appends ${col} to its payload, so the action would read ` +
        `an empty list and store NULL — silently widening the shop to everything.`,
    );
  }
});

// ── EMPTY MEANS OPEN TO ALL — the direction matters ─────────────────────────

test('nothing ticked stores NULL, never an empty array', () => {
  assert.equal(parseCompatibility([], ALLOWED_VENUE_SETTINGS), null);
  assert.equal(parseCompatibility(['nonsense'], ALLOWED_VENUE_SETTINGS), null);
  // `[]` here would be catastrophic and invisible: the read side asks
  // `compatible_venue_settings.is.null,…cs.{setting}`, so an empty array matches
  // NO couple. The shop would vanish from Explore with a form that said "Saved".
});

test('the read side still treats NULL as open to all', () => {
  const explore = read('app/explore/page.tsx');
  assert.ok(
    /compatible_venue_settings\.is\.null/.test(explore),
    'Explore no longer treats a NULL as "open to all". Every shop that has not ' +
      'declared a venue — which is most of them — would disappear from search, ' +
      'and the only visible symptom is fewer results.',
  );
});

test('a ticked value survives, deduped, in vocabulary order', () => {
  const out = parseCompatibility(
    ['beach', 'beach', ' garden ', 'not_a_venue'],
    ALLOWED_VENUE_SETTINGS,
  );
  assert.deepEqual(out, ['beach', 'garden']);
});

// ── ONE VOCABULARY, NOT FOUR ────────────────────────────────────────────────

test('the vendor is offered exactly the couple’s own venue list', () => {
  assert.deepEqual(
    [...COMPATIBLE_VENUE_SETTINGS],
    [...VENUE_SETTINGS],
    'The vendor and the couple are choosing from different lists. They can both ' +
      'answer honestly and still never match.',
  );
});

test('the ceremony list is the one the database accepts', () => {
  assert.deepEqual([...COMPATIBLE_CEREMONY_TYPES], [...ALLOWED_CEREMONY_VALUES]);
  assert.equal(ALLOWED_CEREMONY_TYPES.size, ALLOWED_CEREMONY_VALUES.length);
});

test('every offered value has a human label — no raw database words', () => {
  for (const v of COMPATIBLE_VENUE_SETTINGS) {
    const label = COMPATIBLE_VENUE_SETTING_LABEL[v];
    assert.ok(label, `no label for venue '${v}'`);
    assert.ok(!label.includes('_'), `'${v}' still renders like a database key`);
  }
  for (const c of COMPATIBLE_CEREMONY_TYPES) {
    const label = COMPATIBLE_CEREMONY_TYPE_LABEL[c];
    assert.ok(
      label,
      `no label for ceremony '${c}'. This is the exact gap found on 2026-08-05: ` +
        `the public profile's hand-typed map was missing chinese, jewish and ` +
        `born_again, and its fallback prints the raw key to a couple.`,
    );
    assert.ok(!label.includes('_'), `'${c}' still renders like a database key`);
  }
});

test('the public badge derives its labels instead of re-typing them', () => {
  const src = read('app/v/[slug]/page.tsx');
  assert.ok(
    /COMPATIBLE_CEREMONY_TYPE_LABEL as CEREMONY_TYPE_LABELS/.test(src) &&
      /COMPATIBLE_VENUE_SETTING_LABEL as VENUE_SETTING_LABELS/.test(src),
    'The public vendor page has gone back to its own label maps. Those drifted ' +
      'three ceremonies and one venue behind the server before anyone noticed, ' +
      'and the only symptom was a raw key on a public page.',
  );
  assert.ok(
    !/const (CEREMONY_TYPE_LABELS|VENUE_SETTING_LABELS)[^=]*=\s*\{/.test(src),
    'A local label map is declared again beside the import.',
  );
});

// ── ONLY A FORM THAT ASKS MAY WRITE THESE TWO ───────────────────────────────

/**
 * This block used to guard the ORPHANED FULL-FORM ACTION. `saveVendorProfile`
 * built a whole-row payload and wrote both columns from whatever the submission
 * happened to carry; since `parseCompatibility` maps "absent" to NULL and the
 * marketplace reads NULL as OPEN TO ALL, any form wired to it without these
 * checkboxes would not have cleared a shop's answer — it would have replaced it
 * with "we take every venue and every ceremony", on a save reporting success.
 * The 2026-08-05 fix fenced that write behind an explicit
 * `compatible_fields_present` marker rather than removing it.
 *
 * The action itself was deleted 2026-08-09: it had had no caller since
 * 2026-07-05, and `is_published` sat in the same payload as the identical
 * absent-means-false hazard on a column the vendor UI has no control for at all
 * (see `vendor-publish-guard.test.ts`). So the fence is no longer the thing to
 * assert — the ABSENCE of the write is strictly stronger than a guarded write,
 * and this test pins that instead. Same failure prevented, one layer earlier.
 */
test('no full-payload action writes these columns behind the vendor’s back', () => {
  const src = read('app/vendor-dashboard/actions.ts')
    // Strip comments: the tombstone explaining the deletion names both columns.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !/compatible_(venue_settings|ceremony_types)\s*:/.test(src),
    'A vendor-dashboard action writes the compatibility columns again. Only a ' +
      'form that RENDERS the checkboxes may write them — otherwise "the vendor ' +
      'unticked everything" and "this form never asked" are the identical ' +
      'FormData, and the write silently widens the shop to every venue and ' +
      'ceremony instead of clearing its answer. The writer is ' +
      'shop/venue-match-actions.ts, whose card always renders them (asserted ' +
      'above). If a second writer is genuinely needed, gate it on an explicit ' +
      'hidden marker — never on the checkboxes themselves, which post nothing ' +
      'when unticked and would make CLEARING impossible instead.',
  );
});

test('the live writer keys on the checkboxes, because its card always renders them', () => {
  const src = read('app/vendor-dashboard/shop/venue-match-actions.ts');
  // The inverse of the rule above, and the reason the rule is about FORMS and
  // not about columns: on a card that always shows the boxes, absent genuinely
  // does mean the vendor unticked them, so `getAll` is the correct read and a
  // presence marker would be dead weight.
  assert.ok(
    /formData\.getAll\('compatible_venue_settings'\)/.test(src) &&
      /formData\.getAll\('compatible_ceremony_types'\)/.test(src),
    'The venue-match action stopped reading the posted checkboxes. If the read ' +
      'moved, move this assertion with it — a writer nobody checks is how these ' +
      'columns spent months holding a seed fixture.',
  );
});
