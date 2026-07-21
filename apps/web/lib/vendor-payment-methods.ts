/**
 * Vendor off-platform payment options — shared types + helpers.
 *
 * Vendors publish their OWN payment destinations (bank/e-wallet details, an
 * uploaded QR, or a payment link). Couples pay them DIRECTLY, off-platform —
 * Setnayan never holds the money (RA 11967 non-party-publisher posture).
 *
 * Security-critical bits live here so every surface shares one implementation:
 *   • the Pro/Enterprise gate for payment LINKS (active paid subscription),
 *   • the link domain allowlist + shortener block,
 *   • the couple-facing fetch (authorize via the couple's RLS client, then read
 *     the owner-RLS'd table through the admin client — couples can never query
 *     vendor_payment_methods directly).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isTierAtLeast } from './vendor-tier-caps';

export type PaymentMethodType = 'bank' | 'qr' | 'link';
export type ModerationStatus = 'approved' | 'pending_review' | 'held' | 'removed';

export type VendorPaymentMethodRow = {
  payment_method_id: string;
  vendor_profile_id: string;
  method_type: PaymentMethodType;
  label: string;
  provider: string | null;
  account_name: string | null;
  account_number: string | null;
  qr_r2_key: string | null;
  decoded_destination: string | null;
  link_url: string | null;
  link_domain: string | null;
  note: string | null;
  is_primary: boolean;
  is_shown: boolean;
  moderation_status: ModerationStatus;
  moderation_note: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Recognised payment-provider domains — links here publish instantly. Anything
 * else routes to admin review (pending_review). Host-only, no scheme/path.
 */
export const ALLOWED_LINK_DOMAINS: readonly string[] = [
  'maya.me',
  'maya.ph',
  'paypal.me',
  'paypal.com',
  'stripe.com',
  'buy.stripe.com',
  'gcash.com',
  'bpi.com.ph',
  'unionbankph.com',
  'qrph.org',
];

/** Link shorteners hide the true destination → always blocked. */
export const BLOCKED_LINK_HOSTS: readonly string[] = [
  'bit.ly',
  'tinyurl.com',
  'cutt.ly',
  't.co',
  'is.gd',
  'ow.ly',
  'rb.gy',
  'shorturl.at',
];

export const PAYMENT_PROVIDERS: readonly string[] = [
  'BDO',
  'GCash',
  'Maya',
  'BPI',
  'UnionBank',
  'Metrobank',
  'Landbank',
  'PNB',
  'Security Bank',
  'RCBC',
  'Other',
];

export function extractDomain(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export type LinkClassification = {
  ok: boolean; // structurally a usable http(s) link, not a shortener
  domain: string | null;
  allowlisted: boolean;
  shortener: boolean;
  reason: string | null;
};

export function classifyPaymentLink(rawUrl: string): LinkClassification {
  const domain = extractDomain(rawUrl);
  if (!domain) {
    return {
      ok: false,
      domain: null,
      allowlisted: false,
      shortener: false,
      reason: 'Enter a valid https:// link.',
    };
  }
  const shortener = BLOCKED_LINK_HOSTS.some((h) => domain === h || domain.endsWith('.' + h));
  if (shortener) {
    return {
      ok: false,
      domain,
      allowlisted: false,
      shortener: true,
      reason: 'URL shorteners are blocked — paste your provider’s real link.',
    };
  }
  const allowlisted = ALLOWED_LINK_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d));
  return {
    ok: true,
    domain,
    allowlisted,
    shortener: false,
    reason: allowlisted ? null : 'Unknown domain — publishes after a quick admin review.',
  };
}

/** Moderation status a freshly-saved link should get based on its domain. */
export function initialLinkModeration(rawUrl: string): {
  status: ModerationStatus;
  domain: string | null;
  blocked: boolean;
} {
  const c = classifyPaymentLink(rawUrl);
  if (!c.ok) return { status: 'held', domain: c.domain, blocked: true };
  return { status: c.allowlisted ? 'approved' : 'pending_review', domain: c.domain, blocked: false };
}

/**
 * True when the vendor (by auth user_id) is on Pro or better.
 *
 * READS `vendor_profiles.tier_state` — the canonical tier source everywhere else
 * in the app (`lib/vendor-feature-gate.ts` · `lib/vendor-tier-caps.ts`).
 *
 * ── WHY THIS WAS REWRITTEN (2026-07-21, sell-vs-deliver gap audit) ──────────
 * It used to gate on `orders.service_key IN ('vendor_pro_weekly',
 * 'all_tools_unlock_annual')` — two V1 SKU codes RETIRED on 2026-05-28. Its own
 * doc comment claimed "there is no DB tier column — tier = an active orders
 * row", which stopped being true when `tier_state` landed: the subscription
 * RPCs (`create_/approve_/confirm_vendor_subscription`) write `tier_state` and
 * never touch `orders` at all. Prod: **0 orders have ever carried either code**
 * while **5 vendor_profiles sit at tier_state='pro'** — so every Pro vendor was
 * told "Payment links are a Pro & Enterprise feature — upgrade to add one",
 * with no upgrade that could ever satisfy it. Same failure shape as the Live
 * Studio lockout fixed in PR #3444: a hardcoded SKU-code list checked against a
 * column those codes never reach.
 *
 * TWO PROD REALITIES THIS MUST HONOUR — both would break a naive rewrite:
 *  1. **`tier_expires_at` is NULL for all 5 Pro vendors** (free-during-launch /
 *     admin-set). NULL means NO EXPIRY, not "expired" — a `.gt()` filter here
 *     would reproduce the exact lockout being fixed. Only a non-null timestamp
 *     in the past deactivates.
 *  2. **One user owns 46 vendor_profiles.** `.maybeSingle()` would throw on
 *     multiple rows, so this reads all of the user's profiles and passes if ANY
 *     is Pro-or-better.
 *
 * `isTierAtLeast(_, 'pro')` covers pro < enterprise < custom, so higher tiers
 * inherit automatically and no future tier needs an edit here.
 */
export async function isVendorProActive(
  client: SupabaseClient,
  vendorUserId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('vendor_profiles')
    .select('tier_state, tier_expires_at')
    .eq('user_id', vendorUserId);
  if (error || !data) return false;

  const now = Date.now();
  return (data as { tier_state?: string | null; tier_expires_at?: string | null }[]).some(
    (row) => {
      if (!isTierAtLeast(row.tier_state, 'pro')) return false;
      if (row.tier_expires_at == null) return true; // no expiry set → active
      const expiry = new Date(row.tier_expires_at).getTime();
      return Number.isFinite(expiry) && expiry > now;
    },
  );
}

/** Vendor's own methods (all of them). Call with the vendor's RLS client. */
export async function fetchOwnPaymentMethods(
  client: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorPaymentMethodRow[]> {
  const { data, error } = await client
    .from('vendor_payment_methods')
    .select('*')
    .eq('vendor_profile_id', vendorProfileId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as VendorPaymentMethodRow[];
}

export type CoupleFacingMethod = {
  payment_method_id: string;
  method_type: PaymentMethodType;
  label: string;
  provider: string | null;
  account_name: string | null;
  account_number: string | null;
  decoded_destination: string | null;
  link_url: string | null;
  link_domain: string | null;
  note: string | null;
  is_primary: boolean;
  qr_display_url: string | null;
};

// The couple-facing fetch (fetchPublishedMethodsForCouple) lives in the
// server-only companion module ./vendor-payment-methods.server.ts because it
// presigns R2 URLs (displayUrlForStoredAsset → AWS SDK). Keeping it out of this
// module lets client components import the pure helpers + constants above
// without dragging server-only code into the client bundle.
