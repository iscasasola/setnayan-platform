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
 * tested (revert the thing, watch the named test fail):
 *
 *   1. `roster` — THE LOAD-BEARING TEST. Derived from `ANCHOR_BY_TYPE`, so it
 *      covers the five at-risk types and fails the moment a type is added to
 *      that map without a label. Verified: delete any of the five entries from
 *      `CHECKLIST_EVENT_LABELS` → this test fails.
 *   2. `roster sources agree` — keeps test 1's roster honest. It cross-checks
 *      two INDEPENDENTLY-maintained production maps that are each keyed by the
 *      full vocab, so a type half-added to the codebase is loud. Verified:
 *      remove a key from either map → this test fails.
 *   3. `newly-labelled types render the expected copy` — pins the exact strings
 *      of the five entries this fix added (a rename/typo regression, which
 *      test 1 would not see because renamed copy is still non-wedding).
 *   4. `unknown event types still fall back to wedding chrome` — pins the
 *      deliberate fall-through so a future "helpfully" derived-from-key default
 *      cannot land unnoticed.
 *
 * The assertion that USED to be labelled "the load-bearing half" — looping
 * `EVENT_TYPE_CHECKLIST_DEFS` — was that label's opposite. It PASSED against
 * pre-fix code and can never catch this bug class: the at-risk types are
 * precisely the ones with no dedicated def, which route through
 * `GENERIC_EVENT_CHECKLIST_DEF` and so never appear in that registry at all
 * (lib/checklist-event-type-defs.ts). Its only non-decorative content — that a
 * def key must be inside the roster — survives as an assertion inside test 2.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checklistChrome } from '@/lib/checklist';
import { EVENT_TYPE_CHECKLIST_DEFS } from '@/lib/checklist-event-type-defs';
import { ANCHOR_BY_TYPE } from '@/lib/event-anchor';
import { SPECIALTY_CATALOG } from '@/lib/onboarding/specialty-catalog';

/**
 * The creatable-type roster, DERIVED — not hand-listed. `ANCHOR_BY_TYPE`
 * (lib/event-anchor.ts) is keyed by exactly the 14 active+enabled
 * `event_type_vocab` rows as of migration 20270726622326 (`burial` deliberately
 * absent — owner-RETIRED 2026-05-16), and it is load-bearing production code:
 * the create-event action stamps `events.anchor_kind` from it, so a new type
 * has to be added there or its anchor silently degrades to `FALLBACK_ANCHOR`.
 *
 * HONEST LIMIT: this is still a TypeScript map, not a live read of the DB. A
 * type an admin creates at runtime via /admin/event-types — or one added to the
 * SQL vocab and to neither map below — is caught by nothing here. What is now
 * impossible is the failure that actually happened: a type wired into the app's
 * type maps but forgotten in `CHECKLIST_EVENT_LABELS`.
 */
const EVENT_TYPE_ROSTER = Object.keys(ANCHOR_BY_TYPE);

/**
 * Guards the roster ITSELF. `ANCHOR_BY_TYPE` and `SPECIALTY_CATALOG` are
 * maintained by different features (date anchors vs. onboarding signature
 * fields) and are each keyed by the whole vocab, so requiring them to agree
 * turns "added the type to one place only" into a failing test rather than a
 * quietly-shrunken roster for the test above. The defs registry is a legitimate
 * SUBSET (only 8 types have a dedicated checklist template).
 */
test('roster sources agree (ANCHOR_BY_TYPE ≡ SPECIALTY_CATALOG ⊇ checklist defs)', () => {
  const anchor = [...EVENT_TYPE_ROSTER].sort();
  const specialty = Object.keys(SPECIALTY_CATALOG).sort();
  assert.deepEqual(
    anchor,
    specialty,
    'ANCHOR_BY_TYPE and SPECIALTY_CATALOG disagree — an event type was added to one map but not the other; the checklist roster below is derived from the first, so fix the drift before trusting it',
  );
  for (const key of Object.keys(EVENT_TYPE_CHECKLIST_DEFS)) {
    assert.ok(
      EVENT_TYPE_ROSTER.includes(key),
      `'${key}' has a checklist def but is missing from ANCHOR_BY_TYPE — the derived roster would skip it`,
    );
  }
  // Cheap tripwire: the roster is the vocab, so it can only grow.
  assert.ok(EVENT_TYPE_ROSTER.length >= 14, 'event type roster shrank below the 14 vocab rows');
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
