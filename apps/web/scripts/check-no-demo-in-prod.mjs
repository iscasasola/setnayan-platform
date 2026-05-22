#!/usr/bin/env node
/**
 * check-no-demo-in-prod.mjs
 *
 * CI guard — fails any merge to main that ships with too many demo vendors
 * in the target database. Companion to the seed script at
 * scripts/seed-demo-vendors.ts.
 *
 * WHY
 * ---
 * Demo vendors exist for marketplace simulation while real vendor curation
 * ramps post-pilot (CLAUDE.md 2026-05-18 pilot strategy + 2026-05-22 owner-
 * approved marketplace simulation workstream). They MUST be cleaned up
 * before the public launch on 2026-12-01 so couples never see synthetic
 * vendors in the real marketplace.
 *
 * HARD CLEANUP DEADLINE: 2026-12-01.
 *
 * BEHAVIOR
 * --------
 * • Connects to the database via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * • Counts vendor_profiles rows WHERE is_demo=TRUE.
 * • If the date >= 2026-12-01 AND count > 0: HARD FAIL.
 * • Otherwise, if count > DEMO_VENDORS_MAX (default 2000): WARN, exit 1.
 * • If ALLOW_DEMO_VENDORS=1, the guard exits 0 regardless (escape hatch
 *   for stage/preview environments that legitimately seed demo data).
 * • If SUPABASE_URL is missing, the guard skips and exits 0 (CI builds
 *   without DB credentials should not block on this check).
 *
 * USAGE
 * -----
 *   # Default (against prod DB):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node apps/web/scripts/check-no-demo-in-prod.mjs
 *
 *   # Custom threshold:
 *   DEMO_VENDORS_MAX=500 SUPABASE_URL=... node apps/web/scripts/check-no-demo-in-prod.mjs
 *
 *   # Allow demo vendors (stage / preview):
 *   ALLOW_DEMO_VENDORS=1 node apps/web/scripts/check-no-demo-in-prod.mjs
 *
 * EXIT CODES
 * ----------
 *   0 — OK (or skipped because env not set or escape hatch active)
 *   1 — count exceeded threshold (soft warn — exit non-zero to fail CI)
 *   2 — POST-DEADLINE and demo vendors present (hard fail)
 *   3 — DB connection / query error
 */

const HARD_CLEANUP_DEADLINE_ISO = '2026-12-01T00:00:00+08:00';
const DEFAULT_MAX_DEMO_VENDORS = 2000;

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.log(
      'check-no-demo-in-prod: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping.',
    );
    process.exit(0);
  }

  if (process.env.ALLOW_DEMO_VENDORS === '1') {
    console.log(
      'check-no-demo-in-prod: ALLOW_DEMO_VENDORS=1 — guard disabled for this environment.',
    );
    process.exit(0);
  }

  const max = Number(process.env.DEMO_VENDORS_MAX ?? DEFAULT_MAX_DEMO_VENDORS);
  const now = new Date();
  const deadline = new Date(HARD_CLEANUP_DEADLINE_ISO);
  const pastDeadline = now >= deadline;

  // Use the Supabase REST API directly so we don't need to install
  // @supabase/supabase-js in CI minimal images. PostgREST count-only
  // request: HEAD with Prefer: count=exact.
  let count = 0;
  try {
    const url = new URL(`${supabaseUrl}/rest/v1/vendor_profiles`);
    url.searchParams.set('is_demo', 'eq.true');
    url.searchParams.set('select', 'vendor_profile_id');
    const res = await fetch(url.toString(), {
      method: 'HEAD',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    });
    if (!res.ok && res.status !== 206) {
      console.error(
        `check-no-demo-in-prod: query failed HTTP ${res.status} ${res.statusText}`,
      );
      const text = await res.text();
      if (text) console.error(text);
      process.exit(3);
    }
    const range = res.headers.get('content-range');
    // Format: "0-0/N" or "*/N"
    const match = range?.match(/\/(\d+)$/);
    if (match) count = Number(match[1]);
  } catch (err) {
    console.error(`check-no-demo-in-prod: query error: ${err.message ?? err}`);
    process.exit(3);
  }

  logSection('check-no-demo-in-prod');
  console.log(`Target            : ${supabaseUrl}`);
  console.log(`Demo vendors      : ${count.toLocaleString()}`);
  console.log(`Max allowed       : ${max.toLocaleString()}`);
  console.log(`Cleanup deadline  : ${HARD_CLEANUP_DEADLINE_ISO}`);
  console.log(`Past deadline?    : ${pastDeadline ? 'YES' : 'no'}`);

  if (pastDeadline && count > 0) {
    console.error(
      `\nFAIL — past 2026-12-01 cleanup deadline AND ${count} demo vendors present.\n` +
        `Run cleanup via /admin/demo-vendors → "Cleanup ALL Demo Vendors" OR the\n` +
        `POST /api/admin/demo/cleanup endpoint, then re-run this guard.\n` +
        `\nIf this environment legitimately needs demo vendors (staging / preview),\n` +
        `set ALLOW_DEMO_VENDORS=1 to disable the guard.\n`,
    );
    process.exit(2);
  }

  if (count > max) {
    console.error(
      `\nWARN — ${count} demo vendors exceeds threshold ${max}.\n` +
        `Either:\n` +
        `  • Raise DEMO_VENDORS_MAX (if intentional),\n` +
        `  • Trim a batch via the admin UI, OR\n` +
        `  • Set ALLOW_DEMO_VENDORS=1 to disable.\n`,
    );
    process.exit(1);
  }

  console.log(`\nOK — demo vendor count within threshold.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`check-no-demo-in-prod: fatal: ${err.message ?? err}`);
  process.exit(3);
});
