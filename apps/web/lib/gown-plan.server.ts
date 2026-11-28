import 'server-only';
/**
 * 👗 The Attire Maker plan's reads and writes (rules: lib/gown-plan.ts). Service role only: a shop never writes its own
 * plan or trial (vendor_gown_plans has no INSERT/UPDATE grant), and eligibility is read from its own ONLINE service
 * cards the same way the Toolkit reads them (`vendor_services.category`, `is_active`; `kindOf` → `isGownKind`).
 * 🔒 lib/gown-plan.server.test.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isGownKind } from '@/lib/gown-maker';
import { kindOf } from '@/lib/supplier-store';
import type { GownPlanFacts, GownPlanTier } from '@/lib/gown-plan';

/** The shop's facts for `gownPlanState`. A failed read is `eligible: null` (the gate then refuses, said plainly). */
export async function readGownPlanFacts(admin: SupabaseClient, vendorProfileId: string): Promise<GownPlanFacts> {
  try {
    const [cards, row] = await Promise.all([
      admin.from('vendor_services').select('category').eq('vendor_profile_id', vendorProfileId).eq('is_active', true),
      admin.from('vendor_gown_plans').select('trial_started_at, plan_tier, plan_until').eq('vendor_profile_id', vendorProfileId).maybeSingle(),
    ]);
    if (cards.error || row.error) {
      logQueryError('readGownPlanFacts', cards.error ?? row.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
      return { eligible: null, trialStartedAt: null, plan: null };
    }
    const eligible = ((cards.data ?? []) as { category: string | null }[]).some((c) => isGownKind(kindOf((c.category ?? '').trim())));
    const r = row.data as { trial_started_at: string | null; plan_tier: GownPlanTier | null; plan_until: string | null } | null;
    return { eligible, trialStartedAt: r?.trial_started_at ?? null, plan: r?.plan_tier && r.plan_until ? { tier: r.plan_tier, until: r.plan_until } : null };
  } catch (err) {
    logQueryError('readGownPlanFacts', err, { vendor_profile_id: vendorProfileId });
    return { eligible: null, trialStartedAt: null, plan: null };
  }
}

/**
 * Starts the shop's one trial at its first open: the row is created with the stamp. A shop that already has a row is
 * left alone — its trial has started, or it bought a plan before ever opening (then it has no trial: once a plan ends
 * it is paused, never handed free days). Returns the trial's start as stored (null when there is none or the write
 * failed; the gate then answers from the facts it read).
 */
export async function stampGownTrial(admin: SupabaseClient, vendorProfileId: string, nowIso: string): Promise<string | null> {
  const ins = await admin.from('vendor_gown_plans').upsert({ vendor_profile_id: vendorProfileId, trial_started_at: nowIso }, { onConflict: 'vendor_profile_id', ignoreDuplicates: true });
  if (ins.error) {
    logQueryError('stampGownTrial', ins.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const { data } = await admin.from('vendor_gown_plans').select('trial_started_at').eq('vendor_profile_id', vendorProfileId).maybeSingle();
  return (data as { trial_started_at: string | null } | null)?.trial_started_at ?? null;
}

/** Writes the shop's plan (payment approval and its reversal only). Throws on a failed write so the caller reports it. */
export async function writeGownPlan(admin: SupabaseClient, vendorProfileId: string, plan: { tier: GownPlanTier; until: string } | null): Promise<void> {
  const { error } = await admin
    .from('vendor_gown_plans')
    .upsert({ vendor_profile_id: vendorProfileId, plan_tier: plan?.tier ?? null, plan_until: plan?.until ?? null, updated_at: new Date().toISOString() }, { onConflict: 'vendor_profile_id' });
  if (error) throw new Error(`vendor_gown_plans write failed: ${error.message}`);
}
