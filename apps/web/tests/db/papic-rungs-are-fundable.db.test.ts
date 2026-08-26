/**
 * EVERY SELLABLE PAPIC RUNG MUST HAVE SOMEWHERE FOR ITS SHOTS TO COME FROM.
 *
 * 🚨 THE FAILURE THIS EXISTS TO STOP. `activateOrderSku` dispatches on an EXACT
 * `service_key` map and ends:
 *
 *     const hook = exact ?? PREFIX_HOOKS.find(...)?.run;
 *     if (!hook) return; // default no-op
 *
 * So a rung that is live in `papic_pass_tiers` + `platform_retail_catalog_v2`
 * but absent from `EXACT_HOOKS` is fully purchasable and grants NOTHING. The
 * couple pays ₱9,000, an admin approves the transfer, the order goes `paid` —
 * and the pool stays empty. Nothing throws, nothing logs, no alert fires,
 * because a no-op is the designed behaviour for a service_key that owns no
 * capability. It is the same shape as every other silent decline on this
 * codebase's board: the dispatcher DECLINES and the only symptom is an absence.
 *
 * It came within one commit of shipping when the Pool ladder was extended from
 * three rungs to nine (owner 2026-08-11) — the migration alone would have put
 * six unfunded rungs on sale.
 *
 * ── WHY IT READS THE DATABASE *AND* THE SOURCE ─────────────────────────────
 * Neither half can see this alone. A unit test over `EXACT_HOOKS` cannot know
 * which rungs are on sale; a db test over the tier tables cannot know which
 * keys have hooks. The bug lives precisely in the gap, so the assertion has to
 * span it: replayed migrations for what is SELLABLE, the module source for what
 * is FUNDED.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIVATION_SRC = readFileSync(join(HERE, '../../lib/sku-activation.ts'), 'utf8');

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

/**
 * Is this service_code wired to an activation hook?
 *
 * Deliberately a SOURCE scan and not an import: `sku-activation.ts` pulls the
 * admin Supabase client and half the billing chain through its import graph,
 * which a db test has no business booting. The map is a frozen object literal
 * of `KEY: hook` / `[CONST]: hook` lines, so matching the key is exact enough —
 * and a rung that is only mentioned in a COMMENT must not count, which is why
 * this requires the colon.
 */
function isWired(serviceCode: string): boolean {
  // `PAPIC_GUEST_13K: grantPapicPassPoints,` — a bare key.
  if (new RegExp(`^\\s*${serviceCode}\\s*:`, 'm').test(ACTIVATION_SRC)) return true;
  // `[PAPIC_ONE_SKU]: grantPapicCameraPoints,` — a computed key. Resolve the
  // constant's VALUE from papic-one.ts rather than trusting the name.
  const one = readFileSync(join(HERE, '../../lib/papic-one.ts'), 'utf8');
  for (const m of one.matchAll(/export const (\w+) = '([^']+)'/g)) {
    if (m[2] === serviceCode && new RegExp(`\\[\\s*${m[1]}\\s*\\]\\s*:`).test(ACTIVATION_SRC)) {
      return true;
    }
  }
  return false;
}

/** Every rung a couple can actually put money on: live tier AND live price. */
async function sellableRungs(table: 'papic_pass_tiers' | 'papic_one_tiers') {
  const r = await db.query<{ service_code: string; points: number; php: string }>(
    `SELECT t.service_code, t.points, c.retail_price_php AS php
       FROM public.${table} t
       JOIN public.platform_retail_catalog_v2 c ON c.service_code = t.service_code
      WHERE t.is_active AND c.is_active AND c.retail_price_php > 0
      ORDER BY c.retail_price_php`,
  );
  return r.rows;
}

test('every sellable Papic POOL rung has an activation hook', async () => {
  const rungs = await sellableRungs('papic_pass_tiers');
  assert.ok(rungs.length > 0, 'no sellable Pool rung at all — the ladder is dead');
  const unfunded = rungs.filter((r) => !isWired(r.service_code));
  assert.deepEqual(
    unfunded.map((r) => r.service_code),
    [],
    `these Pool rungs are ON SALE and grant NOTHING on approval — add them to ` +
      `EXACT_HOOKS in lib/sku-activation.ts. A couple would pay and get an empty pool, ` +
      `with no error anywhere.`,
  );
});

test('Papic One is not sellable at all — there is one product now', async () => {
  // ⚠ THIS ASSERTION IS INVERTED FROM WHAT IT USED TO BE, deliberately. It read
  // "every sellable Papic One rung has an activation hook" and opened with
  // `assert.ok(rungs.length > 0)`. The owner collapsed Papic to one product on
  // 2026-08-11, so a sellable One rung is now the REGRESSION rather than the
  // precondition: it would put a retired product back on sale beside the live
  // ladder, at a price nobody decided.
  const rungs = await sellableRungs('papic_one_tiers');
  assert.deepEqual(
    rungs.map((r) => r.service_code),
    [],
    'a Papic One rung is on sale again — a dedicated camera is MADE by handing shots to a QR, not bought',
  );
});

test('the ladder the owner set is exactly what is on sale', async () => {
  // Owner 2026-08-26, given as a table and then as the rule behind it: a
  // SCROLLABLE list of sixteen rungs, priced against ₱1 = 1 credit with a
  // bundle discount that deepens as the number grows. Pinned as a SET, not as
  // prose in a doc — the corpus has been wrong about a live price before, and a
  // number in a sentence cannot fail.
  //
  // ⚠ SUPERSEDES the four-rung ladder of 2026-08-11, which itself superseded a
  // nine-rung one that never reached production.
  //
  // ⚖ 40,000 IS DELIBERATELY ABSENT. His first table had it at ₱10,000 — the
  // same price as 50,000 — so it was a row nobody could rationally choose. That
  // was surfaced rather than quietly corrected, and he removed it. Do not
  // re-add it without a price of its own.
  const rungs = await sellableRungs('papic_pass_tiers');
  assert.deepEqual(
    rungs.map((r) => [Number(r.points), Number(r.php)]),
    [
      [100, 50],
      [200, 100],
      [300, 150],
      [400, 200],
      [500, 250],
      [1_000, 500],
      [2_000, 1_000],
      [3_000, 1_200],
      [4_000, 1_600],
      [5_000, 2_000],
      [6_000, 2_400],
      [7_000, 2_800],
      [10_000, 3_200],
      [20_000, 5_000],
      [30_000, 7_500],
      [50_000, 10_000],
    ],
    'the ladder drifted from the owner-set one',
  );
});

test('the bundle price is always below ₱1 a credit, and never rises per credit', async () => {
  /*
    The whole ladder is defined AGAINST ₱1 = 1 credit: the regular price is the
    credit count itself and the bundle price is a discount off it. Two things
    follow, and neither is stored anywhere — which is the point, because a
    stored second copy of a rule is how prices drift.

      1. no rung may cost MORE than ₱1 a credit, or the "discount" is a markup;
      2. buying more must never cost more PER CREDIT than buying less, or the
         scroll rewards you for choosing the smaller number.

    ⚠ Rule 2 is `<=`, not `<`, and the reason CHANGED when 40,000 was removed —
    it is worth stating correctly rather than leaving a stale justification in
    place. It is not about that rung. The ladder holds a FLAT rate across whole
    bands by design: ₱0.50 a credit from 100 through 2,000, ₱0.40 from 3,000
    through 7,000, ₱0.25 across 20,000 and 30,000. A strict `<` would fail on
    eleven of the sixteen rungs.
  */
  const rungs = await sellableRungs('papic_pass_tiers');
  assert.ok(rungs.length >= 10, `only ${rungs.length} rungs read back — the rules below are vacuous`);

  const bad: string[] = [];
  let prevRate = Number.POSITIVE_INFINITY;
  for (const r of rungs) {
    const credits = Number(r.points);
    const php = Number(r.php);
    const rate = php / credits;
    if (php > credits) bad.push(`${credits} costs ₱${php} — above ₱1 a credit`);
    if (rate > prevRate) bad.push(`${credits} costs ₱${rate.toFixed(4)} a credit, worse than the rung below it`);
    prevRate = rate;
  }
  assert.deepEqual(bad, [], bad.join('; '));
});


test('every rung is repeatable, which is what makes four of them enough', async () => {
  // A couple wanting 6,000 buys the ₱1,000 rung twice for the same ₱2,000 the
  // retired 6K rung charged. If a rung ever stopped being repeatable, the gaps
  // in a four-rung ladder would become real holes rather than two taps.
  const r = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.papic_pass_tiers
      WHERE is_active AND is_topup`,
  );
  assert.equal(
    Number(r.rows[0]!.n),
    0,
    'a rung marked is_topup gates itself behind a balance — every rung on this ladder is a plain repeatable buy',
  );
});

test('the retired rungs keep their hooks — old orders must still convert', async () => {
  // Deactivating a rung stops NEW sales. It must not strand an order minted
  // before the change: the hook has to stay wired, and the deactivated tier row
  // is what makes the conversion resolve to what it was sold at.
  for (const retired of ['PAPIC_GUEST_TOPUP', 'PAPIC_CAMERA_MINI_DAY', 'PAPIC_ONE_100']) {
    assert.equal(
      isWired(retired),
      true,
      `${retired} lost its activation hook — an order minted before it was retired ` +
        `would now be approved and grant nothing`,
    );
  }
});

test('the legacy multi-camera grant still funds its seats after the MINI rung retired', async () => {
  // papic_grant_camera_points branch (B) reads PAPIC_CAMERA_MINI_DAY's points
  // `AND is_active`, then COALESCEs to 50. Deactivating the row makes that
  // lookup miss — so this pins that the fallback carries it, rather than
  // assuming it. Checked, not asserted in prose.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Legacy grant check', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  const order = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, NULL, 'PAPIC_CAMERAS', 'legacy', 60, 'submitted', 'LEGACYFUND01')
     RETURNING order_id`,
    [eventId],
  );
  const orderId = order.rows[0]!.order_id;
  // ⚠ THE CLAIM TOKEN IS A BOUND PARAMETER, NOT A LITERAL, and that is
  // deliberate rather than stylistic. gitleaks' generic-api-key rule fires on
  // the shape `..._token = '<value>'` in the SQL text — it cannot tell a
  // throwaway fixture in an in-memory database from a real credential, and it
  // flagged this exact line once already. An allowlist entry would have fixed it
  // only until the next edit moved the line: the fingerprint pins commit AND line
  // number, so every future change to this file would re-break the secret scan.
  // Passing the value as $3 removes the trigger instead of muting it.
  await db.query(
    `INSERT INTO public.paparazzi_seats
       (event_id, seat_index, sku_code, claim_qr_token, tier, paid_order_id)
     VALUES ($1, 611, 'PAPIC_CAMERA_MINI_DAY', $3, 'mini', $2)`,
    [eventId, orderId, 'legacy-fund-1'],
  );

  const granted = await db.query<{ papic_grant_camera_points: number }>(
    `SELECT public.papic_grant_camera_points($1, $2)`,
    [eventId, orderId],
  );
  assert.ok(
    Number(granted.rows[0]!.papic_grant_camera_points) > 0,
    'a legacy multi-camera order granted NOTHING after the MINI rung was deactivated',
  );
});
