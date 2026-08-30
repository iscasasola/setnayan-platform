/**
 * A DEFERRED MIGRATION MUST NOT BE ABLE TO OVERWRITE A LATER-NUMBERED ONE.
 *
 * 🚨 THE FAILURE THIS EXISTS TO STOP, MEASURED 2026-08-31. `createReplayedDb()`
 * applied migrations in filename order, caught every file that threw, and
 * retried the caught set to a fixpoint AFTER the whole corpus had run. Seven
 * files took that path on a normal run, and all seven cascaded from ONE:
 * `20260530010000` (index 116) needs `vendor_billing_catalog`, which
 * `20260631000000` (index 187) creates — so it was replayed after index 1269,
 * and it carries
 *
 *     UPDATE vendor_billing_catalog SET price_php = 2499  WHERE sku_code = 'pro_vendor_monthly';
 *     UPDATE vendor_billing_catalog SET price_php = 24999 WHERE sku_code = 'pro_vendor_annual';
 *
 * ...which overwrote the 2026-08-27 owner price sheet (`20271171000513`, index
 * 1212). THE OLDEST FILE WON. Every database built from `supabase/migrations/`
 * came up charging Pro ₱2,499 / ₱24,999 against a production that charges
 * ₱2,500 / ₱26,000 — and those exact two rows, and only those two, are the two
 * that `20260530010000` writes.
 *
 * 🔑 NOTHING IN `supabase/migrations/` WAS WRONG, AND THAT IS THE POINT.
 * Production applied each file ONCE, when it was authored, and never re-ran a
 * 2026-05-30 seed after a 2026-08-27 reprice. The defect was entirely in the
 * replay's ordering — which is why no test that READS a price could ever have
 * found it: every such test read the number the harness itself produced. The
 * divergence had already been written down, twice, as a fact about the corpus.
 *
 * ⛔ THE CHEAP VERSION OF THIS FILE WOULD ASSERT `pro_vendor_annual = 26000`.
 * That pins the symptom and would pass again the moment a different old file
 * clobbers a different new one. The assertions below are about the ORDERING.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  createReplayedDb,
  replayInFilenameOrder,
  MIGRATIONS_DIR,
  type ApplyPort,
  type ReplayResult,
} from './replay-migrations';

/* ========================================================================== *
 * 1 — THE MECHANISM, on a corpus small enough to be a controlled experiment.
 *
 * The real corpus takes ~8 s and cannot be made to say "an old file overwrote
 * a new one" on demand. Four fake files can. `002` is back-numbered: it writes
 * the price but needs a table `003` creates. `004` is the reprice. The only
 * honest final state is `004`'s number, because `004` is the last writer in
 * filename order — which is what production has.
 * ========================================================================== */

type World = { catalog: boolean; price: number | null };

function fakeCorpus(): { files: string[]; world: World; port: ApplyPort; order: string[] } {
  const world: World = { catalog: false, price: null };
  const order: string[] = [];
  const files = [
    '001_unrelated.sql',
    '002_old_seed_prices_the_catalog.sql',
    '003_create_catalog.sql',
    '004_the_owner_reprice.sql',
  ];
  const port: ApplyPort = {
    async apply(f: string) {
      switch (f) {
        case '001_unrelated.sql':
          break;
        case '002_old_seed_prices_the_catalog.sql':
          if (!world.catalog) throw new Error('relation "catalog" does not exist');
          world.price = 2499;
          break;
        case '003_create_catalog.sql':
          world.catalog = true;
          break;
        case '004_the_owner_reprice.sql':
          if (!world.catalog) throw new Error('relation "catalog" does not exist');
          world.price = 26000;
          break;
        default:
          throw new Error(`unknown file ${f}`);
      }
      order.push(f);
    },
    async rollback() {
      /* the model applies atomically; the real port rolls the transaction back */
    },
  };
  return { files, world, port, order };
}

test('a back-numbered file cannot outlive the reprice that follows it', async () => {
  const { files, world, port, order } = fakeCorpus();
  const res = await replayInFilenameOrder(files, port);

  assert.equal(res.deferred.size, 0, 'every file must end up applied');
  assert.equal(res.applied, 4);
  assert.equal(
    world.price,
    26000,
    'the LAST writer in filename order must win. 2499 here means the deferred file ' +
      'was replayed after the corpus — the exact defect measured on 2026-08-31',
  );
  assert.deepEqual(
    order,
    [
      '001_unrelated.sql',
      '003_create_catalog.sql',
      '002_old_seed_prices_the_catalog.sql',
      '004_the_owner_reprice.sql',
    ],
    'the deferred file must land at the EARLIEST index that works — right after the ' +
      'file that unblocks it, and BEFORE everything numbered above it',
  );
});

test('the out-of-order landing is reported, not absorbed', async () => {
  const { files, port } = fakeCorpus();
  const res = await replayInFilenameOrder(files, port);
  assert.deepEqual(
    res.outOfOrder.map((o) => `${o.file} -> after ${o.landedAfter}`),
    ['002_old_seed_prices_the_catalog.sql -> after 003_create_catalog.sql'],
    'a reordering nobody can see is a reordering nobody will fix',
  );
  assert.equal(res.outOfOrder[0]?.reason, 'relation "catalog" does not exist');
});

test('a file that can never apply is left deferred, not silently dropped', async () => {
  const order: string[] = [];
  const port: ApplyPort = {
    async apply(f: string) {
      if (f === '002_impossible.sql') throw new Error('check constraint is violated by some row');
      order.push(f);
    },
    async rollback() {},
  };
  const res = await replayInFilenameOrder(['001_a.sql', '002_impossible.sql', '003_b.sql'], port);
  assert.deepEqual([...res.deferred.keys()], ['002_impossible.sql']);
  assert.deepEqual(order, ['001_a.sql', '003_b.sql']);
  assert.equal(res.outOfOrder.length, 0, 'a file that never applied never landed anywhere');
});

/* ========================================================================== *
 * 2 — THE REAL CORPUS.
 * ========================================================================== */

let replay: ReplayResult;
let db: ReplayResult['db'];
let ordered: string[];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  ordered = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
});
after(async () => {
  await db?.close();
});

/**
 * ⚠ THE FILES THAT STILL CANNOT APPLY AT THEIR OWN POSITION — measured
 * 2026-08-31, down from seven. Both are the 2026-05-30 amendment pair, both
 * need `vendor_billing_catalog`, and both now land immediately after the file
 * that creates it instead of after the whole corpus.
 *
 * ⛔ DO NOT ADD A ROW HERE TO GO GREEN. A new entry means a new back-numbered
 * migration, and the question to answer is what it WRITES and what it jumped
 * over — not how to make this line pass.
 */
const EXPECTED_OUT_OF_ORDER: Record<string, string> = {
  '20260530010000_iteration_0006_v2_1_amendment_2.sql':
    '20260631000000_v2_pricing_table_alignment.sql',
  '20260530030000_iteration_0006_v2_1_amendment_2_titles.sql':
    '20260631000000_v2_pricing_table_alignment.sql',
};

test('every migration that lands out of order is one we have looked at', () => {
  const got: Record<string, string> = {};
  for (const o of replay.outOfOrder) got[o.file] = o.landedAfter;
  assert.deepEqual(
    got,
    EXPECTED_OUT_OF_ORDER,
    'the set of back-numbered migrations changed. That is a finding about the corpus, ' +
      'not paperwork: read where the new one lands and what it writes first.',
  );
});

/* -------------------------------------------------------------------------- *
 * THE ORDERING INVARIANT ITSELF.
 *
 * For a deferred file `d`, the danger is precise: if `d` is applied after the
 * LAST migration that writes a table `d` also writes, then `d` is the last
 * writer to that table and its (older) values win. So: find, for every table
 * `d` writes, the highest-numbered migration in the whole corpus that writes
 * it, and require `d` to have landed BEFORE that migration ran.
 *
 * 🔑 This is the general statement of the bug. Asserting `pro_vendor_annual =
 * 26000` would only pin the one row that happened to be caught.
 * -------------------------------------------------------------------------- */

/** SQL keywords a naive `UPDATE <word>` match would otherwise read as a table. */
const NOT_A_TABLE = new Set(['set', 'only', 'from', 'where', 'select', 'and', 'or']);

/**
 * The tables a migration WRITES.
 *
 * ⛔ NOT `lib/strip-comments.ts` — that is a JS/TS lexer, and these are `.sql`
 * files whose dominant comment form is `--`, which it does not strip at all.
 * ⛔ AND NOT A TWO-REPLACE REGEX, for exactly the reason
 * `scripts/lint-one-comment-stripper.mjs` gives: `/\/\*[\s\S]*?\*\//g` lets a
 * stray `/*` in prose open a comment that closes at the next real `*` + `/` and
 * blanks every line between. This reader would then see FEWER write targets,
 * and the invariant below would pass against a blank. (That is not
 * hypothetical here — it is what the first version of this file did, and the
 * guard caught it.)
 *
 * ✅ So: one pass, LINE BY LINE, truncating each line at its first `--`. A
 * per-line truncation cannot cross a line boundary, so the "one stray opener
 * eats the next 200 lines" failure is structurally impossible rather than
 * merely unlikely.
 *
 * 🔑 BLOCK COMMENTS ARE DELIBERATELY LEFT IN. Prose inside one that happens to
 * say `UPDATE public.x` adds a table this file does not really write. That
 * OVER-approximates the write set, which makes the invariant STRICTER: an
 * extra target can only add a comparison or raise a false alarm — both loud.
 * Missing a target is the silent direction, and it is the one that must not
 * happen.
 *
 * 📏 CROSS-CHECKED against the strictest possible reader — no comment handling
 * at all, which cannot miss anything by construction. Both read the same 3
 * (file · table) pairs with a later writer and both find 0 violations; the raw
 * reader differs only by two junk targets scraped out of prose (`needed`,
 * `title`) that no later migration writes. The `--` truncation is noise
 * reduction, not the thing the result rests on.
 */
function writeTargets(file: string): Set<string> {
  const out = new Set<string>();
  const lines = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8').split('\n');
  for (const line of lines) {
    const dashes = line.indexOf('--');
    const code = dashes === -1 ? line : line.slice(0, dashes);
    for (const m of code.matchAll(
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:ONLY\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi,
    )) {
      const t = m[1]!.toLowerCase();
      if (!NOT_A_TABLE.has(t)) out.add(t);
    }
  }
  return out;
}

test('the write-target reader is not returning nothing — this guard is not vacuous', () => {
  const t = writeTargets('20260530010000_iteration_0006_v2_1_amendment_2.sql');
  assert.ok(
    t.has('vendor_billing_catalog'),
    `the 2026-05-30 amendment writes vendor_billing_catalog; the reader saw ${JSON.stringify([...t])}. ` +
      'If this reader ever returns an empty set the invariant below passes for every file, testing nothing.',
  );
});

test('no deferred migration lands after the last migration that writes what it writes', () => {
  const problems: string[] = [];
  const checked: string[] = [];

  for (const o of replay.outOfOrder) {
    const mine = writeTargets(o.file);
    if (mine.size === 0) continue; // writes nothing — it cannot clobber anything

    for (const table of mine) {
      // The highest-numbered migration in the corpus that writes this table.
      let lastWriter = -1;
      for (let i = ordered.length - 1; i > o.index; i--) {
        if (writeTargets(ordered[i]!).has(table)) {
          lastWriter = i;
          break;
        }
      }
      if (lastWriter === -1) continue; // nothing later writes it — nothing to clobber
      checked.push(`${o.file} · ${table}`);
      if (o.landedAfterIndex >= lastWriter) {
        problems.push(
          `${o.file} landed after index ${o.landedAfterIndex}, but ${ordered[lastWriter]} ` +
            `(index ${lastWriter}) is the last migration to write ${table} — the OLD file ` +
            `is now the last writer and its values win`,
        );
      }
    }
  }

  assert.ok(
    checked.length > 0,
    'no out-of-order file was checked against any later writer — the invariant below is vacuous',
  );
  assert.deepEqual(
    problems,
    [],
    `a deferred migration can overwrite a later-numbered one:\n  ${problems.join('\n  ')}\n\n` +
      `This is the 2026-08-31 defect returning. Fix the ORDERING in replay-migrations.ts; ` +
      `do not add a migration to paper over the value.`,
  );
});

/* -------------------------------------------------------------------------- *
 * AND THE ROW THAT PAID FOR IT — checked against the price sheet's OWN
 * postcondition, not against a hand-typed second copy of the catalog.
 * -------------------------------------------------------------------------- */

/** The eight rungs `20271171000513_the_owner_price_sheet_2026_08_27.sql` asserts about itself. */
const OWNER_PRICE_SHEET_2026_08_27: Array<[string, number]> = [
  ['solo_vendor_monthly', 1000],
  ['pro_vendor_monthly', 2500],
  ['enterprise_vendor_monthly', 10000],
  ['solo_vendor_annual', 10400],
  ['pro_vendor_annual', 26000],
  ['enterprise_vendor_annual', 104000],
  ['vendor_additional_branch', 1000],
  ['vendor_3d_booth', 2500],
];

test('the replay ends on the owner price sheet, not on a 2026-05-30 seed', async () => {
  const r = await db.query<{ sku_code: string; php: string }>(
    `SELECT sku_code, price_php::text AS php FROM public.vendor_billing_catalog
      WHERE sku_code = ANY($1)`,
    [OWNER_PRICE_SHEET_2026_08_27.map(([c]) => c)],
  );
  const live = new Map(r.rows.map((x) => [x.sku_code, Number(x.php)]));
  const wrong: string[] = [];
  for (const [code, want] of OWNER_PRICE_SHEET_2026_08_27) {
    const got = live.get(code);
    if (got !== want) wrong.push(`${code}: replay ₱${got}, price sheet ₱${want}`);
  }
  assert.deepEqual(
    wrong,
    [],
    `the migrations no longer end where 20271171000513 says they do:\n  ${wrong.join('\n  ')}\n\n` +
      `Before 2026-08-31 this read pro_vendor_monthly ₱2,499 and pro_vendor_annual ₱24,999 ` +
      `because a deferred 2026-05-30 seed was replayed last.`,
  );
});
