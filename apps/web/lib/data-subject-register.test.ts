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
 *   G4 · A NEW person-bearing table landing with no category. The scan is
 *        derived from the schema, not from a second hand-typed list.
 *   G5 · The guest-buyer RETENTION PROSE drifting from the foreign keys it
 *        describes. This is a printed, filed document: the first draft said the
 *        order "outlives the event by design" and "NO code deletes it", while
 *        `papic_guest_orders.event_id` is ON DELETE CASCADE and the admin event
 *        action is a hard delete. G5 reads both facts off the tree and fails if
 *        the prose stops naming them — or if a migration changes the FK.
 *   G6 · TWO RENDERED SECTIONS CLAIMING THE SAME NPC FIELD NUMBER. The
 *        categories block shipped as a second "B.3" directly under the existing
 *        "B.3 — Scale of processing"; in the adopted sheet the categories are a
 *        ROW INSIDE B.3, not a section.
 *
 * WHAT IT DOES NOT CATCH — read before trusting a green run:
 *   · It cannot tell whether a category's PROSE is legally correct. That is the
 *     DPO's job. It only proves the categories exist, are anchored in real
 *     storage, reach the screen, and — for the one entry whose prose was wrong —
 *     still name the deletion path the schema actually has.
 *   · G4 only sees tables whose person column is literally name-shaped. A table
 *     holding, say, a phone number and nothing else is invisible to it — the
 *     same structural blind spot the erasure guardrail documents.
 *   · G5 pins the CREATE TABLE declaration plus every later ALTER on that table.
 *     A constraint dropped and re-added from inside a DO block (which the shared
 *     parser cannot see either) would slip past it.
 *   · G6 reads the section titles out of the page source. It proves the printed
 *     headings are distinct; it cannot prove they are the RIGHT numbers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readSchema, MIGRATIONS_DIR } from './security/migration-schema';
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
const ADMIN_EVENT_ACTIONS = path.join(HERE, '..', 'app', 'admin', 'events', 'actions.ts');

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

/**
 * Every table with a name-shaped column.
 *
 * ⚠ THIS USED TO SKIP ANY TABLE CARRYING A FOREIGN KEY TO `public.users`, on the
 * theory that such a table describes an account holder and the account holder is
 * already declared. The theory hid `public.people` — the largest person store on
 * the platform — because its OPTIONAL `claimed_by_user_id` /
 * `created_by_user_id` links look like an account. An optional link to an account
 * is not an account. The skip is gone. It only ever hid five tables (api_keys,
 * events, people, setnayan_pay_methods, users); four are classified explicitly
 * and `users` is anchored by the customer/vendor/internal entries.
 */
function personBearingNameTables(): string[] {
  const out: string[] = [];
  for (const [table, t] of readSchema()) {
    if ([...t.cols].some((c) => NAME_COLUMN.test(c))) out.push(table);
  }
  return out.sort();
}

test('G4 · the scan is not blinded by an optional link to an account', () => {
  // Regression pin for the exact blind spot: `people` carries two FKs to
  // public.users and is still an unclaimed-person table. If a future narrowing
  // reintroduces the skip, this fails before the coverage test goes quietly
  // green on a smaller set.
  const seen = personBearingNameTables();
  assert.ok(
    seen.includes('people'),
    'the scan no longer sees public.people. It holds display_name, first/last ' +
      'name, email, phone, photo and birth_date for Persons who mostly never ' +
      'sign up — it must stay inside the guarded set.',
  );
  assert.ok(
    seen.length >= 18,
    `the scan found only ${seen.length} name-bearing tables; it saw 19 on ` +
      `2026-08-09. A scan that narrows makes every other test here weaker ` +
      `without failing.`,
  );
});

test('G4 · every person-bearing table is accounted for', () => {
  const anchored = new Set(
    Object.values(DATA_SUBJECT_REGISTER).flatMap((c) =>
      c.identityAnchors.map((a) => a.split('.')[0]!),
    ),
  );
  const unaccounted = personBearingNameTables().filter(
    (t) =>
      !anchored.has(t) &&
      !Object.prototype.hasOwnProperty.call(NAME_COLUMNS_THAT_ARE_NOT_PEOPLE, t) &&
      !Object.prototype.hasOwnProperty.call(UNCLASSIFIED_PERSON_TABLES, t),
  );
  assert.deepEqual(
    unaccounted,
    [],
    `These tables store a person's name and belong to no data-subject ` +
      `category: ${unaccounted.join(', ')}. Either the person is a listed ` +
      `category (anchor them), or the "name" is not a person (say so in ` +
      `NAME_COLUMNS_THAT_ARE_NOT_PEOPLE), or it is an open DPO question ` +
      `(UNCLASSIFIED_PERSON_TABLES — which only ever shrinks).`,
  );
});

test('G4 · the unclassified backlog never grows', () => {
  // 4 as of 2026-08-09: people, couple_waitlist_signups, dependents,
  // event_sponsors. Raised from 3 in the same change that made `people` visible
  // to the scan — the bound tracks what is actually parked, and only shrinks.
  assert.ok(
    Object.keys(UNCLASSIFIED_PERSON_TABLES).length <= 4,
    'UNCLASSIFIED_PERSON_TABLES grew. A new person source must be declared as ' +
      'a category, not parked here to make CI green.',
  );
});

test('G4 · no stale excuse — every classified table is still seen by the scan', () => {
  const seen = new Set(personBearingNameTables());
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

// ─────────────────────────────────────────────────────────────────────────────
// G5 · the guest-buyer retention prose must match the foreign keys
// ─────────────────────────────────────────────────────────────────────────────

/** Exact CREATE TABLE body for `public.<table>`, paren-balanced. */
function createTableBody(table: string): { file: string; body: string } | null {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const re = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${table}\\s*\\(`,
    'i',
  );
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const m = re.exec(sql);
    if (!m) continue;
    let depth = 0;
    for (let i = m.index + m[0].length - 1; i < sql.length; i++) {
      if (sql[i] === '(') depth++;
      else if (sql[i] === ')') {
        depth--;
        if (depth === 0) {
          return { file, body: sql.slice(m.index + m[0].length, i).replace(/--[^\n]*/g, '') };
        }
      }
    }
  }
  return null;
}

/** Body of a named exported function, comments stripped — never the whole file. */
function functionBody(file: string, signature: string): string {
  const src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf(signature);
  assert.ok(start >= 0, `"${signature}" not found in ${file} — the guard is stale`);
  const nextExport = src.indexOf('\nexport ', start + signature.length);
  return stripComments(src.slice(start, nextExport < 0 ? undefined : nextExport));
}

test('G5 · papic_guest_orders.event_id still CASCADEs, and nothing later re-points it', () => {
  const created = createTableBody('papic_guest_orders');
  assert.ok(created, 'no migration creates public.papic_guest_orders');
  const fk =
    /event_id[^,]*REFERENCES\s+public\.events\s*\(\s*event_id\s*\)\s*ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION|SET\s+DEFAULT)/i.exec(
      created.body,
    );
  assert.ok(fk, 'papic_guest_orders.event_id declares no ON DELETE action to check');
  assert.equal(
    fk[1]!.toUpperCase().replace(/\s+/g, ' '),
    'CASCADE',
    'papic_guest_orders.event_id no longer CASCADEs. The register prose describes ' +
      'a CASCADE in a document that gets filed with the NPC — re-read the FK and ' +
      'rewrite guest_buyer.retention before changing this guard.',
  );

  // …and no later ALTER re-points that FK behind the guard's back.
  for (const file of fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8').replace(/--[^\n]*/g, '');
    const alterRe =
      /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?papic_guest_orders([\s\S]*?);/gi;
    let a: RegExpExecArray | null;
    while ((a = alterRe.exec(sql))) {
      assert.ok(
        !/event_id[\s\S]*REFERENCES/i.test(a[1] ?? ''),
        `${file} alters the papic_guest_orders.event_id foreign key. G5 only reads ` +
          `the CREATE TABLE declaration, so it can no longer vouch for the register ` +
          `prose — widen this guard and re-check guest_buyer.retention.`,
      );
    }
  }
});

test('G5 · deleting an event is a hard delete, in the action itself', () => {
  const body = functionBody(ADMIN_EVENT_ACTIONS, 'export async function deleteEvent(');
  assert.match(
    body,
    /\.from\('events'\)[\s\S]{0,80}\.delete\(\)/,
    'deleteEvent no longer hard-deletes public.events. The register prose tells ' +
      'the regulator that one admin press removes the guest buyer\'s record via ' +
      'the CASCADE — re-check it before changing this guard.',
  );
});

test('G5 · the guest-buyer retention names the cascade and the hard delete', () => {
  const r = DATA_SUBJECT_REGISTER.guest_buyer.retention;

  // The two facts the first draft omitted, both scoped to THIS entry's prose —
  // not to the file, and not to the comment that explains them.
  assert.match(
    r,
    /papic_guest_orders\.event_id is ON DELETE CASCADE/i,
    'guest_buyer.retention must name the cascade that removes the row: ' +
      'papic_guest_orders.event_id is ON DELETE CASCADE.',
  );
  assert.match(
    r,
    /hard delete/i,
    'guest_buyer.retention must say that an admin deleting an event is a hard ' +
      'delete — that is the one press that triggers the cascade.',
  );
  assert.match(
    r,
    /receipts\.issued_to_name/i,
    'guest_buyer.retention must say where the typed name DOES survive: approval ' +
      'copies it to receipts.issued_to_name, and nowhere else.',
  );

  // And the claims that were false. "outlive the event" was the exact wording.
  assert.ok(
    !/outlive[sd]? the event/i.test(r),
    'guest_buyer.retention still claims the order outlives the event. It does ' +
      'not: papic_guest_orders.event_id is ON DELETE CASCADE.',
  );
  assert.ok(
    !/\bNO code deletes it\b/i.test(r),
    'guest_buyer.retention still claims NO code deletes it. app/admin/events/' +
      'actions.ts · deleteEvent does, through the cascade.',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// G6 · no two rendered sections may claim the same NPC field number
// ─────────────────────────────────────────────────────────────────────────────

/** Every section heading the page renders, from <Block title="…"> and <h2>. */
function renderedSectionTitles(): string[] {
  const src = stripComments(fs.readFileSync(DATA_SHEET_PAGE, 'utf8'));
  const titles: string[] = [];
  for (const m of src.matchAll(/<Block\s+title="([^"]+)"/g)) titles.push(m[1]!);
  for (const m of src.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)) {
    titles.push(m[1]!.replace(/\s+/g, ' ').trim());
  }
  return titles;
}

test('G6 · no two rendered sections claim the same NPC field number', () => {
  const titles = renderedSectionTitles();
  // A regex that matches nothing prints a green test. Pin the floor: the sheet
  // rendered 7 sections on 2026-08-09.
  assert.ok(
    titles.length >= 7,
    `only ${titles.length} section titles were found in the data sheet — the ` +
      `extractor stopped matching, so this test proves nothing.`,
  );

  const claimedBy = new Map<string, string[]>();
  for (const t of titles) {
    for (const m of t.matchAll(/\bB\.(\d+)\b/g)) {
      const n = `B.${m[1]}`;
      claimedBy.set(n, [...(claimedBy.get(n) ?? []), t]);
    }
  }
  const clashes = [...claimedBy.entries()].filter(([, ts]) => ts.length > 1);
  assert.deepEqual(
    clashes,
    [],
    `Two sections print the same NPC field number: ${clashes
      .map(([n, ts]) => `${n} → ${ts.join(' AND ')}`)
      .join('; ')}. This sheet is printed and filed — a document with two B.3s ` +
      `is not a filing. In the adopted sheet the categories of data subjects are ` +
      `a ROW INSIDE B.3, not a section of their own.`,
  );
  assert.ok(claimedBy.size >= 5, 'no numbered NPC sections found — the extractor is stale');
});

test('G6 · categories of data subjects renders inside B.3, not as its own section', () => {
  const src = stripComments(fs.readFileSync(DATA_SHEET_PAGE, 'utf8'));
  assert.match(
    src,
    /<h3[^>]*>\s*Categories of data subjects\s*<\/h3>/,
    'the categories block must render as a sub-heading (h3) of B.3',
  );
  for (const t of renderedSectionTitles()) {
    assert.ok(
      !/Categories of data subjects/i.test(t),
      `"${t}" promotes the categories back to a section of their own — in the ` +
        `adopted registration sheet they are a row inside B.3.`,
    );
  }
});
