/**
 * POST /api/admin/demo/seed
 *
 * One-click demo-vendor creation, CHUNKED. A full seed (thousands of inserts)
 * exceeds a single serverless invocation's envelope, so the browser clicks
 * once then drives this endpoint category-by-category:
 *
 *   • { phase: 'start' }                       → cleanup + return the chunk list
 *   • { phase: 'chunk', batchId, offset, ... } → seed services[offset..+limit)
 *
 * Reuses the CLI seed core (`seedCategory` + helpers from
 * scripts/seed-demo-vendors.ts) so chunked output matches the CLI exactly
 * (per-category RNG keyed on (batchId, service)).
 *
 * Admin-only. Non-prod by default; on PRODUCTION it runs only while admin
 * demo mode is on (the same banner switch) — demo vendors are hidden from
 * real users unless demo mode is enabled, so this can't leak. With demo mode
 * off, prod stays hard-blocked. Scoped relaxation of the staging-only lock,
 * owner-approved 2026-06-03. Audit-logged.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isNonProdUrl,
  fetchCanonicalServices,
  fetchResolvedSchemas,
  fetchReviewEventPool,
  seedCategory,
} from '@/scripts/seed-demo-vendors';
import { isDemoMode } from '@/lib/demo-mode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_CHUNK = 2; // categories per request — timeout-safe at 20-50 vendors each

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: 'Not signed in.' };
  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member, email')
    .eq('user_id', user.id)
    .maybeSingle();
  const isAdmin =
    profile?.is_internal || profile?.is_team_member || profile?.account_type === 'admin';
  if (!isAdmin) return { ok: false as const, status: 403, error: 'Admin only.' };
  return { ok: true as const, userId: user.id, email: profile?.email ?? user.email, profile };
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';

// Non-prod is always allowed. On production we allow seeding ONLY while admin
// demo mode is on for THIS request — the same switch that surfaces `is_demo`
// vendors in the marketplace + shows the banner. Demo vendors stay hidden from
// real users when demo mode is off, so this can't leak. Without demo mode,
// prod stays hard-blocked (the accident guard). Owner-approved 2026-06-03 —
// scoped relaxation of the "demo vendors are staging-only" lock.
function prodGuard(demoOn: boolean): NextResponse | null {
  if (isNonProdUrl(SUPABASE_URL)) return null;
  if (demoOn) return null;
  return NextResponse.json(
    {
      error:
        'Disabled on production unless demo mode is on. Turn on demo mode (the banner toggle) first, then run Create again — or run this on a non-prod Supabase deployment.',
    },
    { status: 403 },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Demo mode is admin-only by construction; `auth` already proved admin, so
  // this just reads the per-request flag (cookie `setnayan_demo_mode=1`, sent
  // automatically with this same-origin POST, or `?demo=1`).
  const demoOn = isDemoMode(req, auth.profile);
  const blocked = prodGuard(demoOn);
  if (blocked) return blocked;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const phase = String(body.phase ?? '');

  // ── start: clean the slate, return the category list to chunk through ──
  if (phase === 'start') {
    const { count, error } = await admin
      .from('vendor_profiles')
      .delete({ count: 'exact' })
      .eq('is_demo', true);
    if (error) {
      return NextResponse.json({ error: `Cleanup failed: ${error.message}` }, { status: 500 });
    }
    const services = await fetchCanonicalServices(admin, null);
    const batchId = randomUUID();
    await admin.from('admin_audit_log').insert({
      action: 'demo_vendors_create_start',
      target_table: 'vendor_profiles',
      target_id: null,
      after_json: {
        deleted_count: count ?? 0,
        batch_id: batchId,
        total_categories: services.length,
        on_production: !isNonProdUrl(SUPABASE_URL),
        demo_mode: demoOn,
      },
      actor_user_id: auth.userId,
      reason: 'One-click demo-vendor create — cleanup + start via admin UI',
    });
    return NextResponse.json({ ok: true, batchId, services, total: services.length });
  }

  // ── chunk: seed services[offset .. offset+limit) into the batch ──
  if (phase === 'chunk') {
    const batchId = String(body.batchId ?? '');
    if (!batchId) return NextResponse.json({ error: 'Missing batchId.' }, { status: 400 });
    const offset = Math.max(0, Number(body.offset ?? 0));
    const limit = Math.max(1, Math.min(10, Number(body.limit ?? DEFAULT_CHUNK)));
    const vendorsMin = Math.max(1, Math.min(80, Number(body.vendorsMin ?? 20)));
    const vendorsMaxRaw = Math.max(vendorsMin, Math.min(80, Number(body.vendorsMax ?? 50)));

    const services = await fetchCanonicalServices(admin, null);
    const slice = services.slice(offset, offset + limit);
    if (slice.length === 0) {
      return NextResponse.json({ ok: true, done: true, nextOffset: services.length, seeded: { vendors: 0, reviews: 0, blocks: 0 } });
    }

    const schemaMap = await fetchResolvedSchemas(admin);
    const reviewEventPool = await fetchReviewEventPool(admin);

    const reviewRows: Array<Record<string, unknown>> = [];
    const blockRows: Array<Record<string, unknown>> = [];
    let vendors = 0;
    for (const service of slice) {
      const r = await seedCategory(admin, {
        service,
        batchId,
        schemaMap,
        reviewEventPool,
        cfg: { vendorsMin, vendorsMax: vendorsMaxRaw },
      });
      vendors += r.vendorsCreated;
      reviewRows.push(...r.reviewRows);
      blockRows.push(...r.blockRows);
    }

    // Bulk-insert this chunk's reviews + blocks.
    for (let c = 0; c < reviewRows.length; c += 1000) {
      const { error } = await admin.from('vendor_reviews').insert(reviewRows.slice(c, c + 1000));
      if (error && !/duplicate key/i.test(error.message)) {
        return NextResponse.json({ error: `vendor_reviews insert: ${error.message}` }, { status: 500 });
      }
    }
    for (let c = 0; c < blockRows.length; c += 1000) {
      const { error } = await admin.from('vendor_calendar_blocks').insert(blockRows.slice(c, c + 1000));
      if (error) {
        return NextResponse.json({ error: `vendor_calendar_blocks insert: ${error.message}` }, { status: 500 });
      }
    }

    const nextOffset = offset + slice.length;
    return NextResponse.json({
      ok: true,
      done: nextOffset >= services.length,
      nextOffset,
      seeded: { vendors, reviews: reviewRows.length, blocks: blockRows.length },
    });
  }

  return NextResponse.json({ error: 'Unknown phase (expected "start" or "chunk").' }, { status: 400 });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'method_not_allowed', message: 'POST { phase: "start" | "chunk" }.' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
