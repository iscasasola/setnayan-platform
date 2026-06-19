import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendVendorSuspensionEmail } from '@/lib/vendor-email-triggers';

/**
 * Dispute counter cron — runs daily, rolls a 30-day window of disputes per
 * vendor, and auto-demotes any vendor with **3+ disputes** in that window.
 *
 * Per 0006 § "Demote-to-coming_soon trigger" (locked 2026-05-16):
 *   • A verified vendor with 3+ disputes in the rolling 30-day window is
 *     demoted to coming_soon (their payout schedule flips to the 20/60/20
 *     milestone release for new bookings).
 *   • The demotion writes admin_audit_log row with before/after JSON, increments
 *     vendor_profiles.demotion_count, and sets last_demoted_at = NOW().
 *   • Verified-tier perks lock (the Setnayan Pay verified-only gate per 0034
 *     § 6.5 in V1 — Setnayan Pay 5% convenience fee retired 2026-05-28 V2
 *     cutover, so the practical effect on V2 orders is the verified-tier
 *     marketplace perks instead of payment-rail gating). UI surfaces reflect
 *     this automatically via existing public_visibility read paths.
 *
 * Auth:
 *   • Requires `Authorization: Bearer <CRON_SECRET>` header.
 *   • In V1.5 this becomes a Vercel Cron entry in vercel.json; today the
 *     owner triggers it from an external scheduler (cron-job.org, GitHub
 *     Actions, etc.) hitting POST /api/admin/cron/dispute-counter.
 *   • POST only — GET is rejected so accidental URL visits don't trigger
 *     the demotion logic.
 *
 * Idempotent: re-running on the same day produces zero-net-change if no
 * vendor crossed the threshold since the last run. The audit-log row is
 * the proof of execution; the count helper (count_vendor_disputes_30d)
 * is a STABLE SQL function so running it on a quiet day is essentially free.
 */

// Force Node.js runtime — needed for the service-role client (createAdminClient
// uses environment variables that aren't surfaced in the Edge runtime).
export const runtime = 'nodejs';
// Don't statically optimise — we want fresh DB reads every invocation.
export const dynamic = 'force-dynamic';

const DEMOTION_THRESHOLD = 3;
const ROLLING_WINDOW_DAYS = 30;

type DemotionResult = {
  vendor_profile_id: string;
  business_name: string | null;
  dispute_count: number;
  before_visibility: string;
  before_state: string | null;
  demoted: boolean;
  error?: string;
};

export async function POST(request: Request) {
  // Auth — CRON_SECRET header check.
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET is not configured.' },
      { status: 503 },
    );
  }
  const authz = request.headers.get('authorization') ?? '';
  const provided = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : '';
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = new Date().toISOString();

  // Pull every vendor row that has ANY dispute in the rolling 30-day window.
  // We could compute the count via the SQL helper per-vendor, but a single
  // join + group-by is cheaper and bounds the work to vendors with at least
  // one dispute in the window.
  const windowStart = new Date(
    Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: disputeRows, error: disputesErr } = await admin
    .from('vendor_disputes')
    .select('vendor_profile_id')
    .gte('created_at', windowStart)
    .eq('counts_toward_demotion', true)
    .in('status', ['open', 'resolved_for_couple']);

  if (disputesErr) {
    return NextResponse.json(
      { ok: false, error: `Disputes query failed: ${disputesErr.message}` },
      { status: 500 },
    );
  }

  // Group disputes by vendor → count.
  const counts = new Map<string, number>();
  for (const row of disputeRows ?? []) {
    const id = row.vendor_profile_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  // Filter to vendors at or above the threshold.
  const candidates = [...counts.entries()].filter(
    ([, n]) => n >= DEMOTION_THRESHOLD,
  );

  const results: DemotionResult[] = [];

  for (const [vendorProfileId, count] of candidates) {
    const { data: profile, error: pErr } = await admin
      .from('vendor_profiles')
      .select(
        'vendor_profile_id, business_name, public_visibility, verification_state, last_demoted_at, demotion_count',
      )
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();

    if (pErr || !profile) {
      results.push({
        vendor_profile_id: vendorProfileId,
        business_name: null,
        dispute_count: count,
        before_visibility: '?',
        before_state: null,
        demoted: false,
        error: pErr?.message ?? 'Vendor not found.',
      });
      continue;
    }

    // Only verified vendors are demoted by this cron — coming_soon vendors
    // are already at the lowest active state. Hidden / archived are out
    // of scope (admin handles those manually).
    if (profile.public_visibility !== 'verified') {
      results.push({
        vendor_profile_id: vendorProfileId,
        business_name: profile.business_name ?? null,
        dispute_count: count,
        before_visibility: profile.public_visibility ?? '?',
        before_state: profile.verification_state ?? null,
        demoted: false,
      });
      continue;
    }

    // Flip visibility → coming_soon. We DON'T flip the spec's
    // `verification_state` column directly because the parallel agent owns
    // that ENUM; the canonical flow once both PRs land is:
    //   public_visibility = 'coming_soon' AND verification_state = 'demoted'
    // Today (public_visibility only), the read paths treat coming_soon as
    // the demoted-state surface and that's enough to gate verified-tier
    // marketplace perks. (Retired 2026-05-28 V2 cutover note — this gate
    // also covered Setnayan Pay access before the 5% fee was retired
    // entirely; the same coming_soon flip still locks the verified-tier
    // perks the V2 model carries forward.)
    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = {
      public_visibility: 'coming_soon',
      last_demoted_at: nowIso,
      demotion_count: ((profile.demotion_count as number | null) ?? 0) + 1,
      updated_at: nowIso,
    };
    // Best-effort flip on the parallel-agent's column if it exists. We use
    // try/catch so this never blocks the cron when the column hasn't been
    // added yet.
    if ('verification_state' in profile) {
      update.verification_state = 'demoted';
    }

    const { error: updErr } = await admin
      .from('vendor_profiles')
      .update(update)
      .eq('vendor_profile_id', vendorProfileId);

    if (updErr) {
      // Retry without verification_state if the column doesn't exist yet.
      if (
        /column .* verification_state/.test(updErr.message) ||
        /column .* last_demoted_at/.test(updErr.message) ||
        /column .* demotion_count/.test(updErr.message)
      ) {
        const fallback = {
          public_visibility: 'coming_soon',
          updated_at: nowIso,
        };
        const { error: retryErr } = await admin
          .from('vendor_profiles')
          .update(fallback)
          .eq('vendor_profile_id', vendorProfileId);
        if (retryErr) {
          results.push({
            vendor_profile_id: vendorProfileId,
            business_name: profile.business_name ?? null,
            dispute_count: count,
            before_visibility: profile.public_visibility,
            before_state: profile.verification_state ?? null,
            demoted: false,
            error: retryErr.message,
          });
          continue;
        }
      } else {
        results.push({
          vendor_profile_id: vendorProfileId,
          business_name: profile.business_name ?? null,
          dispute_count: count,
          before_visibility: profile.public_visibility,
          before_state: profile.verification_state ?? null,
          demoted: false,
          error: updErr.message,
        });
        continue;
      }
    }

    // Audit-log the demotion.
    await admin.from('admin_audit_log').insert({
      action: 'vendor_demoted_by_dispute_threshold',
      target_table: 'vendor_profiles',
      target_id: vendorProfileId,
      before_json: {
        public_visibility: profile.public_visibility,
        verification_state: profile.verification_state ?? null,
      },
      after_json: {
        public_visibility: 'coming_soon',
        verification_state: 'demoted',
        demotion_count: ((profile.demotion_count as number | null) ?? 0) + 1,
      },
      reason: `${count} disputes in rolling ${ROLLING_WINDOW_DAYS}-day window (threshold ${DEMOTION_THRESHOLD}).`,
      actor_user_id: null,
    });

    // Cross-account signal (Phase B · 2026-06-19): email the demoted vendor so
    // the dispute-driven status flip isn't silent. Wires the previously-dead
    // sendVendorSuspensionEmail (it takes the offence count — here the dispute
    // count in the rolling window). Best-effort: the sender swallows its own
    // failures and never throws, so a delivery problem never aborts the cron
    // run or skips the remaining candidates.
    await sendVendorSuspensionEmail(vendorProfileId, count).catch((e) =>
      console.error('[dispute-counter] suspension email failed:', e),
    );

    results.push({
      vendor_profile_id: vendorProfileId,
      business_name: profile.business_name ?? null,
      dispute_count: count,
      before_visibility: profile.public_visibility,
      before_state: profile.verification_state ?? null,
      demoted: true,
    });
  }

  return NextResponse.json({
    ok: true,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    window_days: ROLLING_WINDOW_DAYS,
    threshold: DEMOTION_THRESHOLD,
    vendors_evaluated: candidates.length,
    vendors_demoted: results.filter((r) => r.demoted).length,
    results,
  });
}

// Reject GET so accidental browser visits don't trigger demotions.
export function GET() {
  return NextResponse.json(
    { ok: false, error: 'POST only.' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
