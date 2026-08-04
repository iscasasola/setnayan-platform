/**
 * RECURSIVE PACKAGE CUSTOMIZATION — schema verification against the FULL
 * replayed prod schema (every migration, in order, in an in-memory PGlite).
 * Covers 20271012816361_package_item_option_branching_followups_pick_range_and_
 * extra_hour_cap.
 *
 * What is asserted here (things a pure unit test cannot prove):
 *   • the migration APPLIES on top of the whole corpus — its own post-condition
 *     block would have aborted it otherwise, and the repo has shipped
 *     half-applied migrations before;
 *   • all three columns are NULLABLE with no default, so every row that existed
 *     before the migration is byte-identical after it. A NOT NULL or a non-null
 *     default here would silently re-shape every package in the product;
 *   • the pick_min/pick_max CHECK is BOTH-OR-NEITHER and refuses 0 and an
 *     inverted range — a line asking for more picks than it offers is a
 *     configurator the couple cannot get past;
 *   • max_extra_hours refuses a negative cap;
 *   • the cycle guard refuses a self-parent, a 2-cycle and a chain 6 levels
 *     deep, and lets a 5-level chain through. A cycle would hang the couple-side
 *     renderer, which walks children to decide what to show;
 *   • a parent option in ANOTHER package is refused — parent_option_id is a
 *     bare FK across every vendor's options, so without the guard one package
 *     could hang a line off another vendor's option;
 *   • deleting the parent option CASCADES the follow-up away, rather than
 *     SET NULL promoting it into a line every couple sees;
 *   • 💰 a follow-up can be NEITHER default-included NOR required
 *     (20271015207377) — either one charges every couple for a line only some
 *     of them are ever shown, and cascades a booked vendor row for it. Ordinary
 *     top-level lines keep all three of their legal shapes;
 *   • the trigger function is not EXECUTE-able by anon or authenticated.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let vendorProfileId: string;
let packageId: string;
/** A second package owned by the SAME vendor — the cross-package probe. */
let otherPackageId: string;

/**
 * Insert a line, returning its item_id.
 *
 * `is_default_included` is written explicitly as `parentOptionId IS NULL`
 * because the column DEFAULTS TO TRUE and a follow-up may never be
 * default-included (`vendor_package_items_followup_not_default_included_ck`,
 * migration 20271015207377). Leaving it to the default would make every
 * follow-up in this file the exact shape that constraint refuses — the helper
 * has to author the legal shape so the tests below probe the guards they are
 * actually about.
 */
async function addItem(
  pkgId: string,
  description: string,
  parentOptionId: string | null = null,
): Promise<string> {
  const r = await db.query<{ item_id: string }>(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description,
        replacement_value_centavos, display_order, parent_option_id,
        is_default_included)
     VALUES ($1, 'catering', $2, 100000, 0, $3, $4)
     RETURNING item_id`,
    [pkgId, description, parentOptionId, parentOptionId === null],
  );
  return r.rows[0]!.item_id;
}

/** Insert an alternative on a line, returning its option_id. */
async function addOption(itemId: string, label: string): Promise<string> {
  const r = await db.query<{ option_id: string }>(
    `INSERT INTO public.vendor_package_item_options
       (item_id, option_label, price_delta_centavos, display_order)
     VALUES ($1, $2, 0, 0)
     RETURNING option_id`,
    [itemId, label],
  );
  return r.rows[0]!.option_id;
}

async function newPackage(name: string): Promise<string> {
  const r = await db.query<{ package_id: string }>(
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, total_price_centavos,
        consumable_budget_centavos, is_consumable_flexible, primary_canonical_service)
     VALUES ($1, $2, 2000000, 0, FALSE, 'reception_venue')
     RETURNING package_id`,
    [vendorProfileId, name],
  );
  return r.rows[0]!.package_id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  // account_type 'customer' so the auth trigger does not mint a competing
  // vendor_profiles row (same reason as package-credit-schema.db.test.ts).
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('pkg-branching-vendor@example.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Branching Test Hotel') RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  vendorProfileId = vp.rows[0]!.vendor_profile_id;

  packageId = await newPackage('Branching Package');
  otherPackageId = await newPackage('A Different Package');
});

after(async () => {
  await db?.close();
});

/* ── the migration itself ───────────────────────────────────────────────────*/

test('the branching migration applied on top of the full corpus', () => {
  assert.ok(replay.applied > 0, 'migrations replayed');
  assert.ok(
    !replay.skipped.some((s) => s.file.includes('package_item_option_branching')),
    `the branching migration must not be skipped, skipped = ${JSON.stringify(
      replay.skipped.map((s) => s.file),
    )}`,
  );
});

test('all three columns exist, NULLABLE, with no default — today unchanged', async () => {
  const r = await db.query<{
    column_name: string;
    is_nullable: string;
    column_default: string | null;
    data_type: string;
  }>(
    `SELECT column_name, is_nullable, column_default, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vendor_package_items'
        AND column_name IN ('parent_option_id','pick_min','pick_max','max_extra_hours')
      ORDER BY column_name`,
  );
  assert.deepEqual(
    r.rows.map((c) => c.column_name),
    ['max_extra_hours', 'parent_option_id', 'pick_max', 'pick_min'],
    'all four branching columns must exist',
  );
  for (const c of r.rows) {
    assert.equal(
      c.is_nullable,
      'YES',
      `${c.column_name} must be NULLABLE — a NOT NULL would re-shape every existing line`,
    );
    assert.equal(
      c.column_default,
      null,
      `${c.column_name} must have NO default — a default is a behaviour change on every row`,
    );
  }
  assert.equal(
    r.rows.find((c) => c.column_name === 'parent_option_id')!.data_type,
    'uuid',
  );
});

test('an ordinary line still inserts with all four columns NULL', async () => {
  const itemId = await addItem(packageId, 'Plain buffet line');
  const r = await db.query<{
    parent_option_id: string | null;
    pick_min: number | null;
    pick_max: number | null;
    max_extra_hours: number | null;
  }>(
    `SELECT parent_option_id, pick_min, pick_max, max_extra_hours
       FROM public.vendor_package_items WHERE item_id = $1`,
    [itemId],
  );
  assert.deepEqual(r.rows[0], {
    parent_option_id: null,
    pick_min: null,
    pick_max: null,
    max_extra_hours: null,
  });
});

test('the parent_option_id index exists — the renderer scans by it', async () => {
  const r = await db.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'vendor_package_items_parent_option_idx'`,
  );
  assert.equal(r.rows.length, 1, 'expected vendor_package_items_parent_option_idx');
});

/* ── pick_min / pick_max ────────────────────────────────────────────────────*/

test('pick_min/pick_max is BOTH-OR-NEITHER, >= 1, and min <= max', async () => {
  const itemId = await addItem(packageId, 'Choose your sides');

  const reject = async (min: number | null, max: number | null, why: string) =>
    assert.rejects(
      db.query(
        `UPDATE public.vendor_package_items SET pick_min = $2, pick_max = $3 WHERE item_id = $1`,
        [itemId, min, max],
      ),
      /check/i,
      why,
    );

  await reject(1, null, 'a half-set pair has no defined meaning — max must be set too');
  await reject(null, 3, 'a half-set pair has no defined meaning — min must be set too');
  await reject(0, 3, 'pick_min = 0 means "optional", which is is_required/is_default_included');
  await reject(3, 2, 'an inverted range can never be satisfied');
  await reject(-1, 2, 'a negative pick count is meaningless');

  // The two legal shapes.
  await db.query(
    `UPDATE public.vendor_package_items SET pick_min = 2, pick_max = 3 WHERE item_id = $1`,
    [itemId],
  );
  await db.query(
    `UPDATE public.vendor_package_items SET pick_min = NULL, pick_max = NULL WHERE item_id = $1`,
    [itemId],
  );
  await db.query(
    `UPDATE public.vendor_package_items SET pick_min = 1, pick_max = 1 WHERE item_id = $1`,
    [itemId],
  );
});

/* ── max_extra_hours ────────────────────────────────────────────────────────*/

test('max_extra_hours refuses a negative cap and allows 0 / NULL', async () => {
  const itemId = await addItem(packageId, 'Coverage hours');

  await assert.rejects(
    db.query(
      `UPDATE public.vendor_package_items SET max_extra_hours = -1 WHERE item_id = $1`,
      [itemId],
    ),
    /check/i,
    'a negative ceiling would price a NEGATIVE number of extra hours',
  );

  // 0 = "fixed at min_hours", NULL = uncapped. Both are real answers.
  await db.query(
    `UPDATE public.vendor_package_items SET max_extra_hours = 0 WHERE item_id = $1`,
    [itemId],
  );
  await db.query(
    `UPDATE public.vendor_package_items SET max_extra_hours = 6 WHERE item_id = $1`,
    [itemId],
  );
  await db.query(
    `UPDATE public.vendor_package_items SET max_extra_hours = NULL WHERE item_id = $1`,
    [itemId],
  );
});

/* ── A FOLLOW-UP IS NEVER INSIDE THE PRICE ──────────────────────────────────*/

/*
 * `vendor_package_items_followup_not_default_included_ck` (migration
 * 20271015207377). A follow-up is shown only once its parent option is picked,
 * so `is_default_included = TRUE` on one would charge EVERY couple for a line
 * most of them never see, inflate the booking fee taken off that total, and
 * cascade an event_vendors row at lock for a service nobody chose.
 *
 * This is a SCHEMA rule rather than a filter in the pricing code on purpose:
 * with is_default_included forced FALSE, every existing reader (keptItems,
 * computeCustomization, the credit engine, the cascade) is already correct
 * without knowing follow-ups exist.
 *
 * NEUTRALISATION: drop the constraint and the two rejection tests below go
 * green-to-red — the priced follow-up inserts happily.
 */

test('the follow-up money guard exists and is VALIDATED', async () => {
  // A constraint that exists but is NOT VALID enforces nothing over the rows
  // already there, which is indistinguishable from absent when it matters.
  const r = await db.query<{ def: string; convalidated: boolean }>(
    `SELECT pg_get_constraintdef(oid) AS def, convalidated
       FROM pg_constraint
      WHERE conrelid = 'public.vendor_package_items'::regclass
        AND conname = 'vendor_package_items_followup_not_default_included_ck'`,
  );
  assert.equal(r.rows.length, 1, 'the constraint must exist');
  assert.equal(r.rows[0]!.convalidated, true, 'NOT VALID enforces nothing');
  // BOTH doors are named in THIS constraint, so it states the whole rule about
  // follow-ups on its own. `is_required` is also blocked by
  // vendor_package_items_required_implies_included, and relaxing THAT one must
  // not silently re-open this hazard.
  assert.match(r.rows[0]!.def, /parent_option_id IS NULL/);
  assert.match(r.rows[0]!.def, /is_default_included = false/);
  assert.match(r.rows[0]!.def, /is_required = false/);
});

test('a follow-up marked default-included is REFUSED', async () => {
  const parent = await addItem(packageId, 'Priced-followup parent');
  const option = await addOption(parent, 'Lechon');

  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_package_items
         (package_id, canonical_service, service_description,
          replacement_value_centavos, display_order, parent_option_id,
          is_default_included)
       VALUES ($1, 'catering', 'Which style of lechon?', 300000, 0, $2, TRUE)`,
      [packageId, option],
    ),
    /vendor_package_items_followup_not_default_included_ck/,
    'a default-included follow-up charges every couple for a line most never see',
  );
});

test('promoting an EXISTING follow-up into the price is REFUSED', async () => {
  // The UPDATE door. A follow-up authored legally must not be flipped into the
  // package price afterwards — same overcharge, later.
  const parent = await addItem(packageId, 'Promote parent');
  const option = await addOption(parent, 'Promote option');
  const followUp = await addItem(packageId, 'Promote follow-up', option);

  await assert.rejects(
    db.query(
      `UPDATE public.vendor_package_items SET is_default_included = TRUE WHERE item_id = $1`,
      [followUp],
    ),
    /vendor_package_items_followup_not_default_included_ck/,
  );
});

test('a follow-up marked required is REFUSED, in BOTH spellings', async () => {
  const parent = await addItem(packageId, 'Required-followup parent');
  const option = await addOption(parent, 'Required option');

  const insert = (included: boolean, required: boolean) =>
    db.query(
      `INSERT INTO public.vendor_package_items
         (package_id, canonical_service, service_description,
          replacement_value_centavos, display_order, parent_option_id,
          is_default_included, is_required)
       VALUES ($1, 'catering', 'Required follow-up', 300000, 0, $2, $3, $4)`,
      [packageId, option, included, required],
    );

  // required + included → the follow-up guard speaks.
  await assert.rejects(
    insert(true, true),
    /vendor_package_items_followup_not_default_included_ck/,
    'a required follow-up cannot be dropped AND was never chosen',
  );
  // required + not included → the older required_implies_included guard speaks
  // first. Either way there is no spelling of "required follow-up" that lands.
  await assert.rejects(
    insert(false, true),
    /check/i,
    'no spelling of a required follow-up may be written',
  );
});

test('an ordinary follow-up — not included, not required — is ACCEPTED', async () => {
  const parent = await addItem(packageId, 'Legal-followup parent');
  const option = await addOption(parent, 'Legal option');

  const r = await db.query<{ item_id: string }>(
    `INSERT INTO public.vendor_package_items
       (package_id, canonical_service, service_description,
        replacement_value_centavos, display_order, parent_option_id,
        is_default_included, is_required)
     VALUES ($1, 'catering', 'Which style?', 300000, 0, $2, FALSE, FALSE)
     RETURNING item_id`,
    [packageId, option],
  );
  assert.equal(r.rows.length, 1, 'the guard must not ban follow-ups outright');
});

test('REGRESSION: every non-follow-up shape that authors today still authors', async () => {
  // The rule is scoped to follow-ups. A top-level line keeps all three legal
  // combinations of included/required — this is the assertion that proves the
  // constraint did not quietly narrow ordinary authoring.
  const shapes: Array<[boolean, boolean, string]> = [
    [true, true, 'included + required — the mandatory core of a package'],
    [true, false, 'included + optional — the removable line'],
    [false, false, 'not included + optional — an ADD-ON'],
  ];
  for (const [included, required, why] of shapes) {
    const r = await db.query<{ item_id: string }>(
      `INSERT INTO public.vendor_package_items
         (package_id, canonical_service, service_description,
          replacement_value_centavos, display_order,
          is_default_included, is_required)
       VALUES ($1, 'catering', $2, 100000, 0, $3, $4)
       RETURNING item_id`,
      [packageId, `Regression ${why}`, included, required],
    );
    assert.equal(r.rows.length, 1, why);
  }

  // And the one top-level shape that was ALREADY refused stays refused.
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_package_items
         (package_id, canonical_service, service_description,
          replacement_value_centavos, display_order,
          is_default_included, is_required)
       VALUES ($1, 'catering', 'Regression ghost line', 100000, 0, FALSE, TRUE)`,
      [packageId],
    ),
    /vendor_package_items_required_implies_included/,
    'required-but-not-included was already a money bug and still is',
  );
});

/* ── the cycle + depth + same-package guard ─────────────────────────────────*/

test('a follow-up hanging off an option of ITSELF is refused', async () => {
  const itemId = await addItem(packageId, 'Main course');
  const optionId = await addOption(itemId, 'Beef caldereta');

  await assert.rejects(
    db.query(
      `UPDATE public.vendor_package_items SET parent_option_id = $2 WHERE item_id = $1`,
      [itemId, optionId],
    ),
    /package_followup_self_parent/,
    'a line revealed by its own answer can never be shown',
  );
});

test('a 2-cycle is refused', async () => {
  const a = await addItem(packageId, 'Cycle A');
  const optA = await addOption(a, 'A option');
  const b = await addItem(packageId, 'Cycle B', optA);
  const optB = await addOption(b, 'B option');

  await assert.rejects(
    db.query(
      `UPDATE public.vendor_package_items SET parent_option_id = $2 WHERE item_id = $1`,
      [a, optB],
    ),
    /package_followup_cycle/,
    'A revealed by B revealed by A is a renderer that never terminates',
  );
});

test('5 levels is allowed, 6 is refused — and the message states the number', async () => {
  // level 0 = the top-level line; each step adds one ancestor.
  let itemId = await addItem(packageId, 'Depth level 0');
  for (let level = 1; level <= 5; level += 1) {
    const optionId = await addOption(itemId, `Depth option ${level - 1}`);
    itemId = await addItem(packageId, `Depth level ${level}`, optionId);
  }

  const deepestOption = await addOption(itemId, 'Depth option 5');
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_package_items
         (package_id, canonical_service, service_description,
          replacement_value_centavos, display_order, parent_option_id)
       VALUES ($1, 'catering', 'Depth level 6', 0, 0, $2)`,
      [packageId, deepestOption],
    ),
    /package_followup_too_deep: a follow-up can be at most 5 levels from its line/,
    'six nested questions to configure one inclusion is a form, not a choice',
  );
});

test('a parent option in a DIFFERENT package is refused', async () => {
  const foreignItem = await addItem(otherPackageId, 'Someone else’s line');
  const foreignOption = await addOption(foreignItem, 'Someone else’s option');

  await assert.rejects(
    addItem(packageId, 'Cross-package follow-up', foreignOption),
    /package_followup_cross_package/,
    'parent_option_id is a bare FK across every vendor — the guard is the only tenancy check',
  );
});

/* ── CASCADE ────────────────────────────────────────────────────────────────*/

test('deleting the parent OPTION cascades the follow-up away', async () => {
  const parentItem = await addItem(packageId, 'Cascade parent');
  const optionId = await addOption(parentItem, 'Cascade option');
  const followUp = await addItem(packageId, 'Cascade follow-up', optionId);

  // A grandchild too — the cascade has to reach the whole subtree, or an
  // orphaned line survives pointing at an option that no longer exists.
  const grandOption = await addOption(followUp, 'Grandchild option');
  const grandChild = await addItem(packageId, 'Cascade grandchild', grandOption);

  await db.query(
    `DELETE FROM public.vendor_package_item_options WHERE option_id = $1`,
    [optionId],
  );

  const r = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.vendor_package_items WHERE item_id = ANY($1)`,
    [[followUp, grandChild]],
  );
  assert.equal(
    r.rows[0]!.n,
    '0',
    'SET NULL would PROMOTE the follow-up into a line every couple sees; CASCADE deletes it',
  );

  // The parent line itself is untouched — only the unreachable subtree goes.
  const p = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.vendor_package_items WHERE item_id = $1`,
    [parentItem],
  );
  assert.equal(p.rows[0]!.n, '1');
});

/* ── FINDING 1 — the cycle built entirely from the OPTIONS side ─────────────*/

/*
 * `parent_option_id` lives on vendor_package_items, so the obvious guard is a
 * trigger on that table. But the edge has THREE movable endpoints, and the
 * option is one of them: moving an option to another line re-points every
 * follow-up that hangs off it WITHOUT writing a single byte to
 * vendor_package_items. The items trigger never fires. RLS permits the UPDATE.
 *
 * NEUTRALISATION: drop trigger vendor_package_item_options_guard_move and every
 * test in this block goes green-to-red — the moves all succeed.
 */

test('FINDING 1: moving an option onto a line it reveals is refused (self-parent)', async () => {
  const a = await addItem(packageId, 'Opt-move A');
  const oa = await addOption(a, 'Opt-move A option');
  const b = await addItem(packageId, 'Opt-move B', oa);

  // B's parent option would now live on B itself — a cycle of length zero,
  // reached without touching vendor_package_items at all.
  await assert.rejects(
    db.query(
      `UPDATE public.vendor_package_item_options SET item_id = $2 WHERE option_id = $1`,
      [oa, b],
    ),
    /package_followup_self_parent/,
    'the items-side trigger cannot fire here — only the options-side guard can',
  );
});

test('FINDING 1: an option move that closes a 2-cycle is refused', async () => {
  const a = await addItem(packageId, 'Opt-cycle A');
  const oa = await addOption(a, 'Opt-cycle A option');
  const b = await addItem(packageId, 'Opt-cycle B', oa);
  const ob = await addOption(b, 'Opt-cycle B option');
  const c = await addItem(packageId, 'Opt-cycle C', ob);

  // Move `oa` (B's parent option) onto C. C hangs off B, so B would hang off C
  // and C off B: B → C → B.
  await assert.rejects(
    db.query(
      `UPDATE public.vendor_package_item_options SET item_id = $2 WHERE option_id = $1`,
      [oa, c],
    ),
    /package_followup_cycle/,
    'a cycle assembled by re-homing an option must be refused like any other',
  );
});

test('FINDING 1: an option move that crosses packages is refused', async () => {
  const a = await addItem(packageId, 'Opt-cross A');
  const oa = await addOption(a, 'Opt-cross A option');
  await addItem(packageId, 'Opt-cross follow-up', oa);
  const foreign = await addItem(otherPackageId, 'Opt-cross foreign line');

  await assert.rejects(
    db.query(
      `UPDATE public.vendor_package_item_options SET item_id = $2 WHERE option_id = $1`,
      [oa, foreign],
    ),
    /package_followup_cross_package/,
    'the follow-up would be revealed by an option in a different package',
  );
});

test('FINDING 1: an option move that pushes a subtree past 5 levels is refused', async () => {
  // A 5-level chain, plus a shallow parent+child pair. Re-homing the shallow
  // pair's option onto the deepest line pushes the CHILD to level 6 — which the
  // direct-child check alone would miss if it did not walk the subtree.
  let deep = await addItem(packageId, 'Opt-deep level 0');
  for (let level = 1; level <= 5; level += 1) {
    const o = await addOption(deep, `Opt-deep option ${level - 1}`);
    deep = await addItem(packageId, `Opt-deep level ${level}`, o);
  }

  const shallow = await addItem(packageId, 'Opt-deep shallow');
  const shallowOption = await addOption(shallow, 'Opt-deep shallow option');
  await addItem(packageId, 'Opt-deep shallow child', shallowOption);

  await assert.rejects(
    db.query(
      `UPDATE public.vendor_package_item_options SET item_id = $2 WHERE option_id = $1`,
      [shallowOption, deep],
    ),
    /package_followup_too_deep/,
    'the depth cap has to survive a subtree being re-homed, not just a fresh insert',
  );
});

test('FINDING 1: a LEGAL option move still succeeds — the guard is not a blanket ban', async () => {
  const a = await addItem(packageId, 'Opt-legal A');
  const oa = await addOption(a, 'Opt-legal A option');
  await addItem(packageId, 'Opt-legal follow-up', oa);
  const sibling = await addItem(packageId, 'Opt-legal sibling');

  // Same package, no cycle, still shallow: this is an ordinary re-organisation
  // and must go through, or the guard is just breaking the feature.
  await db.query(
    `UPDATE public.vendor_package_item_options SET item_id = $2 WHERE option_id = $1`,
    [oa, sibling],
  );
  const r = await db.query<{ item_id: string }>(
    `SELECT item_id FROM public.vendor_package_item_options WHERE option_id = $1`,
    [oa],
  );
  assert.equal(r.rows[0]!.item_id, sibling);
});

/* ── FINDING 2 — the cross-package guard bypassed from the PARENT side ──────*/

/*
 * The same-package rule compares the parent option's package to the CHILD row
 * being written. Moving the PARENT line's package_id never re-validates its
 * children, so the follow-up ends up pointing across packages by a route the
 * child-side check structurally cannot see.
 *
 * NEUTRALISATION: drop trigger vendor_package_items_guard_repackage and the
 * first test below goes red — the parent moves and the orphaned follow-up is
 * left pointing into another package.
 */

test('FINDING 2: moving a parent LINE to another package re-validates its follow-ups', async () => {
  const parent = await addItem(packageId, 'Repackage parent');
  const option = await addOption(parent, 'Repackage option');
  await addItem(packageId, 'Repackage follow-up', option);

  await assert.rejects(
    db.query(
      `UPDATE public.vendor_package_items SET package_id = $2 WHERE item_id = $1`,
      [parent, otherPackageId],
    ),
    /package_followup_cross_package/,
    'the child-side check cannot fire when the PARENT is the row that moves',
  );
});

test('FINDING 2: the re-validation reaches GRANDCHILDREN, not just direct children', async () => {
  const root = await antecedentChain();

  await assert.rejects(
    db.query(
      `UPDATE public.vendor_package_items SET package_id = $2 WHERE item_id = $1`,
      [root, otherPackageId],
    ),
    /package_followup_cross_package/,
    'a subtree walk is required — checking only direct children leaves the rest orphaned',
  );
});

/** root → child → grandchild, all in `packageId`. Returns the root. */
async function antecedentChain(): Promise<string> {
  const root = await addItem(packageId, 'Repackage deep root');
  const rootOption = await addOption(root, 'Repackage deep root option');
  const child = await addItem(packageId, 'Repackage deep child', rootOption);
  const childOption = await addOption(child, 'Repackage deep child option');
  await addItem(packageId, 'Repackage deep grandchild', childOption);
  return root;
}

test('FINDING 2: moving a line with NO follow-ups still works', async () => {
  // The guard must not turn "re-file this line under another package" into an
  // error for the 100% of lines that have no children.
  const lonely = await addItem(packageId, 'Repackage lonely line');
  await db.query(
    `UPDATE public.vendor_package_items SET package_id = $2 WHERE item_id = $1`,
    [lonely, otherPackageId],
  );
  const r = await db.query<{ package_id: string }>(
    `SELECT package_id FROM public.vendor_package_items WHERE item_id = $1`,
    [lonely],
  );
  assert.equal(r.rows[0]!.package_id, otherPackageId);
});

test('all three guard triggers are installed — one per movable endpoint', async () => {
  // Two of these were missing in the first draft and each omission was a live
  // cycle route. Asserted here as well as in the migration's own post-condition,
  // because a later migration can drop a trigger without touching this file.
  const r = await db.query<{ tgname: string }>(
    `SELECT tgname FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname IN ('vendor_package_items_guard_followup',
                       'vendor_package_items_guard_repackage',
                       'vendor_package_item_options_guard_move')
      ORDER BY tgname`,
  );
  assert.deepEqual(r.rows.map((t) => t.tgname), [
    'vendor_package_item_options_guard_move',
    'vendor_package_items_guard_followup',
    'vendor_package_items_guard_repackage',
  ]);
});

/* ── the guard function is not on the browser's surface ─────────────────────*/

test('no guard function is EXECUTE-able by anon or authenticated', async () => {
  // The two `assert_*` helpers matter most: they RETURN VOID rather than
  // trigger, so PostgREST would publish them at /rest/v1/rpc/ and they would
  // land on the exposure surface if this REVOKE were missing.
  const signatures = [
    'public.guard_package_item_followup()',
    'public.guard_package_item_repackage()',
    'public.guard_package_option_move()',
    'public.assert_package_followup_ok(uuid, uuid, uuid)',
    'public.assert_package_followup_subtree_ok(uuid)',
  ];
  const r = await db.query<{ role: string; sig: string; can: boolean }>(
    `SELECT r AS role, s AS sig, has_function_privilege(r, s, 'EXECUTE') AS can
       FROM unnest(ARRAY['anon','authenticated']) AS r
       CROSS JOIN unnest($1::text[]) AS s`,
    [signatures],
  );
  assert.equal(r.rows.length, signatures.length * 2, 'every signature must resolve');
  for (const row of r.rows) {
    assert.equal(
      row.can,
      false,
      `${row.role} still holds EXECUTE on ${row.sig} — Supabase's default privileges grant ` +
        'it at CREATE time and `REVOKE ... FROM PUBLIC` alone is a no-op against these roles',
    );
  }
});

test('the shared walk is defined ONCE — the two new guards do not re-implement it', async () => {
  // Three triggers enforcing one rule is only safe while there is one copy of
  // the rule. If a future edit inlines the walk into a trigger again, the
  // copies drift and the tests above stop describing production.
  const r = await db.query<{ proname: string; body: string }>(
    `SELECT p.proname, pg_get_functiondef(p.oid) AS body
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('guard_package_item_followup',
                          'guard_package_item_repackage',
                          'guard_package_option_move')`,
  );
  assert.equal(r.rows.length, 3);
  for (const fn of r.rows) {
    assert.match(
      fn.body,
      /assert_package_followup(_subtree)?_ok/,
      `${fn.proname} must delegate to the shared assertion`,
    );
    assert.ok(
      !/package_followup_cycle/.test(fn.body),
      `${fn.proname} has its own copy of the walk — there must be exactly one`,
    );
  }
});
