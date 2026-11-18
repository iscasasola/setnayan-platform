/**
 * EVERY LIVE SERVICE HAS A STARTING "WHAT'S INCLUDED" LIST — owner, 18 Nov, verbatim:
 *   "i looked at some and they all seem correct. make sure all services has basic inclusions. and they are auto
 *    uploaded at the beginning".
 *
 * So a supplier who starts a card for ANY live service opens it with that service's basics already in What's
 * included (the pre-fill lives in the card maker; this file holds the data it needs). A service added to the
 * taxonomy later without a template fails here, by name, until Admin › Categories › Quick Forms gives it one or a
 * migration seeds one.
 *
 * "Live" = not merged into another service (merged_into IS NULL). marketplace_hidden services are INCLUDED: Admin
 * can unhide one with a single switch, and it must not then open empty.
 * The ONE exemption is the explicit list below (owner, 18 Nov, "all recommended"), each also checked to be
 * is_setnayan so a supplier service can never be parked in it.
 */

/**
 * Setnayan's own products get NO starting What's included (owner, 18 Nov: "all recommended").
 * Reason: a supplier does not sell these — they are Setnayan's first-party products (is_setnayan) with their own
 * fixed contents and prices, so there is no supplier card for a list to fill. A new entry needs the same reason.
 */
const SETNAYAN_OWN_NO_LIST: readonly string[] = [
  'pabati', // retired 2026-08-23; the taxonomy leaf is kept (reserved word)
  'setnayan_ai_edited_highlight',
  'setnayan_concierge',
  'setnayan_custom_monogram',
  'setnayan_pailaw',
  'setnayan_pakanta',
  'setnayan_panood',
  'setnayan_papic',
  'setnayan_patiktok',
  'setnayan_save_the_date_mp4',
];
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('every live supplier service has an approved starting What’s included template', async () => {
  const live = (
    await db.query<{ canonical_service: string }>(
      `SELECT canonical_service FROM public.canonical_service_taxonomy
        WHERE merged_into IS NULL AND NOT (canonical_service = ANY($1::text[])) ORDER BY canonical_service`,
      [SETNAYAN_OWN_NO_LIST],
    )
  ).rows;
  // Anti-vacuity: an empty or truncated taxonomy would pass the check below with nothing checked.
  assert.ok(live.length >= 300, `the live taxonomy replayed (got ${live.length} services)`);

  const missing = (
    await db.query<{ canonical_service: string }>(
      `SELECT t.canonical_service FROM public.canonical_service_taxonomy t
        WHERE t.merged_into IS NULL AND NOT (t.canonical_service = ANY($1::text[]))
          AND NOT EXISTS (SELECT 1 FROM public.service_included_templates s
                           WHERE s.canonical_service = t.canonical_service AND NOT s.is_proposal)
        ORDER BY 1`,
      [SETNAYAN_OWN_NO_LIST],
    )
  ).rows.map((r) => r.canonical_service);
  assert.deepEqual(missing, [], `services with no approved starting What’s included: ${missing.join(', ')}`);
});

test('the skip list is exactly Setnayan’s own products, each live, each is_setnayan, and none has a list', async () => {
  const rows = (
    await db.query<{ canonical_service: string; is_setnayan: boolean; live: boolean; n: number }>(
      `SELECT t.canonical_service, t.is_setnayan, t.merged_into IS NULL AS live,
              (SELECT count(*) FROM public.service_included_templates s WHERE s.canonical_service = t.canonical_service)::int AS n
         FROM public.canonical_service_taxonomy t WHERE t.canonical_service = ANY($1::text[]) ORDER BY 1`,
      [SETNAYAN_OWN_NO_LIST],
    )
  ).rows;
  assert.deepEqual(rows.map((r) => r.canonical_service), [...SETNAYAN_OWN_NO_LIST].sort(), 'every skipped key exists');
  for (const r of rows) {
    assert.equal(r.is_setnayan, true, `${r.canonical_service} is a supplier service — it may not be skipped`);
    assert.equal(r.n, 0, `${r.canonical_service} is Setnayan’s own — it gets no list (owner, 18 Nov)`);
  }
  // A NEW Setnayan product must be added to the list on purpose, with its reason — never skipped silently.
  const unlisted = (
    await db.query<{ canonical_service: string }>(
      `SELECT canonical_service FROM public.canonical_service_taxonomy
        WHERE merged_into IS NULL AND is_setnayan AND NOT (canonical_service = ANY($1::text[])) ORDER BY 1`,
      [SETNAYAN_OWN_NO_LIST],
    )
  ).rows.map((r) => r.canonical_service);
  assert.deepEqual(unlisted, [], `Setnayan products not in the skip list: ${unlisted.join(', ')}`);
});

test('no seeded template is still marked a proposal, and none carries a price', async () => {
  const r = (
    await db.query<{ proposal: number; total: number }>(
      `SELECT count(*) FILTER (WHERE is_proposal)::int AS proposal, count(*)::int AS total FROM public.service_included_templates`,
    )
  ).rows[0]!;
  assert.ok(r.total >= 300, `the seed is there (got ${r.total})`);
  assert.equal(r.proposal, 0, 'the owner approved the seed on 18 Nov');
  const priced = (
    await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.service_included_templates
        WHERE jsonb_path_exists(rows, 'strict $[*] ? (exists(@.price) || exists(@.amount) || exists(@.price_php) || exists(@.amount_php))')`,
    )
  ).rows[0]!.n;
  assert.equal(priced, 0);
});
