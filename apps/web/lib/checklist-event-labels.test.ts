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
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checklistChrome } from '@/lib/checklist';
import { EVENT_TYPE_CHECKLIST_DEFS } from '@/lib/checklist-event-type-defs';

/**
 * The `event_type_vocab` roster (Postgres), as of migration 20270726622326 —
 * all 14 rows are status='active' AND enabled=TRUE, so every one of them can
 * reach `checklistChrome`. `burial` is deliberately absent (owner-RETIRED
 * 2026-05-16).
 *
 * ⚠ HONEST WEAKNESS: this list is HAND-MAINTAINED, which makes it the weaker of
 * the two assertions below. The roster lives in the database and there is no TS
 * constant to import. `EVENT_TYPES_FALLBACK`
 * (app/dashboard/(account)/create-event/_components/event-types.ts) is NOT a
 * substitute — it is a frozen 9-row fail-open fallback whose own header says
 * "Do NOT add new types here", so importing it would assert only the rows that
 * already pass. Parsing supabase/migrations/*.sql at test time was considered
 * and rejected (cross-package file IO, brittle against multi-row INSERT/UPDATE
 * forms). So this catches a type added to the vocab *and* remembered here, and
 * it does NOT catch a type an admin creates at runtime via /admin/event-types.
 * Assertion (a) — the import-driven one — is the load-bearing half.
 */
const EVENT_TYPE_VOCAB_KEYS = [
  'wedding',
  'birthday',
  'celebration',
  'travel',
  'corporate',
  'tournament',
  'christening',
  'gender_reveal',
  'debut',
  'anniversary',
  'graduation',
  'reunion',
  'gala_night',
  'simple_event',
] as const;

/** (a) The self-maintaining half: every per-type checklist def needs a label. */
test('every event type with a checklist def has non-wedding chrome', () => {
  const wedding = checklistChrome('wedding');
  for (const key of Object.keys(EVENT_TYPE_CHECKLIST_DEFS)) {
    assert.notDeepEqual(
      checklistChrome(key),
      wedding,
      `'${key}' has a checklist def but no CHECKLIST_EVENT_LABELS entry — it renders WEDDING chrome`,
    );
  }
});

/** (b) The hand-listed half: every creatable vocab type needs a label. */
test('every event_type_vocab type gets its own checklist chrome (no wedding fall-through)', () => {
  const wedding = checklistChrome('wedding');
  for (const key of EVENT_TYPE_VOCAB_KEYS.filter((k) => k !== 'wedding')) {
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
