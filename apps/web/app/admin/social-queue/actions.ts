'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Server actions backing the admin Social Queue (Social Sharing & Featuring
 * Program — corpus `03_Strategy/Social_Sharing_Program_2026-06-12.md` +
 * migration 20261130000000_social_sharing_program).
 *
 * All posting is MANUAL: the team copies a drafted caption to the Setnayan
 * Facebook page, then comes back and stamps the row so it leaves the queue.
 * Three stamps:
 *   • markConsentPosted    — couple-creation card posted (posted_at + url)
 *   • markConsentTakenDown — revoked-after-posting take-down done (24h SLA)
 *   • markVendorFeatured   — vendor verification feature posted
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
