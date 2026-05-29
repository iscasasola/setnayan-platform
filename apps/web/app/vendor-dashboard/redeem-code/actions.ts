'use server';

/**
 * /vendor-dashboard/redeem-code · server action.
 *
 * WHY · Owner brief 2026-05-29 final deliverable: vendor-side path for
 *       grant_tokens vouchers. Migration 20260703500000 PART 3 ships the
 *       canonical helper `redeem_vendor_token_voucher()` plpgsql function
 *       which does all the validation + minting in one SECURITY DEFINER
 *       transaction:
 *
 *         (1) Code format check (8 char A-Z 0-9)
 *         (2) Code exists
 *         (3) discount_type = 'grant_tokens' (other types route to couples)
 *         (4) is_active = TRUE
 *         (5) effective_from <= NOW() AND expires_at > NOW()
 *         (6) max_uses NULL OR uses_count < max_uses
 *         (7) Private-voucher eligibility (discount_code_eligible_users)
 *         (8) Per-vendor uniqueness (idempotency_key voucher:<code>:<vendor>)
 *         (9) Mint via grant_admin_direct_tokens (writes earned_token_vouchers
 *             + token_grants_log + refreshes wallet)
 *        (10) Bump uses_count
 *
 *       This action is a thin client wrapper · brand-voice error mapping
 *       lives here · the heavy lifting lives in the DB function. RPC
 *       returns the new voucher_id + tokens_granted + expires_at on success
 *       OR RAISEs with a machine-readable code (NOT_FOUND, EXPIRED, etc.).
 *
 *       The action runs as the vendor's own user (NOT admin client) so the
 *       p_vendor_user_id param is auth.uid() and any future RLS gating can
 *       flow through the same path. The DB function itself is SECURITY
 *       DEFINER so it can write to earned_token_vouchers + token_grants_log
 *       + vendor_wallets regardless of the caller's RLS policies.
 *
 * Cross-references:
 *   • Migration 20260703500000 PART 3 (redeem_vendor_token_voucher)
 *   • apps/web/lib/vouchers/validate.ts (couple-side validation chain)
 *   • CLAUDE.md 2026-05-29 vendor token grants row
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type VendorRow = {
  vendor_profile_id: string;
  user_id: string | null;
  business_name: string;
};

/**
 * Resolve the calling user's vendor_profiles row. Returns NULL if the user
 * isn't signed in OR doesn't own a vendor profile. The redemption surface
 * uses this to gate access (only signed-in vendors with a profile can
 * redeem · the page itself bounces to /vendor-dashboard/verify if no profile).
 */
async function resolveVendorForCurrentUser(): Promise<VendorRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, user_id, business_name')
    .eq('user_id', user.id)
    .maybeSingle();
  return vendor;
}

/**
 * Brand-voice error map · matches the validate.ts couple-side copy where
 * possible so the two surfaces feel like the same product. The DB function
 * RAISEs with these uppercase codes (INVALID_FORMAT, NOT_FOUND, etc.) ·
 * we translate to brand voice for the UI.
 */
const ERROR_COPY: Record<string, string> = {
  INVALID_FORMAT: 'Discount codes are 8 characters · letters and numbers only.',
  NOT_FOUND: "That code doesn't look right. Double-check and try again.",
  WRONG_TYPE: "That code isn't for vendor accounts.",
  INACTIVE: 'That code is no longer active.',
  NOT_YET_EFFECTIVE: "That code isn't active yet. Try again later.",
  EXPIRED: 'That code has expired.',
  USES_EXHAUSTED: 'That code has reached its usage limit.',
  NOT_ELIGIBLE: "That code isn't for your vendor account.",
  ALREADY_REDEEMED: "You've already redeemed this code.",
};

/**
 * Redeem a grant_tokens voucher and credit the vendor's wallet.
 *
 * Form fields:
 *   • code — 8 A-Z 0-9 chars (auto-uppercased before RPC call)
 *
 * On success: redirects to the same page with ?redeemed=<tokens> for the
 * success banner.
 * On failure: redirects to the same page with ?error=<urlencoded message>.
 */
export async function redeemVendorTokenVoucher(formData: FormData): Promise<void> {
  const vendor = await resolveVendorForCurrentUser();
  if (!vendor) {
    redirect(
      '/vendor-dashboard/redeem-code?error=' +
        encodeURIComponent('Sign in with your vendor account to redeem a code.'),
    );
  }

  const rawCode = formData.get('code');
  if (typeof rawCode !== 'string' || rawCode.trim().length === 0) {
    redirect(
      '/vendor-dashboard/redeem-code?error=' +
        encodeURIComponent('Enter a code to redeem.'),
    );
  }
  const code = rawCode.trim().toUpperCase();

  const supabase = await createClient();
  const {
    data: { user: callingUser },
  } = await supabase.auth.getUser();
  if (!callingUser) {
    redirect('/login');
  }

  // Call the helper. The function returns a single row (voucher_id,
  // tokens_granted, expires_at) on success OR RAISEs an exception with
  // one of the ERROR_COPY keys.
  const { data, error } = await supabase.rpc('redeem_vendor_token_voucher', {
    p_vendor_id: vendor.vendor_profile_id,
    p_vendor_user_id: callingUser.id,
    p_code: code,
  });

  if (error) {
    // Postgres RAISE EXCEPTION messages come through as error.message.
    // Match against our known codes; fall through to a generic copy.
    const upperMsg = error.message?.toUpperCase() ?? '';
    let copy: string | null = null;
    for (const key of Object.keys(ERROR_COPY)) {
      if (upperMsg.includes(key)) {
        copy = ERROR_COPY[key] ?? null;
        break;
      }
    }
    redirect(
      '/vendor-dashboard/redeem-code?error=' +
        encodeURIComponent(
          copy ?? "We couldn't apply that code right now. Please try again.",
        ),
    );
  }

  // RPC returns an array (TABLE return type). Grab the first row · always
  // exactly one on success.
  const row = Array.isArray(data) ? data[0] : null;
  const tokensGranted: number =
    row && typeof row.tokens_granted === 'number' ? row.tokens_granted : 0;

  // Revalidate the earnings tab too · wallet balance changes there.
  revalidatePath('/vendor-dashboard/redeem-code');
  revalidatePath('/vendor-dashboard/earnings');
  redirect(
    `/vendor-dashboard/redeem-code?redeemed=${tokensGranted}&code=${encodeURIComponent(code)}`,
  );
}
