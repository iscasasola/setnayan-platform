'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * /admin/vendor-recommendations server actions · the vendor "recommend to your
 * couples" map editor + the two-way curation review queue.
 *
 * This surface owns the WRITE path to:
 *   - vendor_service_recommendations  (the admin-editable leaf -> SKU map)
 *   - vendor_recommendation_feedback  (the vendor flag -> admin review queue;
 *                                       resolving here can write back to the map)
 *
 * Governing principle (mirrored from the seed migration): a SKU appears for a
 * vendor leaf ONLY when it amplifies that vendor's own deliverable. The map is
 * DELIBERATELY SPARSE — most leaves get nothing, and that is correct.
 *   is_opt_in = TRUE marks a recommendation that could compete with the
 *   vendor's own service; it stays hidden until the vendor turns it on.
 *
 * All four actions are admin-gated via requireAdmin() (copied verbatim from the
 * /admin/pricing pattern) and write through the service-role admin client, since
 * the tables' RLS has no authenticated-write policy for the map. Each action
 * revalidates the surface so the page reflects the change immediately. Audit
 * rows are best-effort (a failed audit insert never rolls back the change).
 */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { adminUserId: user.id };
}

const SURFACE = '/admin/vendor-recommendations';

// Clamp a priority field to a sane non-negative integer (lower sorts first).
// Falls back to the table default (100) when blank / invalid.
function parsePriority(raw: FormDataEntryValue | null): number {
  const n = Number((raw ?? '').toString().trim());
  if (!Number.isFinite(n) || n < 0) return 100;
  return Math.round(n);
}

async function logAudit(
  admin: ReturnType<typeof createAdminClient>,
  row: {
    action: string;
    target_id: string;
    actor_user_id: string;
    metadata: Record<string, unknown>;
  },
) {
  const { error } = await admin.from('admin_audit_log').insert(row);
  if (error) {
    console.error(`[vendor-recommendations] audit insert failed (${row.action})`, error.message);
  }
}

// ─── addRecommendation ─────────────────────────────────────────────────
//
// Insert a new leaf -> SKU row into vendor_service_recommendations. The
// UNIQUE(tile_id, service_code) constraint means a duplicate is a no-op rather
// than an error — we surface a friendly "already exists" result.
export async function addRecommendation(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  const tileId = (formData.get('tile_id') ?? '').toString().trim();
  const serviceCode = (formData.get('service_code') ?? '').toString().trim();
  if (!tileId || !serviceCode) {
    redirect(`${SURFACE}?error=missing`);
  }
  const isOptIn = formData.get('is_opt_in') != null;
  const priority = parsePriority(formData.get('priority'));
  const rationaleRaw = (formData.get('rationale') ?? '').toString().trim();
  const rationale = rationaleRaw === '' ? null : rationaleRaw;

  const admin = createAdminClient();

  // ON CONFLICT (tile_id, service_code) DO NOTHING — re-adding an existing
  // pairing must not error. ignoreDuplicates returns 0 rows when it collided.
  const { data, error } = await admin
    .from('vendor_service_recommendations')
    .upsert(
      {
        tile_id: tileId,
        service_code: serviceCode,
        is_opt_in: isOptIn,
        priority,
        rationale,
        updated_by_admin_id: adminUserId,
      },
      { onConflict: 'tile_id,service_code', ignoreDuplicates: true },
    )
    .select('id');

  if (error) {
    console.error('[addRecommendation] insert failed', error.message);
    redirect(`${SURFACE}?error=db`);
  }
  const inserted = (data?.length ?? 0) > 0;
  if (inserted) {
    await logAudit(admin, {
      action: 'vendor_recommendation_add',
      target_id: `${tileId}:${serviceCode}`,
      actor_user_id: adminUserId,
      metadata: { tile_id: tileId, service_code: serviceCode, is_opt_in: isOptIn, priority, rationale },
    });
  }

  revalidatePath(SURFACE);
  redirect(`${SURFACE}?${inserted ? 'added=1' : 'exists=1'}`);
}

// ─── updateRecommendation ──────────────────────────────────────────────
//
// Edit priority / rationale / is_opt_in / is_active on one map row by id.
export async function updateRecommendation(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  const id = Number((formData.get('id') ?? '').toString().trim());
  if (!Number.isInteger(id) || id <= 0) {
    redirect(`${SURFACE}?error=missing`);
  }
  const isOptIn = formData.get('is_opt_in') != null;
  const isActive = formData.get('is_active') != null;
  const priority = parsePriority(formData.get('priority'));
  const rationaleRaw = (formData.get('rationale') ?? '').toString().trim();
  const rationale = rationaleRaw === '' ? null : rationaleRaw;

  const admin = createAdminClient();
  const { error } = await admin
    .from('vendor_service_recommendations')
    .update({
      priority,
      rationale,
      is_opt_in: isOptIn,
      is_active: isActive,
      updated_at: new Date().toISOString(),
      updated_by_admin_id: adminUserId,
    })
    .eq('id', id);

  if (error) {
    console.error('[updateRecommendation] update failed', error.message);
    redirect(`${SURFACE}?error=db`);
  }
  await logAudit(admin, {
    action: 'vendor_recommendation_update',
    target_id: String(id),
    actor_user_id: adminUserId,
    metadata: { id, priority, rationale, is_opt_in: isOptIn, is_active: isActive },
  });

  revalidatePath(SURFACE);
  redirect(`${SURFACE}?saved=1`);
}

// ─── deleteRecommendation ──────────────────────────────────────────────
export async function deleteRecommendation(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  const id = Number((formData.get('id') ?? '').toString().trim());
  if (!Number.isInteger(id) || id <= 0) {
    redirect(`${SURFACE}?error=missing`);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('vendor_service_recommendations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteRecommendation] delete failed', error.message);
    redirect(`${SURFACE}?error=db`);
  }
  await logAudit(admin, {
    action: 'vendor_recommendation_delete',
    target_id: String(id),
    actor_user_id: adminUserId,
    metadata: { id },
  });

  revalidatePath(SURFACE);
  redirect(`${SURFACE}?deleted=1`);
}

// ─── resolveFeedback ───────────────────────────────────────────────────
//
// Resolve one vendor_recommendation_feedback row as 'accepted' or 'declined'.
// Accepting acts on the map:
//   - suggest_add  → insert the proposed (tile_id, service_code) into the map
//                    (is_opt_in=false, priority=100) ON CONFLICT do nothing.
//   - not_a_fit    → deactivate (is_active=false) the matching map row.
// Either way the feedback row is stamped status + resolved_by_admin_id +
// resolved_at.
export async function resolveFeedback(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  const id = Number((formData.get('id') ?? '').toString().trim());
  const decision = (formData.get('decision') ?? '').toString().trim();
  if (!Number.isInteger(id) || id <= 0 || (decision !== 'accepted' && decision !== 'declined')) {
    redirect(`${SURFACE}?error=missing`);
  }

  const admin = createAdminClient();

  // Load the feedback row so we know what map mutation (if any) accepting it
  // implies. Only act on a still-pending row (avoids a double-apply race).
  const { data: fb, error: fbErr } = await admin
    .from('vendor_recommendation_feedback')
    .select('id, tile_id, feedback_type, service_code, status')
    .eq('id', id)
    .maybeSingle();
  if (fbErr) {
    console.error('[resolveFeedback] load failed', fbErr.message);
    redirect(`${SURFACE}?error=db`);
  }
  if (!fb || fb.status !== 'pending') {
    // Already resolved by another admin — nothing to do.
    revalidatePath(SURFACE);
    redirect(`${SURFACE}?feedback=stale`);
  }

  let mapEffect: string | null = null;

  if (decision === 'accepted' && fb.service_code) {
    if (fb.feedback_type === 'suggest_add') {
      const { error } = await admin.from('vendor_service_recommendations').upsert(
        {
          tile_id: fb.tile_id,
          service_code: fb.service_code,
          is_opt_in: false,
          priority: 100,
          updated_by_admin_id: adminUserId,
        },
        { onConflict: 'tile_id,service_code', ignoreDuplicates: true },
      );
      if (error) {
        console.error('[resolveFeedback] suggest_add insert failed', error.message);
        redirect(`${SURFACE}?error=db`);
      }
      mapEffect = 'added_to_map';
    } else if (fb.feedback_type === 'not_a_fit') {
      const { error } = await admin
        .from('vendor_service_recommendations')
        .update({ is_active: false, updated_at: new Date().toISOString(), updated_by_admin_id: adminUserId })
        .eq('tile_id', fb.tile_id)
        .eq('service_code', fb.service_code);
      if (error) {
        console.error('[resolveFeedback] not_a_fit deactivate failed', error.message);
        redirect(`${SURFACE}?error=db`);
      }
      mapEffect = 'deactivated_in_map';
    }
  }

  const { error: stampErr } = await admin
    .from('vendor_recommendation_feedback')
    .update({
      status: decision,
      resolved_by_admin_id: adminUserId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending');
  if (stampErr) {
    console.error('[resolveFeedback] stamp failed', stampErr.message);
    redirect(`${SURFACE}?error=db`);
  }

  await logAudit(admin, {
    action: 'vendor_recommendation_feedback_resolve',
    target_id: String(id),
    actor_user_id: adminUserId,
    metadata: {
      id,
      decision,
      feedback_type: fb.feedback_type,
      tile_id: fb.tile_id,
      service_code: fb.service_code,
      map_effect: mapEffect,
    },
  });

  revalidatePath(SURFACE);
  redirect(`${SURFACE}?feedback=${decision}`);
}
