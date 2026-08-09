/**
 * Guard for the CATEGORIES OF DATA SUBJECTS register (lib/data-subject-register).
 *
 * The defect this exists to prevent, stated plainly: on 2026-07-29 a person with
 * no Setnayan account became able to buy shots at a party — typing a name and
 * uploading a screenshot of their bank confirmation — and for eleven days the
 * written record named four kinds of person while the code collected from five.
 * The row declaring them was drafted and never folded in. Nothing failed.
 *
 * WHAT THIS CATCHES
 *   G1 · A category DROPPED from the register (the whole point).
 *   G2 · An identity anchor that is not a real `table.column` in the migration
 *        corpus — so a rename cannot leave the register describing storage that
 *        no longer exists.
 *   G3 · The register going UNRENDERED. A register nobody can read is not a
 *        register; the NPC data sheet must actually print it, from the data,
 *        not from a re-typed copy.
 *   G4 · A NEW account-less person-bearing table landing with no category. The
 *        scan is derived from the schema, not from a second hand-typed list.
 *
 * WHAT IT DOES NOT CATCH — read before trusting a green run:
 *   · It cannot tell whether a category's PROSE is legally correct. That is the
 *     DPO's job. It only proves the categories exist, are anchored in real
 *     storage, and reach the screen.
 *   · G4 only sees tables whose person column is literally name-shaped. A table
 *     holding, say, a phone number and nothing else is invisible to it — the
 *     same structural blind spot the erasure guardrail documents.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readSchema } from './security/migration-schema';
import {
  DATA_SUBJECT_REGISTER,
  DATA_SUBJECT_REGISTER_ORDER,
  REQUIRED_DATA_SUBJECT_CATEGORIES,
  NAME_COLUMNS_THAT_ARE_NOT_PEOPLE,
  UNCLASSIFIED_PERSON_TABLES,
  type DataSubjectCategoryKey,
} from './data-subject-register';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_SHEET_PAGE = path.join(
  HERE,
  '..',
  'app',
  'admin',
  'compliance',
  'data-sheet',
  'page.tsx',
);

/** Strip comments so an assertion can never pass on the note explaining it. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ─────────────────────────────────────────────────────────────────────────────
// G1 · no category may be dropped
// ─────────────────────────────────────────────────────────────────────────────

test('G1 · every required data-subject category is still in the register', () => {
  for (const key of REQUIRED_DATA_SUBJECT_CATEGORIES) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(DATA_SUBJECT_REGISTER, key),
      `Data-subject category "${key}" was removed from DATA_SUBJECT_REGISTER. ` +
        `Dropping a category is a DPO decision — it cannot be a side effect.`,
    );
  }
});

test('G1 · the guest who buys shots without an account is a listed category', () => {
  const c = DATA_SUBJECT_REGISTER.guest_buyer;
  assert.ok(c, 'guest_buyer is missing from the register');
  assert.equal(c.holdsAccount, false, 'the account-less buyer must be recorded as holding no account');
  assert.ok(
    c.identityAnchors.includes('papic_guest_orders.payer_name'),
    'the typed name (papic_guest_orders.payer_name) must be anchored — it is the ' +
      'personal datum that made this person a data subject in the first place',
  );
  // The payment screenshot is the other half of what is taken from them.
  assert.match(
    c.personalData.join(' | ').toLowerCase(),
    /screenshot/,
    'the payment screenshot must be listed among the data collected',
  );
});

test('G1 · the render order covers every category exactly once', () => {
  const keys = Object.keys(DATA_SUBJECT_REGISTER) as DataSubjectCategoryKey[];
  assert.deepEqual(
    [...DATA_SUBJECT_REGISTER_ORDER].sort(),
    [...keys].sort(),
    'DATA_SUBJECT_REGISTER_ORDER must list every category exactly once — a ' +
      'category missing from the order is a category nobody sees.',
  );
  assert.equal(
    new Set(DATA_SUBJECT_REGISTER_ORDER).size,
    DATA_SUBJECT_REGISTER_ORDER.length,
    'duplicate key in DATA_SUBJECT_REGISTER_ORDER',
  );
});

test('G1 · every category states what is collected, why, and the retention', () => {
  for (const [key, c] of Object.entries(DATA_SUBJECT_REGISTER)) {
    assert.ok(c.label.trim().length > 0, `${key}: empty label`);
    assert.ok(c.personalData.length > 0, `${key}: no personal-data categories listed`);
    assert.ok(c.purpose.trim().length > 0, `${key}: no purpose stated`);
    assert.ok(c.retention.trim().length > 0, `${key}: no retention stated`);
    assert.ok(c.identityAnchors.length > 0, `${key}: no identity anchor`);
    if (c.disposalDateSettled) {
      // A settled disposal date is a claim about code. It must name the code.
      assert.match(
        c.retention,
        /lib\/[a-z0-9-]+/i,
        `${key}: disposalDateSettled is true but the retention text names no ` +
          `enforcing module. Do not assert a settled date without one.`,
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// G2 · every anchor is real storage
// ─────────────────────────────────────────────────────────────────────────────

test('G2 · every identity anchor is a real table.column in supabase/migrations', () => {
  const schema = readSchema();
  for (const [key, c] of Object.entries(DATA_SUBJECT_REGISTER)) {
    for (const anchor of c.identityAnchors) {
      const parts = anchor.split('.');
      assert.equal(parts.length, 2, `${key}: anchor "${anchor}" is not table.column`);
      const table = parts[0]!;
      const column = parts[1]!;
      const t = schema.get(table);
      assert.ok(t, `${key}: anchor "${anchor}" names table "${table}", which no migration creates`);
      assert.ok(
        t.cols.has(column),
        `${key}: anchor "${anchor}" names a column the migrations never declare ` +
          `(phantom-column class: the query is REJECTED, not thrown)`,
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// G3 · the register reaches the screen
// ─────────────────────────────────────────────────────────────────────────────

test('G3 · the NPC data sheet renders the register from the data', () => {
  const src = stripComments(fs.readFileSync(DATA_SHEET_PAGE, 'utf8'));
  assert.match(
    src,
    /from '@\/lib\/data-subject-register'/,
    'the NPC data sheet must import the register — a register nothing renders is ' +
      'a mechanism never proven reachable',
  );
  assert.match(
    src,
    /DATA_SUBJECT_REGISTER_ORDER\s*\.\s*map/,
    'the data sheet must iterate DATA_SUBJECT_REGISTER_ORDER, so adding a ' +
      'category is enough to make it appear',
  );
  assert.match(src, /Categories of data subjects/, 'the B.3 heading is missing');
  // And it must not re-type the categories: a second copy is the original defect.
  for (const c of Object.values(DATA_SUBJECT_REGISTER)) {
    assert.ok(
      !src.includes(c.label),
      `the data sheet hardcodes the label "${c.label}" instead of reading it from ` +
        `the register — that is the second copy this file exists to prevent`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// G4 · no account-less person source may land unclassified
// ─────────────────────────────────────────────────────────────────────────────

/** Free-text person-name column shapes. */
const NAME_COLUMN =
  /^(payer_name|full_name|contact_name|first_name|last_name|guest_name|author_name|person_name|display_name|name)$/;

/** Tables with a name-shaped column and NO foreign key to public.users. */
function accountlessNameTables(): string[] {
  const out: string[] = [];
  for (const [table, t] of readSchema()) {
    if (t.userFks.size > 0) continue;
    if ([...t.cols].some((c) => NAME_COLUMN.test(c))) out.push(table);
  }
  return out.sort();
}

test('G4 · every account-less person-bearing table is accounted for', () => {
  const anchored = new Set(
    Object.values(DATA_SUBJECT_REGISTER).flatMap((c) =>
      c.identityAnchors.map((a) => a.split('.')[0]!),
    ),
  );
  const unaccounted = accountlessNameTables().filter(
    (t) =>
      !anchored.has(t) &&
      !Object.prototype.hasOwnProperty.call(NAME_COLUMNS_THAT_ARE_NOT_PEOPLE, t) &&
      !Object.prototype.hasOwnProperty.call(UNCLASSIFIED_PERSON_TABLES, t),
  );
  assert.deepEqual(
    unaccounted,
    [],
    `These tables store a name with no account behind it and belong to no ` +
      `data-subject category: ${unaccounted.join(', ')}. Either the person is a ` +
      `listed category (anchor them), or the "name" is not a person (say so in ` +
      `NAME_COLUMNS_THAT_ARE_NOT_PEOPLE), or it is an open DPO question ` +
      `(UNCLASSIFIED_PERSON_TABLES — which only ever shrinks).`,
  );
});

test('G4 · the unclassified backlog never grows', () => {
  // 3 as of 2026-08-09: couple_waitlist_signups, dependents, event_sponsors.
  assert.ok(
    Object.keys(UNCLASSIFIED_PERSON_TABLES).length <= 3,
    'UNCLASSIFIED_PERSON_TABLES grew. A new account-less person source must be ' +
      'declared as a category, not parked here to make CI green.',
  );
});

test('G4 · no stale excuse — every classified table is still seen by the scan', () => {
  const seen = new Set(accountlessNameTables());
  for (const t of [
    ...Object.keys(NAME_COLUMNS_THAT_ARE_NOT_PEOPLE),
    ...Object.keys(UNCLASSIFIED_PERSON_TABLES),
  ]) {
    assert.ok(
      seen.has(t),
      `"${t}" is classified but the scan no longer sees it — either it was ` +
        `renamed/dropped (remove the entry) or the scan narrowed (fix the scan). ` +
        `A dead excuse silently shrinks the guarded set.`,
    );
  }
});
