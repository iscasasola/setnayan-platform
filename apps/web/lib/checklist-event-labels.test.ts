/**
 * Guardrail suite for `CHECKLIST_EVENT_LABELS` (lib/checklist.ts).
 *
 * The invariant: an event type a couple can actually create must never render
 * its checklist under WEDDING chrome. `checklistChrome()` deliberately falls
 * back to the wedding copy for an unknown key — that is the right default for a
 * typo or an admin-invented type (deriving copy from a raw key would print
 * "Gala_night checklist") — but it means a type added to `event_type_vocab`
 * without a matching label entry FAILS SILENTLY: the page seeds a real,
 * populated checklist and then titles it "Wedding checklist". That is exactly
 * what happened when migration 20270726622326 ("enable them all") turned on
 * anniversary · graduation · reunion · gala_night, and 20270307127948 added
 * simple_event. These tests make the next such gap loud.
 *
 * WHAT EACH TEST HERE CAN AND CANNOT CATCH — every claim below was mutation-
 * tested (revert the thing, watch the named test fail). Listed in file/TAP
 * order, so `not ok 2` maps to the second item.
 *
 *   `checklist defs stay inside the derived roster` — a cheap consistency
 *      check, NOT the guardrail. It only fires if a type has a dedicated
 *      checklist def but no `ANCHOR_BY_TYPE` entry. Verified: delete a key
 *      from `ANCHOR_BY_TYPE` that has a def (e.g. `debut`) → this fails.
 *   `roster: every creatable event type gets its own checklist chrome` — THE
 *      LOAD-BEARING TEST. Derived from `ANCHOR_BY_TYPE`, so it covers the five
 *      at-risk types and fails the moment a type is added to that map without
 *      a label. Verified: delete any of the five entries from
 *      `CHECKLIST_EVENT_LABELS` → this test fails; add a 15th type to
 *      `ANCHOR_BY_TYPE` without a label → ONLY this test fails.
 *   `newly-labelled types render the expected copy` — pins the exact strings
 *      of the five entries this fix added (a rename/typo regression, which the
 *      roster test would not see because renamed copy is still non-wedding).
 *   `unknown event types still fall back to wedding chrome` — pins the
 *      deliberate fall-through so a future "helpfully" derived-from-key default
 *      cannot land unnoticed.
 *
 * The assertion that USED to be labelled "the load-bearing half" — looping
 * `EVENT_TYPE_CHECKLIST_DEFS` — was that label's opposite. It PASSED against
 * pre-fix code and can never catch this bug class: the at-risk types are
 * precisely the ones with no dedicated def, which route through
 * `GENERIC_EVENT_CHECKLIST_DEF` and so never appear in that registry at all
 * (lib/checklist-event-type-defs.ts). Its only non-decorative content — that a
 * def key must be inside the roster — survives as the first test below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checklistChrome } from '@/lib/checklist';
import { EVENT_TYPE_CHECKLIST_DEFS } from '@/lib/checklist-event-type-defs';
import { ANCHOR_BY_TYPE } from '@/lib/event-anchor';

/**
 * The creatable-type roster, derived rather than hand-listed IN THIS FILE.
 * `ANCHOR_BY_TYPE` (lib/event-anchor.ts) is keyed by exactly the 14
 * active+enabled `event_type_vocab` rows as of migration 20270726622326
 * (`burial` deliberately absent — owner-RETIRED 2026-05-16), and it is
 * load-bearing production code: the create-event action stamps
 * `events.anchor_kind` from it, so a new type has to be added there or its
 * anchor silently degrades to `FALLBACK_ANCHOR`.
 *
 * WHAT KEEPS THAT MAP HONEST IS NOT THIS FILE: `lib/event-anchor.test.ts`
 * deep-equals its keys against a hand-listed 14, and
 * `lib/onboarding/specialty-catalog.test.ts` pins `SPECIALTY_CATALOG` to the
 * same 14. So adding a 15th type still means editing hand-maintained arrays —
 * the derivation removes this file's copy of the list, not hand maintenance
 * overall. (An earlier revision of this file cross-checked those two maps
 * against each other; that assertion was deleted because both are already
 * key-pinned in their own suites, so it could not catch anything new, and it
 * coupled the checklist suite to onboarding — a type shipped without an
 * onboarding specialty spec is a state production tolerates
 * (`getSpecialtySpec` returns null).)
 *
 * HONEST LIMIT: this is still a TypeScript map, not a live read of the DB. A
 * type an admin creates at runtime via /admin/event-types — or one added to the
 * SQL vocab and to no TS map — is caught by nothing here. What is now
 * impossible is the failure that actually happened: a type wired into the app's
 * type maps but forgotten in `CHECKLIST_EVENT_LABELS`.
 */
const EVENT_TYPE_ROSTER = Object.keys(ANCHOR_BY_TYPE);

/**
 * Consistency only, and deliberately narrow: the defs registry is a legitimate
 * SUBSET of the roster (only 8 of the 14 types have a dedicated checklist
 * template), so all this can say is that a type with a def must also have an
 * anchor. It is NOT what makes a missing label loud — the roster test below is.
 */
test('checklist defs stay inside the derived roster', () => {
  for (const key of Object.keys(EVENT_TYPE_CHECKLIST_DEFS)) {
    assert.ok(
      EVENT_TYPE_ROSTER.includes(key),
      `'${key}' has a checklist def but is missing from ANCHOR_BY_TYPE — the derived roster would skip it`,
    );
  }
});

/** Every creatable type must get its own chrome — no wedding fall-through. */
test('roster: every creatable event type gets its own checklist chrome', () => {
  const wedding = checklistChrome('wedding');
  for (const key of EVENT_TYPE_ROSTER.filter((k) => k !== 'wedding')) {
    const chrome = checklistChrome(key);
    assert.notDeepEqual(
      chrome,
      wedding,
      `'${key}' silently renders WEDDING chrome — add it to CHECKLIST_EVENT_LABELS`,
    );
    assert.equal(chrome.showPhaseBlurbs, false, `'${key}' shows wedding-specific phase blurbs`);
    assert.ok(!chrome.intro.includes('18 months'), `'${key}' carries wedding runway copy`);
    // Title-case: the copy is interpolated straight into headings.
    assert.match(chrome.pageTitle, /^[A-Z]/, `'${key}' title is not Title-case`);
  }
});

/** Exact copy for the five types this fix added. */
test('newly-labelled types render the expected copy', () => {
  const anniv = checklistChrome('anniversary');
  assert.equal(anniv.heading, 'Anniversary checklist');
  assert.equal(anniv.eyebrow, 'Your anniversary');
  assert.equal(anniv.pageTitle, 'Anniversary checklist · Setnayan');
  assert.equal(anniv.dayOfLabel, 'Anniversary day & after');

  assert.equal(checklistChrome('graduation').heading, 'Graduation checklist');
  assert.equal(checklistChrome('reunion').eyebrow, 'Your reunion');
  assert.equal(checklistChrome('gala_night').eyebrow, 'Your gala night');
  assert.equal(checklistChrome('gala_night').heading, 'Gala Night checklist');
  // `simple_event` reads as plain "Event", not the vocab's "Simple Event".
  assert.equal(checklistChrome('simple_event').heading, 'Event checklist');
  assert.equal(checklistChrome('simple_event').dayOfLabel, 'Event day & after');
});

/**
 * The unknown-key fall-through is UNCHANGED by this fix. A key that is not in
 * the map still gets the wedding chrome — the safe default for a typo or a
 * runtime-created type. Mirrors the assertion in lib/checklist.test.ts.
 */
test('unknown event types still fall back to wedding chrome', () => {
  assert.deepEqual(checklistChrome('quinceanera'), checklistChrome('wedding'));
  assert.deepEqual(checklistChrome(null), checklistChrome('wedding'));
});
