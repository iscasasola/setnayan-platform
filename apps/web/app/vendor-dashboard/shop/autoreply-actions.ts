'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { vendorAutoReplyEnabled } from '@/lib/vendor-autoreply-flag';
import {
  AUTO_ACCEPT_THRESHOLD_DEFAULT,
  DAILY_AUTO_ACCEPT_CAP_DEFAULT,
  DAILY_REPLY_CAP_DEFAULT,
  parseAutoReplyConfigForm,
} from '@/lib/vendor-autoreply/config';

/**
 * Server action behind the My Shop "Auto-Reply Assistant" card (Phase 4 +
 * the Phase-4A auto-accept fields). Non-redirecting (`useActionState`-shaped,
 * the inline-docs-actions idiom): the card saves optimistically and reverts +
 * toasts on an error value.
 *
 * Writes vendor_bot_config under RLS — the write policy is
 * `current_vendor_ids('admin')`, so a viewer/agent team member gets a friendly
 * refusal from the same policy that protects the row. Flag-dark: the action
 * refuses outright while NEXT_PUBLIC_VENDOR_AUTOREPLY_V1 is off, mirroring the
 * card that never renders.
 */

export type AutoReplySaveResult =
  | {
      ok: true;
      enabled: boolean;
      dailyReplyCap: number;
      autoAcceptEnabled: boolean;
      autoAcceptThreshold: number;
      dailyAutoAcceptCap: number;
    }
  | { ok: false; error: string };

export async function updateAutoReplyConfig(
  _prev: AutoReplySaveResult | null,
  formData: FormData,
): Promise<AutoReplySaveResult> {
  if (!vendorAutoReplyEnabled()) {
    return { ok: false, error: 'The Auto-Reply Assistant is not available yet.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No shop found for this account.' };

  const parsed = parseAutoReplyConfigForm(formData);
  if (!parsed.ok) return parsed;

  // Partial upsert: only the columns in the patch are written, so the instant
  // toggle never clobbers the caps (and vice versa). A fresh row picks up the
  // schema defaults for everything else.
  const { data, error } = await supabase
    .from('vendor_bot_config')
    .upsert(
      {
        vendor_profile_id: profile.vendor_profile_id,
        ...parsed.patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'vendor_profile_id' },
    )
    .select('enabled,daily_reply_cap,auto_accept_enabled,auto_accept_threshold,daily_auto_accept_cap')
    .maybeSingle();

  if (error) {
    // RLS refusal (write policy is admin-role) → a human sentence, not SQL.
    const friendly = /row-level security/i.test(error.message)
      ? 'Only shop admins can change the Auto-Reply Assistant.'
      : error.message;
    return { ok: false, error: friendly };
  }

  revalidatePath('/vendor-dashboard/shop');

  const row = data as {
    enabled?: boolean;
    daily_reply_cap?: number;
    auto_accept_enabled?: boolean;
    auto_accept_threshold?: number;
    daily_auto_accept_cap?: number;
  } | null;
  return {
    ok: true,
    enabled: row ? Boolean(row.enabled) : (parsed.patch.enabled ?? false),
    dailyReplyCap:
      row && typeof row.daily_reply_cap === 'number'
        ? row.daily_reply_cap
        : (parsed.patch.daily_reply_cap ?? DAILY_REPLY_CAP_DEFAULT),
    autoAcceptEnabled: row
      ? Boolean(row.auto_accept_enabled)
      : (parsed.patch.auto_accept_enabled ?? false),
    autoAcceptThreshold:
      row && typeof row.auto_accept_threshold === 'number'
        ? row.auto_accept_threshold
        : (parsed.patch.auto_accept_threshold ?? AUTO_ACCEPT_THRESHOLD_DEFAULT),
    dailyAutoAcceptCap:
      row && typeof row.daily_auto_accept_cap === 'number'
        ? row.daily_auto_accept_cap
        : (parsed.patch.daily_auto_accept_cap ?? DAILY_AUTO_ACCEPT_CAP_DEFAULT),
  };
}
