'use server';

/**
 * Server actions for vendor push-token registration.
 *
 * These actions are called client-side by PushNotificationRegistrar after
 * the browser (or Capacitor) grants push permission and returns a device token.
 *
 * RLS: vendor_push_tokens has an ALL policy scoped to
 * `current_vendor_profile_ids()` so upserts/updates are automatically
 * restricted to the signed-in vendor's own tokens — no extra ownership check
 * needed here. The only explicit guard is the `vendor_profile_id` fetch (so we
 * get a friendly error instead of a raw RLS violation if the user has no vendor
 * profile at all).
 *
 * Dedup guarantee: the UNIQUE (vendor_profile_id, token) constraint means the
 * same token can be re-registered on every dashboard mount without creating
 * duplicate rows — the upsert simply refreshes `last_registered_at`.
 */

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the vendor_profile_id for the currently authenticated user.
 * Throws a user-friendly Error if the user is not authenticated or has no
 * vendor profile — callers (client components) should catch and log.
 */
async function resolveVendorProfileId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) throw new Error('No vendor profile found for this account');

  return profile.vendor_profile_id;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Register (or refresh) a device push token for the current vendor.
 *
 * Safe to call on every mount — the ON CONFLICT clause updates
 * `last_registered_at` and `is_active = true` on a duplicate (token, vendor)
 * pair rather than inserting a new row.
 */
export async function registerPushToken(
  token: string,
  platform: 'android' | 'ios' | 'web',
): Promise<void> {
  if (!token || token.trim().length === 0) {
    throw new Error('token must not be empty');
  }
  if (!['android', 'ios', 'web'].includes(platform)) {
    throw new Error(`Unknown platform: ${platform}`);
  }

  const vendorProfileId = await resolveVendorProfileId();
  const supabase = await createClient();

  const { error } = await supabase.from('vendor_push_tokens').upsert(
    {
      vendor_profile_id: vendorProfileId,
      token: token.trim(),
      platform,
      last_registered_at: new Date().toISOString(),
      is_active: true,
    },
    {
      // Dedup on the unique pair — re-registration refreshes timestamps.
      onConflict: 'vendor_profile_id,token',
    },
  );

  if (error) {
    // Surface a clean error — the Supabase error code gives the caller enough
    // context (e.g. 42501 = RLS violation, 23503 = vendor_profiles FK missing).
    throw new Error(`registerPushToken failed [${error.code}]: ${error.message}`);
  }
}

/**
 * Deactivate a push token for the current vendor.
 *
 * Called when the vendor explicitly disables push notifications in Settings,
 * or when permission is revoked. Sets is_active = false without deleting the
 * row so delivery history is preserved for debugging (matching the pattern
 * used by the permanent-failure deactivation in /api/notify).
 */
export async function deactivatePushToken(token: string): Promise<void> {
  if (!token || token.trim().length === 0) return;

  const vendorProfileId = await resolveVendorProfileId();
  const supabase = await createClient();

  const { error } = await supabase
    .from('vendor_push_tokens')
    .update({ is_active: false })
    .eq('vendor_profile_id', vendorProfileId)
    .eq('token', token.trim());

  if (error) {
    throw new Error(`deactivatePushToken failed [${error.code}]: ${error.message}`);
  }
}

/**
 * Deactivate ALL push tokens for the current vendor.
 *
 * Used by the "Disable push notifications" toggle in Settings — one call
 * disables all registered devices at once.
 */
export async function deactivateAllPushTokens(): Promise<void> {
  const vendorProfileId = await resolveVendorProfileId();
  const supabase = await createClient();

  const { error } = await supabase
    .from('vendor_push_tokens')
    .update({ is_active: false })
    .eq('vendor_profile_id', vendorProfileId)
    .eq('is_active', true); // no-op if already all inactive

  if (error) {
    throw new Error(`deactivateAllPushTokens failed [${error.code}]: ${error.message}`);
  }
}
