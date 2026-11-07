#!/usr/bin/env node
/**
 * check-no-demo-cross-booking.mjs — READ-ONLY production audit: is any real event paired with a demo shop, or any
 * demo event with a real shop?
 *
 * ── WHAT IT REPLACES ─────────────────────────────────────────────────────────────────────────────────────────────
 * `check-no-demo-in-prod.mjs` (retired 2026-11-06) hard-failed on ANY `vendor_profiles.is_demo` row from 2026-12-01.
 * The owner's ruling that day (DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS") made demo shops PERMANENT and
 * PUBLIC, marked "(DEMO ONLY)" — so that script would have failed the day after launch for doing exactly what the owner
 * asked. What the ruling forbids is different: *"a couple can never book or pay a demo shop"*, and *"the demo events can
 * only see demo suppliers"*. That pairing is what this audits.
 *
 * ── HOW IT IS HELD ───────────────────────────────────────────────────────────────────────────────────────────────
 *   app     lib/demo-scope.ts — every write path asks it (lib/a-real-event-never-books-a-demo-shop.test.ts)
 *   db      public.refuse_demo_cross_booking() — trigger on the seven tables below
 *           (tests/db/a-real-event-never-books-a-demo-shop.db.test.ts)
 *   prod    this script — proves nothing slipped past both
 *
 * ── LEGACY ROWS ──────────────────────────────────────────────────────────────────────────────────────────────────
 * Rows created BEFORE the rule (e.g. the owner's old test bookings of Saysay on a real event, made while Saysay was a
 * trial shop) are listed as a WARNING, never a failure: nothing deletes them, and the trigger lets their lifecycle
 * continue. A cross row created AFTER `RULE_SINCE` is a FAILURE — it means both halves missed it.
 *
 * Usage (from apps/web):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/check-no-demo-cross-booking.mjs
 *   RULE_SINCE=2026-11-07T00:00:00+08:00 …   (override the cut-off)
 *
 * Exit codes: 0 OK / skipped (no env) · 1 a NEW cross row exists · 3 a read failed.
 * Read-only: PostgREST GETs only. Nothing is written.
 */

const RULE_SINCE_DEFAULT = '2026-11-07T00:00:00+08:00';

/** [table, event column, shop columns] — the same list the migration puts the trigger on. */
const TABLES = [
  ['event_vendors', 'event_id', ['marketplace_vendor_id', 'linked_vendor_profile_id']],
  ['chat_threads', 'event_id', ['vendor_profile_id']],
  ['vendor_proposals', 'event_id', ['vendor_profile_id']],
  ['orders', 'event_id', ['vendor_profile_id']],
  ['booking_fee_charges', 'event_id', ['vendor_profile_id']],
  ['vendor_contracts', 'event_id', ['vendor_profile_id']],
  ['vendor_payment_asks', 'event_id', ['vendor_profile_id']],
];

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    console.log('check-no-demo-cross-booking: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping.');
    process.exit(0);
  }
  const since = new Date(process.env.RULE_SINCE ?? RULE_SINCE_DEFAULT);
  if (Number.isNaN(since.getTime())) {
    console.error(`check-no-demo-cross-booking: RULE_SINCE is not a date: ${process.env.RULE_SINCE}`);
    process.exit(3);
  }

  async function get(table, params) {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) {
      console.error(`check-no-demo-cross-booking: ${table} read failed HTTP ${res.status} ${await res.text()}`);
      process.exit(3);
    }
    return res.json();
  }
  const inList = (ids) => `in.(${ids.join(',')})`;

  const demoShops = new Set(
    (await get('vendor_profiles', { select: 'vendor_profile_id', is_demo: 'eq.true' })).map((r) => r.vendor_profile_id),
  );
  const demoEvents = new Set((await get('events', { select: 'event_id', is_sample: 'eq.true' })).map((r) => r.event_id));
  console.log(`\n=== check-no-demo-cross-booking ===`);
  console.log(`Target        : ${supabaseUrl}`);
  console.log(`Demo shops    : ${demoShops.size}`);
  console.log(`Demo events   : ${demoEvents.size}`);
  console.log(`Rule since    : ${since.toISOString()}`);

  const fresh = [];
  const legacy = [];
  for (const [table, eventCol, shopCols] of TABLES) {
    for (const shopCol of shopCols) {
      const select = `${eventCol},${shopCol},created_at`;
      const rows = [];
      // A demo shop on any event that is not a demo event…
      if (demoShops.size > 0) rows.push(...(await get(table, { select, [shopCol]: inList([...demoShops]) })));
      // …and any shop that is not a demo shop on a demo event.
      if (demoEvents.size > 0) rows.push(...(await get(table, { select, [eventCol]: inList([...demoEvents]), [shopCol]: 'not.is.null' })));
      for (const r of rows) {
        const ev = r[eventCol];
        const shop = r[shopCol];
        if (!ev || !shop) continue;
        if (demoEvents.has(ev) === demoShops.has(shop)) continue; // a matching pair
        const line = `${table}.${shopCol}: event ${ev} (${demoEvents.has(ev) ? 'demo' : 'real'}) · shop ${shop} (${demoShops.has(shop) ? 'demo' : 'real'}) · created ${r.created_at}`;
        (r.created_at && new Date(r.created_at) >= since ? fresh : legacy).push(line);
      }
    }
  }

  if (legacy.length > 0) {
    console.warn(`\nWARN — ${legacy.length} cross pairing(s) created before the rule (kept; no new writes accepted on them):`);
    for (const l of legacy) console.warn(`  · ${l}`);
  }
  if (fresh.length > 0) {
    console.error(`\nFAIL — ${fresh.length} cross pairing(s) created AFTER the rule — both lib/demo-scope.ts and the trigger missed:`);
    for (const l of fresh) console.error(`  · ${l}`);
    process.exit(1);
  }
  console.log(`\nOK — no real event is paired with a demo shop, and no demo event with a real shop, since the rule.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`check-no-demo-cross-booking: fatal: ${err?.message ?? err}`);
  process.exit(3);
});
