/**
 * repeat-is-one-decision.test.ts — the repeat has ONE decider, ONE per-type map,
 * and no door back to the retired death-anniversary product.
 *
 * ─── WHAT THIS EXISTS TO CATCH ───────────────────────────────────────────────
 * 🔴 "Can this repeat?" used to have THREE answers in three files —
 * `RECUR_TOGGLE_TYPES` (6 types), `RECURRENCE_CAPABLE_TYPES` (4 types), and the
 * create/onboarding actions forcing two more. Only `reunion` and `corporate`
 * were in both lists. **Birthday was in one and not the other, and that was a
 * live defect**: a birthday created from the create-event grid landed with
 * `recurs = false`, so the Year view's birthday branch never fired and that
 * person's birthday never appeared — while the other creation path set it true
 * for the same type. Same event, two answers, and `recurs` had no UPDATE path,
 * so it could never be corrected.
 *
 * 🔴 And a repeat CADENCE is exactly the widening that reopens a product the
 * owner retired: any date + the old `'matters'` origin + annual + the shipped
 * anniversary email IS a death-anniversary tracker. The 2026-07-12 council said
 * so in writing and ruled the burial lock wins — *"Label-only guardrails don't
 * hold."* The option is gone; this pins that it stays gone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import {
  ANCHOR_ORIGINS,
  ANCHOR_ORIGIN_LABELS,
  CADENCES_BY_TYPE,
  RECUR_CADENCES,
  cadencesForType,
  resolveCadence,
} from './event-anchor';

const WEB = join(import.meta.dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

const SOURCES = [join(WEB, 'app'), join(WEB, 'lib')].flatMap((d) => walk(d));

test('🔴 the death-anniversary origin cannot come back', () => {
  assert.ok(!(ANCHOR_ORIGINS as readonly string[]).includes('matters'));
  // Not just the key — an open-ended LABEL is the actual hazard, because that
  // is what a grieving person answers with. The old guard searched keys for
  // /memorial|death|luksa/ and passed for a year while "A date that matters to
  // us" sat in the picker.
  for (const label of Object.values(ANCHOR_ORIGIN_LABELS)) {
    assert.ok(
      !/matters|anything|whatever|other|remember/i.test(label),
      `open-ended or memorial-adjacent origin label: "${label}"`,
    );
  }
});

test('🔴 no shipped source offers a "matters" origin', () => {
  // Comments stripped — this repo has had FIVE guards fooled by prose about the
  // thing they count, including the docblock that explains this very removal.
  const offenders = SOURCES.filter((f) => /['"`]matters['"`]/.test(stripComments(readFileSync(f, 'utf8'))));
  assert.deepEqual(
    offenders.map((f) => f.slice(WEB.length + 1)),
    [],
    'a retired anchor origin is being written or offered again',
  );
});

test('every cadence in the map is a legal cadence', () => {
  for (const [type, cadences] of Object.entries(CADENCES_BY_TYPE)) {
    for (const c of cadences) {
      assert.ok(
        (RECUR_CADENCES as readonly string[]).includes(c),
        `${type} lists an unknown cadence "${c}"`,
      );
    }
    // Ordered coarsest-last, matching RECUR_CADENCES, so a picker renders in a
    // sane order without each call site re-sorting.
    const idx = cadences.map((c) => RECUR_CADENCES.indexOf(c));
    assert.deepEqual([...idx].sort((a, b) => a - b), idx, `${type}'s cadences are out of order`);
  }
});

test('the map covers every live event type — a new type cannot repeat by accident', () => {
  // The 17 live types. A type MISSING from the map cannot repeat, which is the
  // safe direction (event_type_vocab is admin-editable at runtime), but it must
  // be an explicit decision rather than an oversight.
  const LIVE = [
    'wedding', 'debut', 'gender_reveal', 'birthday', 'celebration', 'travel',
    'corporate', 'tournament', 'christening', 'anniversary', 'graduation',
    'reunion', 'gala_night', 'simple_event', 'date', 'hangout',
    // funeral: [] — it happens once; a death anniversary (babang luksa) is a
    // different event a family creates, not this one repeating.
    'wake',
  ];
  for (const t of LIVE) {
    assert.ok(t in CADENCES_BY_TYPE, `${t} has no entry in CADENCES_BY_TYPE`);
  }
  assert.deepEqual(
    Object.keys(CADENCES_BY_TYPE).filter((k) => !LIVE.includes(k)),
    [],
    'CADENCES_BY_TYPE has an entry for a type that is not live',
  );
});

test('an unknown type refuses every cadence rather than defaulting to one', () => {
  assert.deepEqual([...cadencesForType('some_future_type')], []);
  assert.equal(resolveCadence('some_future_type', 'annual'), null);
  assert.equal(resolveCadence(null, 'annual'), null);
  assert.equal(resolveCadence(undefined, 'weekly'), null);
});

test('every write path resolves the repeat through the ONE decider', () => {
  // 🔑 The three-way disagreement started because each path had its own rule.
  // Any file that writes `recur_cadence` must get the value from resolveCadence.
  const writers = SOURCES.filter((f) => {
    const src = stripComments(readFileSync(f, 'utf8'));
    // Both shapes: an object-literal payload (`recur_cadence:`) and a patch
    // assignment (`updatePatch.recur_cadence =`). Matching only the first found
    // 2 of the 3 writers and would have let the edit path drift.
    return /\brecur_cadence\s*[:=]/.test(src);
  });
  // 🪤 A THRESHOLD CANNOT LOCALISE. This was `writers.length >= 3` and the
  // mutation run proved it decoration: there are FOUR write paths, so deleting
  // the clone's cadence left three and the guard stayed green while a monthly
  // event silently came back annual. The SET is pinned instead, so losing any
  // one of them fails by name.
  assert.deepEqual(
    writers.map((f) => f.slice(WEB.length + 1)).sort(),
    [
      'app/dashboard/(account)/create-event/actions.ts',
      'app/dashboard/[eventId]/actions.ts',
      'lib/event-recurrence.ts',
      'lib/onboarding/event-insert.ts',
    ],
    'a repeat write path was added or lost — every one must go through resolveCadence',
  );
  for (const f of writers) {
    const src = stripComments(readFileSync(f, 'utf8'));
    assert.ok(
      /\bresolveCadence\s*\(/.test(src),
      `${f.slice(WEB.length + 1)} writes recur_cadence without resolveCadence — that is how the birthday defect happened`,
    );
  }
});

test('the repeat is editable after creation — the promise the product already makes', () => {
  // The onboarding wizard says "You can change this later." under the yearly
  // question. Until 2026-08-15 nothing could. This pins that an UPDATE path
  // exists, matched on the act (a patch key), not on a symbol name.
  const actions = readFileSync(join(WEB, 'app/dashboard/[eventId]/actions.ts'), 'utf8');
  const src = stripComments(actions);
  assert.ok(
    /updatePatch\.recur_cadence\s*=/.test(src),
    'no update path writes recur_cadence — the "change this later" promise is empty again',
  );
  assert.ok(
    /updatePatch\.recurs\s*=/.test(src),
    'the cadence must move together with the switch — the DB CHECK refuses one without the other',
  );
});
