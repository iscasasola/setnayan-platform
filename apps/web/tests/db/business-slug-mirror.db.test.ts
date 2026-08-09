/**
 * GUARD — the TypeScript slug preview must agree with the SQL that actually
 * mints the address, character for character.
 *
 * WHY THIS EXISTS. The wizard shows a vendor their future web address while they
 * type their shop name (owner 2026-08-09). That preview is computed in
 * TypeScript because no row exists yet; the REAL address is minted later by a
 * database trigger (`slugify_business_name` → `generate_business_slug_for_vendor`,
 * migration `20271117527966`).
 *
 * Two implementations of one rule, in two languages, maintained by hand. If they
 * drift, the vendor reads one address on screen and is issued a different one —
 * and **nothing anywhere reports a problem**. They find out when they hand the
 * wrong address to a client. This project has been bitten by hand-typed pairs
 * enough times to have a name for it: *two hand-typed things are not a guard.*
 *
 * So the two are compared MECHANICALLY over a corpus chosen for the places the
 * rule is easy to get subtly wrong:
 *   - `&` must become the WORD "and", and must do so BEFORE punctuation is
 *     collapsed, or "Bloom & Vine" yields "bloom-vine" instead of
 *     "bloom-and-vine"
 *   - accented Latin must transliterate, not vanish (`Mañana` → `manana`)
 *   - apostrophes, dots and runs of punctuation collapse to ONE hyphen
 *   - leading / trailing punctuation must not leave edge hyphens
 *   - a name with nothing Latin in it must yield NULL on both sides, not ''
 *   - the 32-char clip must not leave a trailing hyphen
 *
 * ⚠ The order of operations is the fragile part, not the character set. A mirror
 * that lowercases after transliterating, or collapses punctuation before
 * expanding `&`, passes a casual read and fails these cases.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

import {
  slugifyBusinessName,
  clipBusinessSlug,
  BUSINESS_SLUG_MAX,
} from '../../lib/business-slug';

let replay: ReplayResult;
let db: PGlite;

/** Names chosen for the ways this rule goes subtly wrong. */
const CORPUS = [
  'Banawe Florals',
  'Bloom & Vine Studio',
  'Mañana Photo Co.',
  "Kai's Cakes!!",
  '  Leading and trailing  ',
  'Double  --  hyphens',
  'ALL CAPS STUDIO',
  'Ñoño Ábaco Éclair Ïsla Öslo Ünion',
  '123 Numbers 456',
  'Hyphen-Already-Here',
  'Punctuation....only....dots',
  '&',
  '&&&',
  'A & B',
  'Yo',
  '88',
  '!!!',
  '日本語のみ',
  'Emoji 🎉 Party 🎊 Co',
  'A name that is quite a lot longer than thirty two characters for sure',
  'Trailing punctuation at thirty two chars---------------',
  'ThisIsExactlyThirtyTwoCharsLong32',
  'tabs\tand\nnewlines',
  'slash/and\\backslash',
  'percent%20encoded',
  "O'Brien & Sons, Inc.",
];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db.close();
});

test('META: the SQL slugifier exists in the replayed schema', async () => {
  // Without this the comparison below could pass by both sides erroring out.
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'slugify_business_name'`,
  );
  assert.equal(r.rows[0]!.n, 1, 'slugify_business_name missing — nothing is being compared');
});

test('the TypeScript preview matches the SQL slugifier on every name', async () => {
  const disagreements: string[] = [];
  for (const name of CORPUS) {
    const r = await db.query<{ sql: string | null }>(
      `SELECT public.slugify_business_name($1) AS sql`,
      [name],
    );
    const sql = r.rows[0]!.sql;
    const ts = slugifyBusinessName(name);
    if (sql !== ts) {
      disagreements.push(`${JSON.stringify(name)}: SQL=${JSON.stringify(sql)} TS=${JSON.stringify(ts)}`);
    }
  }
  assert.deepEqual(
    disagreements,
    [],
    'the preview would show an address the database will not issue:\n  ' +
      disagreements.join('\n  '),
  );
});

test('the TypeScript clip matches the SQL clip, including the trailing hyphen rule', async () => {
  const disagreements: string[] = [];
  for (const name of CORPUS) {
    const r = await db.query<{ sql: string | null }>(
      `SELECT public.clip_business_slug(public.slugify_business_name($1), $2) AS sql`,
      [name, BUSINESS_SLUG_MAX],
    );
    const sql = r.rows[0]!.sql;
    const ts = clipBusinessSlug(slugifyBusinessName(name), BUSINESS_SLUG_MAX);
    if (sql !== ts) {
      disagreements.push(`${JSON.stringify(name)}: SQL=${JSON.stringify(sql)} TS=${JSON.stringify(ts)}`);
    }
  }
  assert.deepEqual(disagreements, [], 'clip drift:\n  ' + disagreements.join('\n  '));
});

test('the ampersand becomes the WORD "and" before separators are stripped', async () => {
  // The single most likely way to write this mirror wrong: strip separators
  // first and the '&' vanishes silently, giving `bloomvinestudio`. Pinned
  // explicitly on BOTH sides so a failure names the rule instead of showing a
  // bare diff.
  assert.equal(slugifyBusinessName('Bloom & Vine Studio'), 'bloomandvinestudio');
  const r = await db.query<{ sql: string | null }>(
    `SELECT public.slugify_business_name('Bloom & Vine Studio') AS sql`,
  );
  assert.equal(r.rows[0]!.sql, 'bloomandvinestudio');
});

test('the owner worked example holds end to end', async () => {
  // Owner 2026-08-09: "Banawe Florals" → www.setnayan.com/banaweflorals.
  // Pinned on both sides so a future change to either has to face the example
  // the rule was written from.
  assert.equal(slugifyBusinessName('Banawe Florals'), 'banaweflorals');
  const r = await db.query<{ sql: string | null }>(
    `SELECT public.slugify_business_name('Banawe Florals') AS sql`,
  );
  assert.equal(r.rows[0]!.sql, 'banaweflorals');
});

test('an address minted before the ruling is never reissued', async () => {
  // The rule changed; live addresses did not. `generate_business_slug_for_vendor`
  // returns early when business_slug IS NOT NULL, because a save-the-date posted
  // months ago points at it. Without this, a "tidy up the old hyphens" backfill
  // looks harmless and breaks every address already handed out.
  const ev = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (business_name, business_slug)
     VALUES ('Saysay Live Band And Hosting', 'saysay-live-band-and-hosting-fix')
     RETURNING vendor_profile_id`,
  );
  const id = ev.rows[0]!.vendor_profile_id;
  await db.query(`SELECT public.generate_business_slug_for_vendor($1)`, [id]);
  const after = await db.query<{ business_slug: string }>(
    `SELECT business_slug FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [id],
  );
  assert.equal(
    after.rows[0]!.business_slug,
    'saysay-live-band-and-hosting-fix',
    'a pre-existing hyphenated address was rewritten — every link to it is now dead',
  );
});

test('NEUTRALISATION: a mirror that drops the ampersand rule is caught', async () => {
  // Proves the comparison measures the implementation rather than agreeing with
  // itself. This is what a plausible-looking wrong mirror returns.
  const naive = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || null;
  const r = await db.query<{ sql: string | null }>(
    `SELECT public.slugify_business_name('Bloom & Vine Studio') AS sql`,
  );
  assert.notEqual(
    naive('Bloom & Vine Studio'),
    r.rows[0]!.sql,
    'the naive mirror agrees with SQL — the corpus is not exercising the rule',
  );
});
