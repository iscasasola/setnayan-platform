'use server';

/**
 * Catalogue › Plan contents — the server half (owner 2026-11-13, "Yes, add both"; DECISION_LOG "ADMIN GAINS ACCOUNT
 * SUSPEND + EDITABLE PLAN CONTENTS"; prototype catalogue.html › Plan contents · cfm-cap).
 *
 * 🔑 AN EDIT IS A REQUEST, NOT A WRITE — exactly like a price (saveRetailRow → approve_retail_price_change). One
 * admin asks; a DIFFERENT admin confirms in /admin/approvals, which calls `executePlanContentsChange`. The value rides
 * in the payload and is never re-read from a form, so the two admins cannot agree to different numbers.
 *
 * ⚠ The drawing says "typed + 24 h" (one admin, a typed confirm, a 24-hour wait). That shape — `run_after` on
 * admin_approval_requests and owner self-approval — is the builder panel's item A, built by another slice. Until it
 * lands, the shipped gate (a second admin) is the one used, as every price change uses today.
 *
 * ⚖ LOWERING A NUMBER NEVER TAKES ANYTHING AWAY. Shops over a lowered cap keep what they have; the create gates
 * refuse only a NEW card / seat / branch past it. The services hold (service-plan-hold, migration 20271320474333)
 * still acts only when a shop's PLAN changes — a cap edit does not put extra cards on hold. Open owner question,
 * flagged in the PR.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { asVendorTier, VENDOR_TIERS, type VendorTier } from '@/lib/vendor-tier-caps';
import {
  codeValue,
  describePlanChange,
  isLowering,
  parsePlanValue,
  planContentKeyDef,
  type PlanContentKeyDef,
} from '@/lib/vendor-plan-contents';

type AdminClient = ReturnType<typeof createAdminClient>;

function back(plan: string, params: Record<string, string>): never {
  const q = new URLSearchParams({ tab: 'plan-contents', plan, ...params });
  redirect(`/admin/pricing?${q.toString()}`);
}

/** Shops on this plan that hold MORE than `to` today — said in the request so the second admin sees it. */
async function countShopsOver(admin: AdminClient, plan: VendorTier, def: PlanContentKeyDef, to: number): Promise<number | null> {
  const { data: shops, error } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('tier_state', plan);
  if (error) {
    console.error('[plan-contents] shops on the plan unread — the over-count is not measured', error.message);
    return null;
  }
  const ids = (shops ?? []).map((s) => s.vendor_profile_id as string);
  if (ids.length === 0) return 0;

  if (def.key === 'services_per_leaf') {
    const { data, error: e } = await admin
      .from('vendor_services')
      .select('vendor_profile_id, category')
      .in('vendor_profile_id', ids)
      .eq('is_active', true);
    if (e) {
      console.error('[plan-contents] over-count unread — the request says "not counted"', e.message);
      return null;
    }
    const perKind = new Map<string, number>();
    for (const r of data ?? []) {
      const k = `${r.vendor_profile_id as string}|${r.category as string}`;
      perKind.set(k, (perKind.get(k) ?? 0) + 1);
    }
    const over = new Set<string>();
    for (const [k, n] of perKind) if (n > to) over.add(k.split('|')[0]!);
    return over.size;
  }
  if (def.key === 'agent_accounts') {
    const { data, error: e } = await admin.from('vendor_team_members').select('vendor_profile_id').in('vendor_profile_id', ids);
    if (e) {
      console.error('[plan-contents] over-count unread — the request says "not counted"', e.message);
      return null;
    }
    const per = new Map<string, number>();
    for (const r of data ?? []) per.set(r.vendor_profile_id as string, (per.get(r.vendor_profile_id as string) ?? 0) + 1);
    // The founding admin is not a seat (team/actions.ts) — a shop is over when its OTHER members exceed the cap.
    let n = 0;
    for (const c of per.values()) if (c - 1 > to) n += 1;
    return n;
  }
  if (def.key === 'branches_included') {
    const { data, error: e } = await admin
      .from('vendor_branches')
      .select('parent_vendor_profile_id')
      .in('parent_vendor_profile_id', ids)
      .eq('included_in_plan', true)
      .is('cancelled_at', null);
    if (e) {
      console.error('[plan-contents] over-count unread — the request says "not counted"', e.message);
      return null;
    }
    const per = new Map<string, number>();
    for (const r of data ?? []) {
      const id = r.parent_vendor_profile_id as string;
      per.set(id, (per.get(id) ?? 0) + 1);
    }
    let n = 0;
    for (const c of per.values()) if (c > to) n += 1;
    return n;
  }
  return null; // not measured for this allowance — the request says so rather than printing 0
}

/**
 * ASK for a change to one plan allowance. Opens an `approve_plan_contents_change` request; changes nothing itself.
 */
async function requestSupplierPlanChange(formData: FormData): Promise<void> {
  const { userId: adminUserId } = await requireAdminAction();
  const planRaw = String(formData.get('plan') ?? '');
  const key = String(formData.get('key') ?? '');
  const valueRaw = String(formData.get('value') ?? '');
  const noLimit = formData.get('no_limit') === 'on';

  if (!(VENDOR_TIERS as readonly string[]).includes(planRaw)) back('pro', { error: 'Pick a plan.' });
  const plan = asVendorTier(planRaw);
  const def = planContentKeyDef(key);
  if (!def) back(plan, { error: 'That allowance cannot be edited here.' });

  const parsed = parsePlanValue(def, valueRaw, noLimit);
  if (!parsed.ok) back(plan, { error: parsed.message });

  const admin = createAdminClient();
  const { data: row, error: readErr } = await admin
    .from('vendor_plan_contents')
    .select('value')
    .eq('plan', plan)
    .eq('key', def.key)
    .maybeSingle();
  if (readErr) back(plan, { error: 'Couldn’t read the plan table — nothing was asked. Try again.' });
  // A missing row reads as the code value — the same fallback vendor_tier_limit() and fetchLiveTierCaps use.
  const from = row ? ((row as { value: number | null }).value ?? null) : codeValue(plan, def.capKey);
  const to = parsed.value;
  if (from === to) back(plan, { saved: 'No change — that is already the number.' });

  const targetId = `${plan}:${def.key}`;
  const { data: pending } = await admin
    .from('admin_approval_requests')
    .select('approval_id')
    .eq('action_type', 'approve_plan_contents_change')
    .eq('target_id', targetId)
    .eq('status', 'pending')
    .maybeSingle();
  if (pending) {
    back(plan, { error: `A change to ${def.label} on this plan is already waiting in /admin/approvals — decide that one first.` });
  }

  const summary = describePlanChange(plan, def, from, to);
  const lowering = isLowering(from, to);
  const over = lowering && to !== null ? await countShopsOver(admin, plan, def, to) : 0;
  const overWords = !lowering
    ? ''
    : over === null
      ? ' Shops over the new number were not counted for this allowance; they keep what they have.'
      : ` ${over} shop${over === 1 ? '' : 's'} hold more than this today — they keep what they have and can’t add more.`;

  const { error: reqErr } = await admin.from('admin_approval_requests').insert({
    action_type: 'approve_plan_contents_change',
    target_id: targetId,
    payload: { plan, key: def.key, from, to, shops_over: over },
    rationale: `Change what a plan includes — ${summary}.${overWords}`,
    initiated_by: adminUserId,
    // 72 hours, matching a price change.
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  });
  if (reqErr) back(plan, { error: `Could not open the approval: ${reqErr.message}` });

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'plan_contents_change_requested',
    target_id: targetId,
    actor_user_id: adminUserId,
    metadata: { table: 'vendor_plan_contents', plan, key: def.key, from, to, shops_over: over },
  });
  if (auditErr) console.error('[requestPlanContentChange] audit insert failed (non-fatal):', auditErr);

  revalidatePath('/admin/approvals');
  back(plan, { saved: `Asked — ${summary}. A second admin confirms it in Approvals.` });
}

/** The event plans whose included Papic credits are an existing catalogue column (`included_papic_credits`). */
const EVENT_PLAN_CODES = ['EVENT_PLUS', 'COUPLE_WEBSITE_PRO'] as const;

/**
 * ASK for a change to an EVENT plan's included Papic credits — the one event-plan inclusion that already has a
 * column (`platform_retail_catalog_v2.included_papic_credits`, migration 20271308555594). Same two-admin gate.
 * Events that already bought the plan keep what they were granted; an upgrade still tops up to the higher number.
 */
async function requestEventPlanCreditsChange(formData: FormData): Promise<void> {
  const { userId: adminUserId } = await requireAdminAction();
  const code = String(formData.get('service_code') ?? '');
  const view = code === 'EVENT_PLUS' ? 'ev-plus' : 'ev-pro';
  if (!(EVENT_PLAN_CODES as readonly string[]).includes(code)) back('ev-plus', { error: 'That event plan has no credits to edit.' });
  const raw = String(formData.get('value') ?? '').trim();
  if (!/^\d+$/.test(raw) || Number(raw) > 1_000_000) back(view, { error: 'Type a whole number of credits (0 or more).' });
  const to = Number(raw);

  const admin = createAdminClient();
  const { data: row, error: readErr } = await admin
    .from('platform_retail_catalog_v2')
    .select('title, included_papic_credits')
    .eq('service_code', code)
    .maybeSingle();
  if (readErr || !row) back(view, { error: 'Couldn’t read that plan from the catalogue — nothing was asked.' });
  const r = row as { title: string | null; included_papic_credits: number | null };
  const from = r.included_papic_credits === null ? null : Number(r.included_papic_credits);
  if (from === to) back(view, { saved: 'No change — that is already the number.' });

  const targetId = `event:${code}:included_papic_credits`;
  const { data: pending } = await admin
    .from('admin_approval_requests')
    .select('approval_id')
    .eq('action_type', 'approve_plan_contents_change')
    .eq('target_id', targetId)
    .eq('status', 'pending')
    .maybeSingle();
  if (pending) back(view, { error: 'A change to these credits is already waiting in /admin/approvals — decide that one first.' });

  const summary = `${r.title ?? code} · Papic credits included ${from === null ? 'none' : from.toLocaleString('en-PH')} → ${to.toLocaleString('en-PH')}`;
  const { error: reqErr } = await admin.from('admin_approval_requests').insert({
    action_type: 'approve_plan_contents_change',
    target_id: targetId,
    payload: { kind: 'event_credits', service_code: code, from, to },
    rationale: `Change what an event plan includes — ${summary}. Events that already bought it keep what they got.`,
    initiated_by: adminUserId,
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  });
  if (reqErr) back(view, { error: `Could not open the approval: ${reqErr.message}` });

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'plan_contents_change_requested',
    target_id: targetId,
    actor_user_id: adminUserId,
    metadata: { table: 'platform_retail_catalog_v2', service_code: code, column: 'included_papic_credits', from, to },
  });
  if (auditErr) console.error('[requestEventPlanCreditsChange] audit insert failed (non-fatal):', auditErr);

  revalidatePath('/admin/approvals');
  back(view, { saved: `Asked — ${summary}. A second admin confirms it in Approvals.` });
}

/**
 * THE ONE EXPORT (one Vercel route — lib-server-action-budget): `kind=supplier` asks for a supplier plan allowance,
 * `kind=event` for an event plan's included Papic credits. Both open an `approve_plan_contents_change` request.
 */
export async function requestPlanContentsChange(formData: FormData): Promise<void> {
  const kind = String(formData.get('kind') ?? 'supplier');
  if (kind === 'event') return requestEventPlanCreditsChange(formData);
  return requestSupplierPlanChange(formData);
}
