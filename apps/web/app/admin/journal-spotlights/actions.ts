'use server';

/**
 * /admin/journal-spotlights server actions — the ONLY write path into
 * public.journal_vendor_spotlights (Wave 5 Editorial & Journal Spotlights).
 *
 * Surfaces five operations:
 *   1. attachSpotlight       — create a DRAFT credit (vendor ⇄ blog_slug ⇄
 *                              placement). Drafts are invisible to the public
 *                              (admin_approved_at stays NULL).
 *   2. approveFreeSpotlight  — single-admin publish for the FREE placements
 *                              (featured_partner / recommended). Stamps
 *                              admin_approved_at. Sponsored rows are refused here.
 *   3. initiateSponsored     — first admin opens the two-admin gate for a
 *                              SPONSORED (paid) row. Writes a pending row to
 *                              admin_approval_requests (action_type=
 *                              'approve_journal_spotlight', target_id=spotlight).
 *   4. confirmSponsored      — a DIFFERENT admin completes the four-eyes
 *                              handshake (atomic .neq('initiated_by', me) claim)
 *                              and only then stamps admin_approved_at. This is
 *                              the lock: a paid placement can never publish on
 *                              one admin's say-so, and only a row flagged
 *                              is_sponsored=TRUE can take this path.
 *   5. removeSpotlight       — delete a credit (single admin), cancelling any
 *                              pending approval.
 *
 * All writes go through the service-role admin client (RLS-bypassing); the
 * requireAdmin() gate re-asserts admin context (defense in depth — the /admin
 * layout already 404s non-admins). Every mutation revalidates the console + the
 * affected public /blog/[slug] page so changes show with no redeploy.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { findBlogArticle } from '@/lib/blog';
import { JOURNAL_SPONSORED_SKU } from '@/lib/journal-spotlights';

const BASE = '/admin/journal-spotlights';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACEMENTS = new Set(['featured_partner', 'recommended', 'sponsored']);
const FREE_PLACEMENTS = new Set(['featured_partner', 'recommended']);

function readString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function back(kind: 'ok' | 'error', msg: string): never {
  const p = new URLSearchParams();
  p.set(kind, msg);
  redirect(`${BASE}?${p.toString()}`);
}

async function requireAdmin(): Promise<{ userId: string }> {
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
  return { userId: user.id };
}

async function audit(opts: {
  action: string;
  targetId: string;
  actorUserId: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from('admin_audit_log').insert({
    action: opts.action,
    target_table: 'journal_vendor_spotlights',
    target_id: opts.targetId,
    actor_user_id: opts.actorUserId,
    reason: opts.reason ?? null,
    before_json: opts.before ?? null,
    after_json: opts.after ?? null,
  });
  if (error) console.error('[journal-spotlights audit]', error.message);
}

/** Revalidate the console + the affected article (if any). */
function revalidateSurfaces(blogSlug?: string | null) {
  revalidatePath(BASE);
  if (blogSlug) revalidatePath(`/blog/${blogSlug}`);
}

// ---------------------------------------------------------------------------
// 1. ATTACH — create a draft credit
// ---------------------------------------------------------------------------

export async function attachSpotlight(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const blogSlug = readString(formData, 'blog_slug');
  const vendorId = readString(formData, 'vendor_profile_id');
  const placement = readString(formData, 'placement') || 'featured_partner';
  const sortOrderRaw = readString(formData, 'sort_order');

  if (!blogSlug) back('error', 'Pick a Journal article.');
  // The Journal is file-based — validate the slug against the in-code registry.
  if (!findBlogArticle(blogSlug)) back('error', 'That article slug is not in the Journal.');
  if (!UUID_RE.test(vendorId)) back('error', 'Enter a valid vendor profile ID (UUID).');
  if (!PLACEMENTS.has(placement)) back('error', 'Invalid placement.');

  const isSponsored = placement === 'sponsored';
  const sortOrder = sortOrderRaw === '' ? 0 : Number.parseInt(sortOrderRaw, 10);
  if (Number.isNaN(sortOrder)) back('error', 'Sort order must be a number.');

  const admin = createAdminClient();

  // Verify the vendor exists (clearer than the FK error).
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .eq('vendor_profile_id', vendorId)
    .maybeSingle();
  if (!vendor) back('error', 'No vendor profile with that ID.');

  // UPSERT on the (blog_slug, vendor_profile_id) unique key — re-attaching the
  // same vendor to the same article updates the placement instead of erroring.
  // It deliberately does NOT touch admin_approved_at: an existing published
  // credit stays published; a draft stays a draft.
  const { data: row, error } = await admin
    .from('journal_vendor_spotlights')
    .upsert(
      {
        blog_slug: blogSlug,
        vendor_profile_id: vendorId,
        placement,
        is_sponsored: isSponsored,
        sponsored_sku_code: isSponsored ? JOURNAL_SPONSORED_SKU : null,
        sort_order: sortOrder,
      },
      { onConflict: 'blog_slug,vendor_profile_id' },
    )
    .select('spotlight_id')
    .single();
  if (error) back('error', error.message);

  await audit({
    action: 'journal_spotlight_attached',
    targetId: row.spotlight_id,
    actorUserId: userId,
    after: { blog_slug: blogSlug, vendor_profile_id: vendorId, placement },
  });

  revalidateSurfaces(blogSlug);
  back(
    'ok',
    isSponsored
      ? `Sponsored credit drafted for ${vendor.business_name ?? 'vendor'}. It needs two-admin approval to publish.`
      : `Credit drafted for ${vendor.business_name ?? 'vendor'}. Approve it to publish.`,
  );
}

// ---------------------------------------------------------------------------
// 2. APPROVE FREE — single-admin publish (featured_partner / recommended only)
// ---------------------------------------------------------------------------

export async function approveFreeSpotlight(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const spotlightId = readString(formData, 'spotlight_id');
  if (!UUID_RE.test(spotlightId)) back('error', 'Invalid spotlight id.');

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('journal_vendor_spotlights')
    .select('spotlight_id, placement, is_sponsored, blog_slug, admin_approved_at')
    .eq('spotlight_id', spotlightId)
    .maybeSingle();
  if (!existing) back('error', 'Spotlight not found.');
  if (existing.admin_approved_at) back('error', 'Already published.');
  // SPONSORED rows must go through the two-admin gate — never the single-admin
  // path. This is the lock that keeps a paid slot from publishing on one
  // admin's say-so.
  if (existing.is_sponsored || !FREE_PLACEMENTS.has(existing.placement)) {
    back('error', 'Sponsored placements need two-admin approval — use the sponsored queue.');
  }

  const { error } = await admin
    .from('journal_vendor_spotlights')
    .update({ admin_approved_at: new Date().toISOString() })
    .eq('spotlight_id', spotlightId);
  if (error) back('error', error.message);

  await audit({
    action: 'journal_spotlight_approved_free',
    targetId: spotlightId,
    actorUserId: userId,
    before: { admin_approved_at: null },
    after: { admin_approved_at: 'now' },
  });

  revalidateSurfaces(existing.blog_slug);
  back('ok', 'Credit published.');
}

// ---------------------------------------------------------------------------
// 3. INITIATE SPONSORED — first admin opens the two-admin gate
// ---------------------------------------------------------------------------

export async function initiateSponsored(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const spotlightId = readString(formData, 'spotlight_id');
  if (!UUID_RE.test(spotlightId)) back('error', 'Invalid spotlight id.');

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('journal_vendor_spotlights')
    .select('spotlight_id, is_sponsored, admin_approved_at')
    .eq('spotlight_id', spotlightId)
    .maybeSingle();
  if (!existing) back('error', 'Spotlight not found.');
  if (!existing.is_sponsored) {
    back('error', 'This is a free placement — approve it directly, no two-admin gate needed.');
  }
  if (existing.admin_approved_at) back('error', 'Already published.');

  // Avoid duplicate pending rows for the same spotlight.
  const { data: alreadyPending } = await admin
    .from('admin_approval_requests')
    .select('approval_id, initiated_by')
    .eq('action_type', 'approve_journal_spotlight')
    .eq('target_id', spotlightId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (alreadyPending) {
    back(
      'error',
      alreadyPending.initiated_by === userId
        ? 'You already initiated this. A different admin must confirm.'
        : 'An approval is already pending a second admin.',
    );
  }

  const { error: insErr } = await admin.from('admin_approval_requests').insert({
    action_type: 'approve_journal_spotlight',
    target_id: spotlightId,
    rationale: `Admin ${userId} initiated approval of sponsored journal spotlight id=${spotlightId}`,
    initiated_by: userId,
    // 72-hour window — paid placements aren't time-critical.
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  });
  if (insErr) back('error', `Could not open approval: ${insErr.message}`);

  await audit({
    action: 'journal_spotlight_sponsored_initiated',
    targetId: spotlightId,
    actorUserId: userId,
    after: { status: 'pending_second_admin' },
  });

  revalidateSurfaces();
  back('ok', 'Approval opened — a different admin must confirm before it publishes.');
}

// ---------------------------------------------------------------------------
// 4. CONFIRM SPONSORED — second admin completes the four-eyes handshake
// ---------------------------------------------------------------------------

export async function confirmSponsored(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const approvalId = readString(formData, 'approval_id');
  const spotlightId = readString(formData, 'spotlight_id');
  if (!UUID_RE.test(approvalId) || !UUID_RE.test(spotlightId)) {
    back('error', 'Invalid ids.');
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Atomic claim — succeeds ONLY if the request is still pending, not expired,
  // and the current admin is NOT the initiator (four-eyes enforcement, the same
  // guarantee as /admin/approvals + vendor-partnerships).
  const { data: claimed, error: claimErr } = await admin
    .from('admin_approval_requests')
    .update({ status: 'approved', decided_by: userId, decided_at: nowIso })
    .eq('approval_id', approvalId)
    .eq('action_type', 'approve_journal_spotlight')
    .eq('target_id', spotlightId)
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .neq('initiated_by', userId)
    .select('approval_id')
    .maybeSingle();
  if (claimErr) back('error', claimErr.message);
  if (!claimed) {
    back(
      'error',
      'Could not confirm — the request was already decided, expired, or you initiated it. A different admin must confirm.',
    );
  }

  // Execute: publish the sponsored credit. Guard is_sponsored again (defence in
  // depth) so this path can never publish a non-sponsored row.
  const { data: updated, error: updErr } = await admin
    .from('journal_vendor_spotlights')
    .update({ admin_approved_at: nowIso })
    .eq('spotlight_id', spotlightId)
    .eq('is_sponsored', true)
    .select('blog_slug')
    .maybeSingle();

  if (updErr || !updated) {
    // Roll the claim back so another admin can retry.
    await admin
      .from('admin_approval_requests')
      .update({ status: 'pending', decided_by: null, decided_at: null })
      .eq('approval_id', approvalId)
      .eq('status', 'approved');
    back('error', `Publish failed: ${updErr?.message ?? 'spotlight not found or not sponsored.'}`);
  }

  await audit({
    action: 'journal_spotlight_sponsored_published',
    targetId: spotlightId,
    actorUserId: userId,
    before: { admin_approved_at: null },
    after: { admin_approved_at: 'now' },
  });

  revalidateSurfaces(updated.blog_slug);
  back('ok', 'Sponsored credit published (two-admin approved).');
}

// ---------------------------------------------------------------------------
// 5. REMOVE — delete a credit (single admin); cancel any pending approval
// ---------------------------------------------------------------------------

export async function removeSpotlight(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const spotlightId = readString(formData, 'spotlight_id');
  if (!UUID_RE.test(spotlightId)) back('error', 'Invalid spotlight id.');

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('journal_vendor_spotlights')
    .select('blog_slug')
    .eq('spotlight_id', spotlightId)
    .maybeSingle();

  const { error } = await admin
    .from('journal_vendor_spotlights')
    .delete()
    .eq('spotlight_id', spotlightId);
  if (error) back('error', error.message);

  // Cancel any pending sponsored approval for this spotlight.
  await admin
    .from('admin_approval_requests')
    .update({ status: 'rejected', decided_by: userId, decided_at: new Date().toISOString() })
    .eq('action_type', 'approve_journal_spotlight')
    .eq('target_id', spotlightId)
    .eq('status', 'pending');

  await audit({
    action: 'journal_spotlight_removed',
    targetId: spotlightId,
    actorUserId: userId,
  });

  revalidateSurfaces(existing?.blog_slug ?? null);
  back('ok', 'Credit removed.');
}
