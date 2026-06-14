'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { nextAvailableSlot } from '@/lib/social/governor';
import { runSocialFlush } from '@/lib/social/flush';

/**
 * Server actions backing the admin Social Queue (Social Sharing & Featuring
 * Program — corpus `03_Strategy/Social_Sharing_Program_2026-06-12.md` +
 * migrations 20261203000000_social_sharing_program +
 * 20261204000000_social_autopublish).
 *
 * Two generations of actions live here:
 *
 * MANUAL stamps (the original queue — the team copies a drafted caption to
 * the Facebook page by hand, then stamps the row so it leaves the queue):
 *   • markConsentPosted    — couple-creation card posted (posted_at + url)
 *   • markConsentTakenDown — revoked-after-posting take-down done (24h SLA)
 *   • markVendorFeatured   — vendor verification feature posted
 *
 * AUTO-PUBLISH controls (Phase A — § 8 / § 8.3b, lib/social/flush.ts):
 *   • updatePublishSettings — master switch + per-platform toggles
 *   • pullSocialPost        — pull a scheduled/failed post from the queue
 *   • postSocialPostNow     — clear the hold, schedule now, flush
 *   • retrySocialPost       — failed → scheduled, due immediately
 *   • updateSocialPostBody  — edit title/body while still scheduled
 *   • createAnnouncement    — hand-written post at the next governor slot
 *   • saveEvergreenItem     — curate the evergreen content pool
 *
 * Single-admin authority per 0023 § 4.3 — same requireAdmin gate as
 * app/admin/verify/actions.ts.
 */

type AdminUser = { user_id: string };

async function requireAdmin(): Promise<AdminUser> {
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
  return { user_id: user.id };
}

function readFormString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

/** Optional post URL — keep only plausible http(s) links, else NULL. */
function readPostUrl(formData: FormData): string | null {
  const raw = readFormString(formData, 'post_url');
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw.slice(0, 2000) : null;
}

/** Couple-creation card was posted to the Facebook page. */
export async function markConsentPosted(formData: FormData) {
  await requireAdmin();
  const consentId = readFormString(formData, 'consent_id');
  if (!consentId) {
    return redirect('/admin/social-queue?error=Missing+consent');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('marketing_share_consents')
    .update({
      posted_at: new Date().toISOString(),
      post_url: readPostUrl(formData),
      updated_at: new Date().toISOString(),
    })
    .eq('consent_id', consentId)
    .is('posted_at', null);

  if (error) {
    return redirect(
      `/admin/social-queue?error=${encodeURIComponent(error.message)}`,
    );
  }
  revalidatePath('/admin/social-queue');
  redirect('/admin/social-queue?posted=1');
}

/** Revoked-after-posting take-down completed (24-hour SLA). */
export async function markConsentTakenDown(formData: FormData) {
  await requireAdmin();
  const consentId = readFormString(formData, 'consent_id');
  if (!consentId) {
    return redirect('/admin/social-queue?error=Missing+consent');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('marketing_share_consents')
    .update({
      taken_down_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('consent_id', consentId)
    .is('taken_down_at', null);

  if (error) {
    return redirect(
      `/admin/social-queue?error=${encodeURIComponent(error.message)}`,
    );
  }
  revalidatePath('/admin/social-queue');
  redirect('/admin/social-queue?taken_down=1');
}

/** Vendor verification feature was posted — vendor leaves the queue forever. */
export async function markVendorFeatured(formData: FormData) {
  await requireAdmin();
  const vendorProfileId = readFormString(formData, 'vendor_profile_id');
  if (!vendorProfileId) {
    return redirect('/admin/social-queue?error=Missing+vendor');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('vendor_profiles')
    .update({
      social_featured_at: new Date().toISOString(),
      social_post_url: readPostUrl(formData),
      updated_at: new Date().toISOString(),
    })
    .eq('vendor_profile_id', vendorProfileId)
    .is('social_featured_at', null);

  if (error) {
    return redirect(
      `/admin/social-queue?error=${encodeURIComponent(error.message)}`,
    );
  }
  revalidatePath('/admin/social-queue');
  redirect('/admin/social-queue?vendor_posted=1');
}

// ═══════════════════════════════════════════════════════════════════════════
// Auto-publish controls (Phase A — migration 20261204000000_social_autopublish)
// ═══════════════════════════════════════════════════════════════════════════

/** Optional http(s) URL form field — plausible links only, else NULL. */
function readHttpUrl(formData: FormData, key: string): string | null {
  const raw = readFormString(formData, key);
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw.slice(0, 2000) : null;
}

function failRedirect(message: string): never {
  redirect(`/admin/social-queue?error=${encodeURIComponent(message)}`);
}

function okRedirect(flag: string): never {
  revalidatePath('/admin/social-queue');
  redirect(`/admin/social-queue?${flag}=1`);
}

/**
 * Master switch + per-platform toggles. autopublish_enabled ships FALSE —
 * the owner flips it here once the Meta env vars are pasted. Checkbox forms:
 * include ALL four checkboxes in the form (unchecked = off).
 */
export async function updatePublishSettings(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from('social_publish_settings')
    .update({
      autopublish_enabled: formData.get('autopublish_enabled') === 'on',
      facebook_enabled: formData.get('facebook_enabled') === 'on',
      instagram_enabled: formData.get('instagram_enabled') === 'on',
      tiktok_enabled: formData.get('tiktok_enabled') === 'on',
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);
  if (error) failRedirect(error.message);
  okRedirect('settings_saved');
}

/**
 * Pull a post from the queue — only scheduled/failed rows can be pulled
 * (published posts go through the manual take-down lane instead; pulled is
 * terminal and the sweep won't recompose it).
 */
export async function pullSocialPost(formData: FormData) {
  await requireAdmin();
  const postId = readFormString(formData, 'post_id');
  if (!postId) failRedirect('Missing post');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('social_posts')
    .update({ status: 'pulled', updated_at: new Date().toISOString() })
    .eq('post_id', postId)
    .in('status', ['scheduled', 'failed'])
    .select('post_id');
  if (error) failRedirect(error.message);
  if (!data || data.length === 0) {
    failRedirect('Post is no longer pullable (already publishing or published).');
  }
  okRedirect('pulled');
}

/**
 * Post now — clears the 48h pull window and the governor slot, then runs a
 * flush so the dispatch happens in THIS request. The publish_after content
 * gate (event_date + 7d) deliberately stays: even "post now" never jumps a
 * couple's event. The flush throttle is reset first so the immediate flush
 * isn't a no-op.
 */
export async function postSocialPostNow(formData: FormData) {
  await requireAdmin();
  const postId = readFormString(formData, 'post_id');
  if (!postId) failRedirect('Missing post');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('social_posts')
    .update({
      hold_until: null,
      scheduled_for: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('post_id', postId)
    .eq('status', 'scheduled')
    .select('post_id');
  if (error) failRedirect(error.message);
  if (!data || data.length === 0) failRedirect('Post is not in a schedulable state.');

  // Reset the flush throttle so the explicit flush below claims immediately.
  await admin
    .from('social_publish_settings')
    .update({ last_flush_at: null })
    .eq('id', true);
  await runSocialFlush();
  okRedirect('posted_now');
}

/** Failed → scheduled, due immediately (the next flush re-dispatches it). */
export async function retrySocialPost(formData: FormData) {
  await requireAdmin();
  const postId = readFormString(formData, 'post_id');
  if (!postId) failRedirect('Missing post');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('social_posts')
    .update({
      status: 'scheduled',
      scheduled_for: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('post_id', postId)
    .eq('status', 'failed')
    .select('post_id');
  if (error) failRedirect(error.message);
  if (!data || data.length === 0) failRedirect('Only failed posts can be retried.');
  okRedirect('retried');
}

/** Edit title/body while the post is still scheduled (pre-dispatch only). */
export async function updateSocialPostBody(formData: FormData) {
  await requireAdmin();
  const postId = readFormString(formData, 'post_id');
  const body = readFormString(formData, 'body');
  if (!postId) failRedirect('Missing post');
  if (!body) failRedirect('The post body cannot be empty.');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('social_posts')
    .update({
      title: readFormString(formData, 'title'),
      body,
      updated_at: new Date().toISOString(),
    })
    .eq('post_id', postId)
    .eq('status', 'scheduled')
    .select('post_id');
  if (error) failRedirect(error.message);
  if (!data || data.length === 0) {
    failRedirect('Post is no longer editable (already publishing or published).');
  }
  okRedirect('body_saved');
}

/**
 * Hand-written announcement → the queue at the next governor slot (§ 8.3b —
 * announcements publish at the next slot, no hold window). source_ref is a
 * fresh UUID so the (source_type, source_ref) partial-unique index never
 * collides repeat announcements.
 */
export async function createAnnouncement(formData: FormData) {
  const { user_id } = await requireAdmin();
  const body = readFormString(formData, 'body');
  if (!body) failRedirect('Announcement body is required.');

  const admin = createAdminClient();

  // Same taken-slot assembly as the flush's governor pass: everything
  // scheduled or published with a slot in the last 24h or the future.
  const now = new Date();
  const takenCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: takenData, error: takenErr } = await admin
    .from('social_posts')
    .select('scheduled_for')
    .in('status', ['scheduled', 'publishing', 'published'])
    .gte('scheduled_for', takenCutoff);
  if (takenErr) failRedirect(takenErr.message);
  const takenSlots = ((takenData ?? []) as Array<{ scheduled_for: string | null }>)
    .map((r) => (r.scheduled_for ? new Date(r.scheduled_for) : null))
    .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));

  const { error } = await admin.from('social_posts').insert({
    source_type: 'announcement',
    source_ref: crypto.randomUUID(),
    title: readFormString(formData, 'title'),
    body,
    media_url: readHttpUrl(formData, 'media_url'),
    link_url: readHttpUrl(formData, 'link_url'),
    scheduled_for: nextAvailableSlot('facebook', takenSlots, now).toISOString(),
    created_by: user_id,
  });
  if (error) failRedirect(error.message);
  okRedirect('announcement_created');
}

/**
 * Curate the evergreen pool — insert (no item_id) or update (item_id set,
 * including the is_active toggle). The flush's content floor reposts the
 * least-recently-used active item when the page goes quiet.
 */
export async function saveEvergreenItem(formData: FormData) {
  await requireAdmin();
  const itemId = readFormString(formData, 'item_id');
  const title = readFormString(formData, 'title');
  const body = readFormString(formData, 'body');
  if (!title || !body) failRedirect('Evergreen items need a title and a body.');

  const admin = createAdminClient();
  const fields = {
    title,
    body,
    media_url: readHttpUrl(formData, 'media_url'),
    link_url: readHttpUrl(formData, 'link_url'),
    is_active: formData.get('is_active') === 'on',
    updated_at: new Date().toISOString(),
  };
  const { error } = itemId
    ? await admin.from('social_evergreen_items').update(fields).eq('item_id', itemId)
    : await admin.from('social_evergreen_items').insert(fields);
  if (error) failRedirect(error.message);
  okRedirect('evergreen_saved');
}
