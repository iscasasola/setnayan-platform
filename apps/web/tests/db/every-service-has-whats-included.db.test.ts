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
 * The ONE exemption is derived, never hand-listed: is_setnayan = Setnayan's own products (Papic, Pakanta, Live
 * Studio, …). A supplier does not sell those, so they have no supplier card to fill.
 */
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
        WHERE merged_into IS NULL AND NOT is_setnayan ORDER BY canonical_service`,
    )
  ).rows;
  // Anti-vacuity: an empty or truncated taxonomy would pass the check below with nothing checked.
  assert.ok(live.length >= 300, `the live taxonomy replayed (got ${live.length} services)`);

  const missing = (
    await db.query<{ canonical_service: string }>(
      `SELECT t.canonical_service FROM public.canonical_service_taxonomy t
        WHERE t.merged_into IS NULL AND NOT t.is_setnayan
          AND NOT EXISTS (SELECT 1 FROM public.service_included_templates s
                           WHERE s.canonical_service = t.canonical_service AND NOT s.is_proposal)
        ORDER BY 1`,
    )
  ).rows.map((r) => r.canonical_service);
  assert.deepEqual(missing, [], `services with no approved starting What’s included: ${missing.join(', ')}`);
});

test('the only services without a template are Setnayan’s own products', async () => {
  const uncovered = (
    await db.query<{ canonical_service: string; is_setnayan: boolean }>(
      `SELECT t.canonical_service, t.is_setnayan FROM public.canonical_service_taxonomy t
        WHERE t.merged_into IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.service_included_templates s WHERE s.canonical_service = t.canonical_service)
        ORDER BY 1`,
    )
  ).rows;
  assert.ok(uncovered.length > 0, 'Setnayan’s own products exist and are exempt (else this check proves nothing)');
  for (const u of uncovered) assert.equal(u.is_setnayan, true, `${u.canonical_service} is a supplier service with no template`);
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
