import 'server-only';

import { revalidatePath } from 'next/cache';
import type { createAdminClient } from '@/lib/supabase/admin';
import { VENDOR_TIERS } from '@/lib/vendor-tier-caps';
import { planContentKeyDef } from '@/lib/vendor-plan-contents';
import { revalidateAllShopPages } from '@/lib/shop-page-cache';

/**
 * Plan contents — the EXECUTION, run only by the approvals dispatcher after a SECOND admin confirmed
 * (app/admin/approvals/actions.ts → `approve_plan_contents_change`). Kept OUT of a 'use server' file on purpose: an
 * executor exported from one is a callable route, and this one writes what every plan includes.
 * The request half is app/admin/pricing/plan-contents-actions.ts. Owner 2026-11-13, "Yes, add both".
 */

type AdminClient = ReturnType<typeof createAdminClient>;

/** The event plans whose included Papic credits are an existing catalogue column (`included_papic_credits`). */
const EVENT_PLAN_CODES = ['EVENT_PLUS', 'COUPLE_WEBSITE_PRO'] as const;

async function executeEventCreditsChange(
  admin: AdminClient,
  body: { service_code?: string; to?: number },
  params: { initiatedByAdminId: string; confirmingAdminId: string },
): Promise<void> {
  const code = body.service_code ?? '';
  if (!(EVENT_PLAN_CODES as readonly string[]).includes(code)) throw new Error('Event plan change names an unknown plan');
  const to = Number(body.to);
  if (!Number.isInteger(to) || to < 0) throw new Error('Event plan change carries a bad number');
  const { error } = await admin
    .from('platform_retail_catalog_v2')
    .update({ included_papic_credits: to, updated_by_admin_id: params.confirmingAdminId })
    .eq('service_code', code);
  if (error) throw new Error(`Event plan change failed: ${error.message}`);
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'plan_contents_changed',
    target_id: `event:${code}:included_papic_credits`,
    actor_user_id: params.confirmingAdminId,
    metadata: {
      table: 'platform_retail_catalog_v2',
      service_code: code,
      column: 'included_papic_credits',
      to,
      initiated_by: params.initiatedByAdminId,
      confirmed_by: params.confirmingAdminId,
    },
  });
  if (auditErr) console.error('[executeEventCreditsChange] audit insert FAILED — the change is live but unlogged:', auditErr);
  revalidatePath('/admin/pricing');
  revalidatePath('/pricing');
}

/**
 * The change, run by the SECOND admin from the approvals dispatcher (which has already claimed the row and enforced
 * decided_by <> initiated_by). The number comes from the payload only. The history row is written by the table's
 * trigger (vendor_plan_content_changes), so this path cannot skip it.
 */
export async function executePlanContentsChange(
  admin: AdminClient,
  params: { payload: unknown; initiatedByAdminId: string; confirmingAdminId: string; approvalId: string | null },
): Promise<void> {
  const body = (params.payload ?? {}) as { kind?: string; plan?: string; key?: string; to?: number | null; service_code?: string };
  if (body.kind === 'event_credits') {
    await executeEventCreditsChange(admin, { service_code: body.service_code, to: body.to ?? undefined }, params);
    return;
  }
  if (!body.plan || !(VENDOR_TIERS as readonly string[]).includes(body.plan)) throw new Error('Plan change has no plan');
  const def = body.key ? planContentKeyDef(body.key) : null;
  if (!def) throw new Error('Plan change names an allowance that cannot be edited');
  const to = body.to === null || body.to === undefined ? null : Number(body.to);
  if (to === null && !def.noLimitAllowed) throw new Error(`${def.label} cannot be set to no limit`);
  if (to !== null && (!Number.isInteger(to) || to < 0)) throw new Error('Plan change carries a bad number');

  const { error } = await admin.from('vendor_plan_contents').upsert(
    {
      plan: body.plan,
      key: def.key,
      value: to,
      changed_by: params.initiatedByAdminId,
      confirmed_by: params.confirmingAdminId,
      approval_id: params.approvalId,
      changed_at: new Date().toISOString(),
    },
    { onConflict: 'plan,key' },
  );
  if (error) throw new Error(`Plan change failed: ${error.message}`);

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'plan_contents_changed',
    target_id: `${body.plan}:${def.key}`,
    actor_user_id: params.confirmingAdminId,
    metadata: {
      table: 'vendor_plan_contents',
      plan: body.plan,
      key: def.key,
      to,
      initiated_by: params.initiatedByAdminId,
      confirmed_by: params.confirmingAdminId,
    },
  });
  if (auditErr) console.error('[executePlanContentsChange] audit insert FAILED — the change is live but unlogged:', auditErr);

  revalidatePath('/admin/pricing');
  // Page-scoped, never a layout bust (lint-vendor-layout-revalidate): the three supplier pages that print a plan number.
  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/team');
  revalidatePath('/vendor-dashboard/subscription');
  revalidateAllShopPages();
}
