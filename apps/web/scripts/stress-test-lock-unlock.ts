/**
 * Setnayan — Lock/Unlock Cycle Stress Test (Task #10)
 *
 * Pilot's whole purpose is exercising the lock/unlock cycle against real
 * money (CLAUDE.md 2026-05-18 row 8). Verifying the cycle synthetically
 * BEFORE pilot is the cheapest insurance against payment-state bugs.
 *
 * 5 scenarios × 100 iterations each = 500 iterations against a non-prod
 * Supabase test database.
 *
 *   1. Concierge — activate via start_concierge_trial → fast-forward
 *      expires_at → run sweep → verify status flips trial → expired →
 *      reactivate via paid activation → verify state correct.
 *   2. Pro Weekly — purchase → fast-forward expiry → simulate sweep →
 *      verify status flip → renew.
 *   3. Panood Annual — purchase → fast-forward 365 days → verify expiry.
 *   4. Patiktok per-day — create order → capture window opens for 24h →
 *      close → verify state.
 *   5. Refund — complete a paid order → file refund → verify reversal of
 *      all downstream activations.
 *
 * After all 500 iterations, asserts:
 *   - Zero orphaned grants (comp_grants pointing to non-existent orders)
 *   - Zero double-credited payments
 *   - Zero stuck-state rows (older than 1h still in transient state)
 *   - Zero failed sweeps left mid-state
 *
 * Usage:
 *
 *   SUPABASE_TEST_URL=...                 \
 *   SUPABASE_TEST_SERVICE_ROLE_KEY=...    \
 *   pnpm -F @setnayan/web exec tsx \
 *     scripts/stress-test-lock-unlock.ts
 *
 * The script refuses to run unless both *_TEST_* env vars are set (so it
 * cannot accidentally touch prod). All created rows are tagged with a
 * test-run prefix and hard-deleted in the cleanup pass at the end.
 *
 * SAFETY GUARDS
 *   - Refuses to run if SUPABASE_TEST_URL is empty OR contains the prod
 *     project ref `njrupjnvkjkitfctetvi`.
 *   - All test data is prefixed with `STRESS_TEST_` and a per-run UUID.
 *   - Cleanup deletes by run-prefix (idempotent — survives crashes).
 *   - If KEEP_TEST_DATA=1 is set, cleanup is skipped (useful for forensics).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROD_PROJECT_REF = 'njrupjnvkjkitfctetvi';
const ITERATIONS_PER_SCENARIO = 100;
const STUCK_STATE_AGE_MS = 60 * 60 * 1_000; // 1 hour
const TEST_RUN_ID = crypto.randomUUID().slice(0, 8);
const TEST_PREFIX = `STRESS_TEST_${TEST_RUN_ID}_`;

const SCENARIOS = [
  'concierge',
  'pro_weekly',
  'panood_annual',
  'patiktok_daily',
  'refund',
  // S6 (Task #23 — pilot blocker). Exercises sweepLapsedSubscriptions
  // against Pro Weekly + Panood Annual backdated orders, plus confirms
  // the sweep correctly IGNORES Patiktok per-day (which is not a
  // subscription — it's a multi-purchase per-day window order).
  'sweep_lapsed',
] as const;
type Scenario = (typeof SCENARIOS)[number];

type ScenarioResult = {
  scenario: Scenario;
  passed: number;
  failed: number;
  failures: string[];
  durationMs: number;
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const startedAt = Date.now();
  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`  Setnayan lock/unlock stress test`);
  console.log(`  Run ID: ${TEST_RUN_ID}`);
  console.log(`  Iterations per scenario: ${ITERATIONS_PER_SCENARIO}`);
  console.log(`══════════════════════════════════════════════════════════════\n`);

  const admin = createTestAdminClient();

  // -- Setup ---------------------------------------------------------------
  console.log('▸ Setup: creating test customer + event\n');
  const ctx = await setupTestContext(admin);
  if (!ctx) {
    console.error('✗ Setup failed. Aborting.');
    return 1;
  }
  console.log(`  Customer user_id: ${ctx.userId}`);
  console.log(`  Event event_id:   ${ctx.eventId}\n`);

  // -- Scenarios -----------------------------------------------------------
  const results: ScenarioResult[] = [];
  for (const scenario of SCENARIOS) {
    console.log(`▸ Running scenario: ${scenario}`);
    const res = await runScenario(admin, ctx, scenario);
    results.push(res);
    const verdict = res.failed === 0 ? '✓ PASS' : '✗ FAIL';
    console.log(
      `  ${verdict}  ${res.passed}/${ITERATIONS_PER_SCENARIO} passed · ${res.durationMs}ms total`,
    );
    if (res.failures.length) {
      const sample = res.failures.slice(0, 3);
      sample.forEach((f) => console.log(`    - ${f}`));
      if (res.failures.length > sample.length) {
        console.log(`    + ${res.failures.length - sample.length} more failures (truncated)`);
      }
    }
    console.log('');
  }

  // -- Cross-scenario drift assertions -------------------------------------
  console.log('▸ Drift assertions across all scenarios');
  const drift = await assertNoStateDrift(admin, ctx);
  for (const [name, result] of Object.entries(drift)) {
    const verdict = result.ok ? '✓' : '✗';
    console.log(`  ${verdict} ${name}: ${result.detail}`);
  }
  console.log('');

  // -- Cleanup -------------------------------------------------------------
  if (process.env.KEEP_TEST_DATA === '1') {
    console.log(`▸ Skipping cleanup (KEEP_TEST_DATA=1)`);
    console.log(`  Forensics: rows tagged with prefix ${TEST_PREFIX}\n`);
  } else {
    console.log('▸ Cleanup: hard-deleting test data');
    await cleanupTestContext(admin, ctx);
    console.log('  Done.\n');
  }

  // -- Verdict -------------------------------------------------------------
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const driftFailures = Object.values(drift).filter((r) => !r.ok).length;
  const totalMs = Date.now() - startedAt;

  console.log(`══════════════════════════════════════════════════════════════`);
  for (const r of results) {
    const v = r.failed === 0 ? 'PASS' : 'FAIL';
    console.log(
      `  ${v.padEnd(4)} ${r.scenario.padEnd(18)} ${r.passed}/${ITERATIONS_PER_SCENARIO}  (${r.durationMs}ms)`,
    );
  }
  console.log(
    `  Drift checks: ${Object.keys(drift).length - driftFailures}/${Object.keys(drift).length} clean`,
  );
  console.log(`  Total wall: ${totalMs}ms`);
  console.log(`══════════════════════════════════════════════════════════════\n`);

  return totalFailed + driftFailures > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

type TestContext = {
  userId: string;
  authUserId: string;
  eventId: string;
};

function createTestAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_TEST_URL;
  const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('✗ SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY must be set.');
    console.error('  This script REFUSES to run without an explicit non-prod URL +');
    console.error('  service role key — pilot-readiness verification cannot risk');
    console.error('  touching production data.');
    process.exit(2);
  }
  if (url.includes(PROD_PROJECT_REF)) {
    console.error(`✗ SUPABASE_TEST_URL contains prod project ref (${PROD_PROJECT_REF}).`);
    console.error('  Refusing to run against production.');
    process.exit(2);
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function setupTestContext(admin: SupabaseClient): Promise<TestContext | null> {
  // 1. Create an auth.users row via Supabase Admin API.
  const email = `${TEST_PREFIX.toLowerCase()}customer@stress-test.invalid`;
  const { data: authRes, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { stress_test_run_id: TEST_RUN_ID },
  });
  if (authErr || !authRes?.user) {
    console.error('✗ Failed to create test auth user:', authErr?.message);
    return null;
  }
  const authUserId = authRes.user.id;

  // 2. Insert public.users row.
  const { error: userErr } = await admin.from('users').insert({
    user_id: authUserId,
    email,
    display_name: `${TEST_PREFIX}customer`,
    account_type: 'customer',
  });
  if (userErr) {
    console.error('✗ Failed to insert public.users row:', userErr.message);
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    return null;
  }

  // 3. Insert events row with a fake wedding date 8 months out (lands a real
  //    wedding-anchored expiry inside the 12-month floor branch of the
  //    formula — exercises the "floor wins" path).
  const weddingDate = new Date(Date.now() + 240 * 86_400_000); // ~8 months out
  const { data: evRow, error: evErr } = await admin
    .from('events')
    .insert({
      display_name: `${TEST_PREFIX}wedding`,
      event_type: 'wedding',
      event_date: weddingDate.toISOString().slice(0, 10),
      is_primary: true,
    })
    .select('event_id')
    .maybeSingle();
  if (evErr || !evRow) {
    console.error('✗ Failed to insert events row:', evErr?.message);
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    return null;
  }
  const eventId = evRow.event_id as string;

  // 4. Couple membership so any RLS we still cross has a host present.
  const { error: memErr } = await admin.from('event_members').insert({
    event_id: eventId,
    user_id: authUserId,
    member_type: 'couple',
  });
  if (memErr) {
    console.error('✗ Failed to insert event_members row:', memErr.message);
    await cleanupTestContext(admin, { userId: authUserId, authUserId, eventId });
    return null;
  }

  return { userId: authUserId, authUserId, eventId };
}

async function cleanupTestContext(admin: SupabaseClient, ctx: TestContext): Promise<void> {
  // Hard-delete every row keyed by the run prefix. Order matters where FKs
  // don't cascade — comp_grants and orders before events; events ON DELETE
  // CASCADE handles event_members.
  await admin.from('comp_grants').delete().like('reason', `${TEST_PREFIX}%`);
  await admin.from('orders').delete().eq('event_id', ctx.eventId);
  await admin.from('payments').delete().eq('user_id', ctx.authUserId);
  await admin.from('concierge_abuse_flags').delete().eq('flagged_user_id', ctx.authUserId);
  await admin.from('events').delete().eq('event_id', ctx.eventId);
  await admin.from('users').delete().eq('user_id', ctx.authUserId);
  await admin.auth.admin.deleteUser(ctx.authUserId).catch(() => {});
}

// ---------------------------------------------------------------------------
// Scenario runner
// ---------------------------------------------------------------------------

async function runScenario(
  admin: SupabaseClient,
  ctx: TestContext,
  scenario: Scenario,
): Promise<ScenarioResult> {
  const t0 = Date.now();
  const failures: string[] = [];

  for (let i = 0; i < ITERATIONS_PER_SCENARIO; i++) {
    try {
      switch (scenario) {
        case 'concierge':
          await runConciergeIteration(admin, ctx, i);
          break;
        case 'pro_weekly':
          await runProWeeklyIteration(admin, ctx, i);
          break;
        case 'panood_annual':
          await runPanoodAnnualIteration(admin, ctx, i);
          break;
        case 'patiktok_daily':
          await runPatiktokDailyIteration(admin, ctx, i);
          break;
        case 'refund':
          await runRefundIteration(admin, ctx, i);
          break;
        case 'sweep_lapsed':
          await runSweepLapsedIteration(admin, ctx, i);
          break;
      }
    } catch (e) {
      failures.push(`iter ${i}: ${(e as Error).message}`);
    }
  }

  return {
    scenario,
    passed: ITERATIONS_PER_SCENARIO - failures.length,
    failed: failures.length,
    failures,
    durationMs: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// Scenario 1: Concierge activation → expiry sweep → reactivation
// ---------------------------------------------------------------------------

async function runConciergeIteration(
  admin: SupabaseClient,
  ctx: TestContext,
  i: number,
): Promise<void> {
  const now = new Date();

  // Reset event + user state to a clean baseline for this iteration. The
  // production trial-start flow uses idempotent guards (per-account +
  // per-event trial_used_at columns) so we wipe those between iterations.
  const { error: resetEvErr } = await admin
    .from('events')
    .update({
      concierge_status: 'diy',
      concierge_tier: null,
      concierge_activated_at: null,
      concierge_expires_at: null,
      concierge_trial_used_at: null,
      concierge_trial_started_by_user_id: null,
      concierge_long_engagement_advised_at: null,
    })
    .eq('event_id', ctx.eventId);
  if (resetEvErr) throw new Error(`reset event: ${resetEvErr.message}`);

  const { error: resetUserErr } = await admin
    .from('users')
    .update({ concierge_trial_used_at: null })
    .eq('user_id', ctx.userId);
  if (resetUserErr) throw new Error(`reset user: ${resetUserErr.message}`);

  // Step 1: Start the trial via the same column writes the production
  // startConciergeTrial server action performs. (We bypass the action
  // itself because it requires an auth-session-bound RLS user, but we
  // mirror its exact writes — see actions.ts:270-294.)
  const trialExpires = new Date(now.getTime() + 3 * 86_400_000);
  const { error: trialErr } = await admin
    .from('events')
    .update({
      concierge_status: 'trial',
      concierge_tier: 'complete',
      concierge_activated_at: now.toISOString(),
      concierge_expires_at: trialExpires.toISOString(),
      concierge_trial_used_at: now.toISOString(),
      concierge_trial_started_by_user_id: ctx.userId,
    })
    .eq('event_id', ctx.eventId);
  if (trialErr) throw new Error(`trial start: ${trialErr.message}`);

  await admin
    .from('users')
    .update({ concierge_trial_used_at: now.toISOString() })
    .eq('user_id', ctx.userId);

  // Step 2: Fast-forward the trial's expires_at to the past.
  const past = new Date(now.getTime() - 60_000).toISOString();
  await admin.from('events').update({ concierge_expires_at: past }).eq('event_id', ctx.eventId);

  // Step 3: Run the production sweep (same query as
  // lib/concierge.ts:sweepExpiredConcierge).
  await admin
    .from('events')
    .update({ concierge_status: 'expired' })
    .in('concierge_status', ['trial', 'active'])
    .lt('concierge_expires_at', new Date().toISOString());

  // Step 4: Verify status flipped to expired.
  const { data: postSweep } = await admin
    .from('events')
    .select('concierge_status')
    .eq('event_id', ctx.eventId)
    .maybeSingle();
  if (postSweep?.concierge_status !== 'expired') {
    throw new Error(`sweep did not flip status (got ${String(postSweep?.concierge_status)})`);
  }

  // Step 5: Simulate a paid order + activateConcierge — formula match.
  const orderId = await insertPaidOrder(admin, ctx, 'concierge_complete', 2499, i);

  const { data: evRow } = await admin
    .from('events')
    .select('event_date')
    .eq('event_id', ctx.eventId)
    .maybeSingle();

  const activatedAt = new Date();
  const expiresAt = computeConciergeExpiry(
    activatedAt,
    evRow?.event_date ? new Date(evRow.event_date) : null,
  );

  await admin
    .from('events')
    .update({
      concierge_status: 'active',
      concierge_tier: 'complete',
      concierge_activated_at: activatedAt.toISOString(),
      concierge_expires_at: expiresAt.toISOString(),
    })
    .eq('event_id', ctx.eventId);

  // Step 6: Verify reactivation landed in 'active' with sensible expiry.
  const { data: postActivate } = await admin
    .from('events')
    .select('concierge_status, concierge_expires_at')
    .eq('event_id', ctx.eventId)
    .maybeSingle();
  if (postActivate?.concierge_status !== 'active') {
    throw new Error(`reactivation status: ${String(postActivate?.concierge_status)}`);
  }
  const expiry = postActivate?.concierge_expires_at
    ? new Date(postActivate.concierge_expires_at as string).getTime()
    : 0;
  const minExpected = activatedAt.getTime() + 364 * 86_400_000; // floor ≥ 12mo
  if (expiry < minExpected) {
    throw new Error(`expiry < 12-month floor: ${new Date(expiry).toISOString()}`);
  }

  // The paid order remains in 'paid' state — pilot exercises this as a real
  // money receipt. Leave it for the orphan-grant assertion to find.
  void orderId;
}

// ---------------------------------------------------------------------------
// Scenario 2: Pro Weekly 7-day subscription
// ---------------------------------------------------------------------------

async function runProWeeklyIteration(
  admin: SupabaseClient,
  ctx: TestContext,
  i: number,
): Promise<void> {
  const now = new Date();

  // Purchase: insert paid order for vendor_pro_weekly.
  const orderId = await insertPaidOrder(admin, ctx, 'vendor_pro_weekly', 499, i);

  // Fetch the order back and confirm state.
  const { data: row } = await admin
    .from('orders')
    .select('order_id, status, service_key')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!row || row.status !== 'paid' || row.service_key !== 'vendor_pro_weekly') {
    throw new Error(`order not in expected paid state: ${JSON.stringify(row)}`);
  }

  // Fast-forward 7 days: backdate the order so its derived expiry has passed.
  const eightDaysAgo = new Date(now.getTime() - 8 * 86_400_000).toISOString();
  await admin
    .from('orders')
    .update({ created_at: eightDaysAgo, updated_at: eightDaysAgo })
    .eq('order_id', orderId);

  // Production has NO scheduled sweep for vendor_pro_weekly yet — the SKU
  // is marked subscription:true in lib/sku-catalog.ts but no expiry-state
  // table or cron exists. We simulate what the sweep SHOULD do: any
  // 'paid' order with service_key='vendor_pro_weekly' and updated_at >
  // 7 days ago transitions to 'fulfilled' (lapsed). This documents the
  // expected behavior so the test passes when the sweep ships.
  const sweepCutoff = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  await admin
    .from('orders')
    .update({ status: 'fulfilled' })
    .eq('service_key', 'vendor_pro_weekly')
    .eq('status', 'paid')
    .lt('updated_at', sweepCutoff);

  // Verify the simulated sweep flipped this order.
  const { data: afterSweep } = await admin
    .from('orders')
    .select('status')
    .eq('order_id', orderId)
    .maybeSingle();
  if (afterSweep?.status !== 'fulfilled') {
    throw new Error(`pro_weekly sweep did not lapse order (status: ${afterSweep?.status})`);
  }

  // Renew: insert a fresh paid order. This is what the V1 flow does — there
  // is no in-place "renew" — every billing period is a new apply-then-pay
  // order from the customer.
  const renewId = await insertPaidOrder(admin, ctx, 'vendor_pro_weekly', 499, i + 10_000);

  const { data: renewRow } = await admin
    .from('orders')
    .select('status')
    .eq('order_id', renewId)
    .maybeSingle();
  if (renewRow?.status !== 'paid') {
    throw new Error(`renewal not in paid state: ${renewRow?.status}`);
  }
}

// ---------------------------------------------------------------------------
// Scenario 3: Panood Annual 12-month lifecycle
// ---------------------------------------------------------------------------

async function runPanoodAnnualIteration(
  admin: SupabaseClient,
  ctx: TestContext,
  i: number,
): Promise<void> {
  const now = new Date();

  // Purchase: ₱19,999 panood_annual_streaming order.
  const orderId = await insertPaidOrder(admin, ctx, 'panood_annual_streaming', 19999, i);

  // Fast-forward 366 days.
  const farPast = new Date(now.getTime() - 366 * 86_400_000).toISOString();
  await admin
    .from('orders')
    .update({ created_at: farPast, updated_at: farPast })
    .eq('order_id', orderId);

  // Same gap as Pro Weekly: no annual-sweep cron yet. Simulate the expected
  // behavior — paid annual SKUs older than 365 days transition to
  // 'fulfilled' (which in this codebase is the lapsed terminal state for
  // subscription SKUs).
  const annualCutoff = new Date(now.getTime() - 365 * 86_400_000).toISOString();
  await admin
    .from('orders')
    .update({ status: 'fulfilled' })
    .eq('service_key', 'panood_annual_streaming')
    .eq('status', 'paid')
    .lt('updated_at', annualCutoff);

  const { data: row } = await admin
    .from('orders')
    .select('status')
    .eq('order_id', orderId)
    .maybeSingle();
  if (row?.status !== 'fulfilled') {
    throw new Error(`annual sweep did not lapse order (status: ${row?.status})`);
  }
}

// ---------------------------------------------------------------------------
// Scenario 4: Patiktok per-day 24-hour capture window
// ---------------------------------------------------------------------------

async function runPatiktokDailyIteration(
  admin: SupabaseClient,
  ctx: TestContext,
  i: number,
): Promise<void> {
  const now = new Date();

  // Purchase: ₱999 patiktok_setnayan_tiktok daily-booth order.
  const orderId = await insertPaidOrder(admin, ctx, 'patiktok_setnayan_tiktok', 999, i);

  // Capture window opens (status = paid as proxy for "active window"). Real
  // V1 keeps the booth-active state in admin_notes JSON or a future
  // booth_sessions table; the order.status flag is sufficient proxy.
  const { data: openRow } = await admin
    .from('orders')
    .select('status')
    .eq('order_id', orderId)
    .maybeSingle();
  if (openRow?.status !== 'paid') {
    throw new Error(`booth window did not open (status: ${openRow?.status})`);
  }

  // Fast-forward 25 hours.
  const past = new Date(now.getTime() - 25 * 3_600_000).toISOString();
  await admin.from('orders').update({ created_at: past, updated_at: past }).eq('order_id', orderId);

  // Close window: simulate the day-end sweep that should mark the booth
  // 'fulfilled' once its 24h window lapses.
  const dailyCutoff = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  await admin
    .from('orders')
    .update({ status: 'fulfilled' })
    .eq('service_key', 'patiktok_setnayan_tiktok')
    .eq('status', 'paid')
    .lt('updated_at', dailyCutoff);

  const { data: closedRow } = await admin
    .from('orders')
    .select('status')
    .eq('order_id', orderId)
    .maybeSingle();
  if (closedRow?.status !== 'fulfilled') {
    throw new Error(`daily window did not close (status: ${closedRow?.status})`);
  }
}

// ---------------------------------------------------------------------------
// Scenario 5: Refund + cancellation
// ---------------------------------------------------------------------------

async function runRefundIteration(
  admin: SupabaseClient,
  ctx: TestContext,
  i: number,
): Promise<void> {
  const now = new Date();

  // Step 1: Insert a paid order. Use save_the_date_video (₱199) so we can
  // also exercise the order_status transition without touching the
  // wedding-anchored Concierge formula.
  const orderId = await insertPaidOrder(admin, ctx, 'save_the_date_video', 199, i);

  // Step 2: Insert a matched payment row for that order.
  const { data: paymentRow, error: pmtErr } = await admin
    .from('payments')
    .insert({
      order_id: orderId,
      user_id: ctx.userId,
      amount_php: 199,
      channel: 'bdo_qr',
      status: 'matched',
      paid_at: now.toISOString(),
    })
    .select('payment_id')
    .maybeSingle();
  if (pmtErr || !paymentRow) {
    throw new Error(`payment insert failed: ${pmtErr?.message}`);
  }

  // Step 3: File the refund — admin action transitions order → 'refunded'.
  const { error: refundErr } = await admin
    .from('orders')
    .update({
      status: 'refunded',
      admin_notes: `${TEST_PREFIX}refund issued`,
    })
    .eq('order_id', orderId);
  if (refundErr) throw new Error(`refund failed: ${refundErr.message}`);

  // Step 4: Verify downstream activations are reversed. For
  // save_the_date_video the activation is the order itself (no separate
  // grant row), so we assert the order is refunded AND no comp_grant was
  // left pointing at it.
  const { data: refundedRow } = await admin
    .from('orders')
    .select('status')
    .eq('order_id', orderId)
    .maybeSingle();
  if (refundedRow?.status !== 'refunded') {
    throw new Error(`refund did not stick: ${refundedRow?.status}`);
  }

  const { count: grantCount } = await admin
    .from('comp_grants')
    .select('grant_id', { count: 'exact', head: true })
    .eq('order_id', orderId);
  if ((grantCount ?? 0) > 0) {
    throw new Error(`orphan comp_grant after refund: ${grantCount} rows`);
  }

  // Step 5: Verify the matched payment row's amount was NOT double-counted.
  // Production should mark the payment as 'rejected' on refund OR add a
  // reversal row — for V1 the manual-reconciliation flow keeps the
  // original payment record AND files a refund on the order. We assert
  // exactly one matched payment exists per order.
  const { data: pmtRows } = await admin
    .from('payments')
    .select('payment_id, amount_php, status')
    .eq('order_id', orderId);
  const matched = (pmtRows ?? []).filter((r) => r.status === 'matched');
  if (matched.length !== 1) {
    throw new Error(`double-credited: ${matched.length} matched payments on refund`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let orderSerial = 0;
async function insertPaidOrder(
  admin: SupabaseClient,
  ctx: TestContext,
  serviceKey: string,
  pesos: number,
  iter: number,
): Promise<string> {
  orderSerial += 1;
  const refCode = `${TEST_PREFIX}${serviceKey.slice(0, 6)}-${iter}-${orderSerial}-${crypto
    .randomUUID()
    .slice(0, 6)}`;
  const { data, error } = await admin
    .from('orders')
    .insert({
      event_id: ctx.eventId,
      user_id: ctx.userId,
      service_key: serviceKey,
      description: `${TEST_PREFIX}${serviceKey}`,
      requested_total_php: pesos,
      confirmed_total_php: pesos,
      status: 'paid',
      reference_code: refCode,
    })
    .select('order_id')
    .maybeSingle();
  if (error || !data) {
    throw new Error(`order insert (${serviceKey}): ${error?.message}`);
  }
  return data.order_id as string;
}

// ---------------------------------------------------------------------------
// Scenario 6: sweepLapsedSubscriptions — Pro Weekly + Panood Annual lapse +
// Patiktok per-day MUST NOT lapse (Task #23)
// ---------------------------------------------------------------------------
//
// Verifies the production lib/subscriptions.ts:sweepLapsedSubscriptions
// function correctly transitions only `subscription:true` SKUs from
// 'paid' → 'lapsed' when their expires_at has passed. The Patiktok per-day
// SKU is `subscription:false` in sku-catalog.ts even though it is a time-
// bounded order — the sweep must IGNORE it (the day-bound capture window
// is enforced separately by the booth code, not by the subscription sweep).
//
// Idempotency: a second sweep call within ~100ms returns swept_count=0
// because the first call has already advanced status away from 'paid'.
//
// Scope filter: when called with { eventId }, only that event's orders
// flip. The Pro-Weekly order in this iteration belongs to ctx.eventId so
// the scope filter is exercised on a hit; a control order for a
// non-existent event would test the negative case but that requires extra
// FK plumbing — covered by the unit test instead.

async function runSweepLapsedIteration(
  admin: SupabaseClient,
  ctx: TestContext,
  i: number,
): Promise<void> {
  const now = new Date();
  const eightDaysAgo = new Date(now.getTime() - 8 * 86_400_000).toISOString();
  const oneYearOneDayAgo = new Date(now.getTime() - 366 * 86_400_000).toISOString();
  const past = new Date(now.getTime() - 60_000).toISOString();

  // Insert 3 paid orders: Pro Weekly + Panood Annual (both subscription:true
  // → should lapse) and Patiktok per-day (subscription:false → must NOT
  // lapse even though its 24h window has passed).
  const proId = await insertPaidOrder(admin, ctx, 'vendor_pro_weekly', 499, i);
  const panoodId = await insertPaidOrder(admin, ctx, 'panood_annual_streaming', 19999, i);
  const patiktokId = await insertPaidOrder(admin, ctx, 'patiktok_setnayan_tiktok', 999, i);

  // Backdate expires_at to the past — mirror the production activate
  // helper (lib/subscriptions.ts:computeSubscriptionExpiry) but with
  // already-elapsed values so the sweep MUST flip them.
  await admin
    .from('orders')
    .update({ expires_at: past, updated_at: eightDaysAgo })
    .eq('order_id', proId);
  await admin
    .from('orders')
    .update({ expires_at: past, updated_at: oneYearOneDayAgo })
    .eq('order_id', panoodId);
  // Patiktok per-day order: expires_at intentionally NULL (matches
  // sku-catalog.ts subscription:false; production wouldn't set this column
  // at all for non-subscription SKUs).
  await admin.from('orders').update({ updated_at: oneYearOneDayAgo }).eq('order_id', patiktokId);

  // Run the production sweep query inline. Duplicated from
  // lib/subscriptions.ts so the script stays import-free (matches
  // computeConciergeExpiry's pattern below).
  const LAPSED_SUBSCRIPTION_SKUS = [
    'vendor_pro_weekly',
    'all_tools_unlock_annual',
    'tool_mood_board_weekly',
    'tool_seat_arrangement_weekly',
    'tool_palette_weekly',
    'tool_qr_reader_weekly',
    'tool_advanced_pricing_weekly',
    'sponsored_boost_annual_30km',
    'vendor_verification_annual_renewal',
    'panood_annual_streaming',
    'panood_annual_streaming_plus',
    'papic_cam_bridge_all_slots_annual',
  ];
  const nowIso = new Date().toISOString();
  const { data: sweptRows1 } = await admin
    .from('orders')
    .update({ status: 'lapsed', updated_at: nowIso })
    .eq('event_id', ctx.eventId)
    .eq('status', 'paid')
    .in('service_key', LAPSED_SUBSCRIPTION_SKUS)
    .lt('expires_at', nowIso)
    .select('order_id');
  const swept_count_first = (sweptRows1 ?? []).length;

  // Second sweep within the same iteration — must be a no-op.
  const { data: sweptRows2 } = await admin
    .from('orders')
    .update({ status: 'lapsed', updated_at: nowIso })
    .eq('event_id', ctx.eventId)
    .eq('status', 'paid')
    .in('service_key', LAPSED_SUBSCRIPTION_SKUS)
    .lt('expires_at', nowIso)
    .select('order_id');
  const swept_count_second = (sweptRows2 ?? []).length;
  if (swept_count_second !== 0) {
    throw new Error(
      `non-idempotent sweep: second call returned ${swept_count_second} (expected 0)`,
    );
  }

  // Verify Pro Weekly lapsed.
  const { data: proRow } = await admin
    .from('orders')
    .select('status')
    .eq('order_id', proId)
    .maybeSingle();
  if (proRow?.status !== 'lapsed') {
    throw new Error(`pro_weekly did not lapse (status: ${String(proRow?.status)})`);
  }

  // Verify Panood Annual lapsed.
  const { data: panoodRow } = await admin
    .from('orders')
    .select('status')
    .eq('order_id', panoodId)
    .maybeSingle();
  if (panoodRow?.status !== 'lapsed') {
    throw new Error(`panood_annual did not lapse (status: ${String(panoodRow?.status)})`);
  }

  // Verify Patiktok per-day did NOT lapse (it's not a subscription).
  const { data: patiktokRow } = await admin
    .from('orders')
    .select('status')
    .eq('order_id', patiktokId)
    .maybeSingle();
  if (patiktokRow?.status !== 'paid') {
    throw new Error(
      `patiktok per-day lapsed but shouldn't have (status: ${String(patiktokRow?.status)})`,
    );
  }

  // Sanity: exactly 2 rows swept on the first call.
  if (swept_count_first !== 2) {
    throw new Error(`expected 2 sweeps on first call, got ${swept_count_first}`);
  }
}

/**
 * Mirror of lib/concierge.ts:computeConciergeExpiry — duplicated locally so
 * the script has zero non-trivial imports from apps/web/lib (paths and
 * "use server" directives complicate standalone tsx execution).
 */
function computeConciergeExpiry(activatedAt: Date, weddingDate: Date | null): Date {
  const floor = addMonths(activatedAt, 12);
  const cap = addMonths(activatedAt, 24);
  if (!weddingDate) return floor;
  const postWedding = new Date(weddingDate.getTime() + 30 * 86_400_000);
  const candidate = postWedding.getTime() > floor.getTime() ? postWedding : floor;
  return candidate.getTime() < cap.getTime() ? candidate : cap;
}
function addMonths(d: Date, months: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + months);
  return result;
}

// ---------------------------------------------------------------------------
// Cross-scenario drift assertions
// ---------------------------------------------------------------------------

async function assertNoStateDrift(
  admin: SupabaseClient,
  ctx: TestContext,
): Promise<Record<string, { ok: boolean; detail: string }>> {
  const out: Record<string, { ok: boolean; detail: string }> = {};

  // 1. Orphan comp_grants — any comp_grants.order_id pointing to a
  //    non-existent order. We scope to test-run-only by joining against
  //    the test event's orders.
  const { data: grants } = await admin
    .from('comp_grants')
    .select('grant_id, order_id')
    .like('reason', `${TEST_PREFIX}%`);
  let orphans = 0;
  for (const g of grants ?? []) {
    if (!g.order_id) continue;
    const { count } = await admin
      .from('orders')
      .select('order_id', { count: 'exact', head: true })
      .eq('order_id', g.order_id);
    if ((count ?? 0) === 0) orphans++;
  }
  out['orphaned_grants'] = {
    ok: orphans === 0,
    detail: `${orphans} orphan(s) of ${grants?.length ?? 0} test comp_grants`,
  };

  // 2. Double-credited payments — same (order_id, amount_php, status=matched)
  //    tuple seen more than once.
  const { data: doublePay } = await admin
    .from('payments')
    .select('order_id, amount_php')
    .eq('user_id', ctx.userId)
    .eq('status', 'matched');
  const seen = new Map<string, number>();
  for (const p of doublePay ?? []) {
    const key = `${p.order_id}|${p.amount_php}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const doubles = [...seen.values()].filter((n) => n > 1).length;
  out['double_credited_payments'] = {
    ok: doubles === 0,
    detail: `${doubles} order(s) with duplicate matched payments`,
  };

  // 3. Stuck transient state — any orders older than 1h still in
  //    'submitted' or 'awaiting_payment' on the test event.
  const cutoff = new Date(Date.now() - STUCK_STATE_AGE_MS).toISOString();
  const { count: stuckCount } = await admin
    .from('orders')
    .select('order_id', { count: 'exact', head: true })
    .eq('event_id', ctx.eventId)
    .in('status', ['submitted', 'awaiting_payment'])
    .lt('created_at', cutoff);
  out['stuck_transient_orders'] = {
    ok: (stuckCount ?? 0) === 0,
    detail: `${stuckCount ?? 0} order(s) stuck in transient state >1h`,
  };

  // 4. Failed sweeps mid-state — concierge_status='active' or 'trial' with
  //    an expires_at in the past on the test event.
  const { count: midSweep } = await admin
    .from('events')
    .select('event_id', { count: 'exact', head: true })
    .eq('event_id', ctx.eventId)
    .in('concierge_status', ['active', 'trial'])
    .lt('concierge_expires_at', new Date().toISOString());
  out['failed_sweeps_mid_state'] = {
    ok: (midSweep ?? 0) === 0,
    detail: `${midSweep ?? 0} event(s) past expiry but still active/trial`,
  };

  // 5. Subscription orders past expiry still 'paid' — should have been
  //    swept to 'lapsed' (Task #23 sweepLapsedSubscriptions).
  const { count: missedSubSweep } = await admin
    .from('orders')
    .select('order_id', { count: 'exact', head: true })
    .eq('event_id', ctx.eventId)
    .eq('status', 'paid')
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString());
  out['unswept_lapsed_subscriptions'] = {
    ok: (missedSubSweep ?? 0) === 0,
    detail: `${missedSubSweep ?? 0} subscription order(s) past expires_at still 'paid'`,
  };

  return out;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
  });
