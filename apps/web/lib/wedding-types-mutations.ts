/**
 * wedding-types-mutations.ts — the shared per-faith launch-gate write core.
 *
 * The launch gate (`wedding_type_launch_status`: per-faith per-region status +
 * readiness threshold) used to live only in /admin/wedding-types/actions.ts.
 * Taxonomy Studio PR 6 folds that surface into the Studio's Vocabularies rail,
 * so the write logic moves here as framework-free cores that BOTH the Studio
 * actions and the (now-redirecting) legacy surface can call — one source of
 * truth, no duplicated status/threshold logic (the PR-5 shared-core pattern).
 *
 * These take an already-constructed ADMIN client + the acting user id, do the
 * DB write + an admin_audit_log row, and return a plain result. Revalidation +
 * auth stay in the caller (the server action), since those are request-scoped.
 *
 * ⚠ `ceremony_type` here is the LOWERCASE ceremony key ('catholic', 'muslim',
 * 'civil') — the launch table's own key space, distinct from the Title-Case
 * `faith_vocab.faith_key`. The Studio maps faith_key → ceremony_type via
 * lib/faith-registry before calling these; never lowercase a faith_key to
 * produce it — use the registry's `key` field.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const LAUNCH_STATUSES = ['active', 'coming_soon', 'disabled'] as const;
export type LaunchStatus = (typeof LAUNCH_STATUSES)[number];

export type MutationResult = { ok: true } | { ok: false; error: string };

/**
 * Flip a religion's launch status (active / coming_soon / disabled). Stamps
 * `activated_at` the first time it goes live; preserves it thereafter so the
 * original open date survives re-edits. Audit-logged.
 */
export async function setWeddingTypeStatusCore(
  admin: SupabaseClient,
  actorUserId: string,
  ceremonyType: string,
  region: string,
  status: LaunchStatus,
): Promise<MutationResult> {
  const ceremony = ceremonyType.trim();
  const reg = (region || 'all').trim();
  if (!ceremony || !LAUNCH_STATUSES.includes(status)) {
    return { ok: false, error: 'Invalid input.' };
  }

  const { data: before } = await admin
    .from('wedding_type_launch_status')
    .select('status, activated_at')
    .eq('ceremony_type', ceremony)
    .eq('region', reg)
    .maybeSingle();

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'active' && !before?.activated_at) {
    patch.activated_at = new Date().toISOString();
  }

  const { error } = await admin
    .from('wedding_type_launch_status')
    .update(patch)
    .eq('ceremony_type', ceremony)
    .eq('region', reg);
  if (error) return { ok: false, error: error.message };

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.vocab_faith_launch_status',
    target_table: 'wedding_type_launch_status',
    target_id: `${ceremony}:${reg}`,
    before_json: { status: before?.status ?? null },
    after_json: { status },
    actor_user_id: actorUserId,
  });
  return { ok: true };
}

/**
 * Set a religion's vendor-readiness threshold (the "ready at N compatible
 * vendors + venues" bar the readiness panel measures against). Audit-logged.
 */
export async function setWeddingTypeThresholdCore(
  admin: SupabaseClient,
  actorUserId: string,
  ceremonyType: string,
  region: string,
  threshold: number,
): Promise<MutationResult> {
  const ceremony = ceremonyType.trim();
  const reg = (region || 'all').trim();
  if (!ceremony || !Number.isInteger(threshold) || threshold < 0 || threshold > 100000) {
    return { ok: false, error: 'Invalid threshold.' };
  }

  const { data: before } = await admin
    .from('wedding_type_launch_status')
    .select('vendor_count_threshold')
    .eq('ceremony_type', ceremony)
    .eq('region', reg)
    .maybeSingle();

  const { error } = await admin
    .from('wedding_type_launch_status')
    .update({ vendor_count_threshold: threshold, updated_at: new Date().toISOString() })
    .eq('ceremony_type', ceremony)
    .eq('region', reg);
  if (error) return { ok: false, error: error.message };

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.vocab_faith_launch_threshold',
    target_table: 'wedding_type_launch_status',
    target_id: `${ceremony}:${reg}`,
    before_json: { vendor_count_threshold: before?.vendor_count_threshold ?? null },
    after_json: { vendor_count_threshold: threshold },
    actor_user_id: actorUserId,
  });
  return { ok: true };
}
