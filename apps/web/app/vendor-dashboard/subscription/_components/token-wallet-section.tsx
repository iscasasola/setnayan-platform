import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { BalanceCard } from '@/app/vendor-dashboard/tokens/_components/balance-card';

/**
 * TokenWalletSection — REDUCED to a dormant, read-only balance panel
 * (2026-07-22 · token retirement).
 *
 * Vendor token PACKS are retired (owner 2026-07-21 · migration 20270910266901 ·
 * is_active=false, so nothing is buyable) and both answering a couple and
 * accepting a manpower gig were made FREE (migrations 20270909586177 +
 * this PR), so NOTHING on the vendor answer/spend paths consumes tokens anymore.
 * The old wallet — a buy CTA, apply-then-pay pending/resolved purchases, a
 * "buy for a teammate" picker, and "tokens unlock matched couples" copy — was
 * therefore asserting a dead model.
 *
 * Tokens can still be GRANTED (subscription bundles + admin grants), so a
 * retained balance is real. This section now does the minimum: it reads only
 * the wallet balance, renders NOTHING when the balance is zero (the common
 * case), and shows a read-only "retained balance" note when a balance exists —
 * no buy CTA, no spend copy. The token wallet / bundle-grant / burn DB plumbing
 * is left DORMANT (not deleted) for reversibility.
 */
export async function TokenWalletSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;

  const vendorId = profile.vendor_profile_id;

  // Lazy-eval expiry sweep BEFORE the wallet SELECT (no-cron preference) so the
  // earned figure reflects the live non-expired balance. Best-effort.
  const { error: evalError } = await supabase.rpc('evaluate_earned_token_expiry', {
    p_vendor_id: vendorId,
  });
  if (evalError) {
    // eslint-disable-next-line no-console
    console.warn('[plan] evaluate_earned_token_expiry failed:', evalError);
  }

  const { data: wallet } = await supabase
    .from('vendor_wallets')
    .select('purchased_tokens, earned_tokens')
    .eq('vendor_id', vendorId)
    .maybeSingle();

  const purchased = wallet?.purchased_tokens ?? 0;
  const earned = wallet?.earned_tokens ?? 0;

  // Nothing to show when there's no retained balance — keep the Plan hub clean.
  if (purchased + earned <= 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4">
        <p className="sn-eye">Tokens</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.015em] sm:text-3xl">
          Your token balance.
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink/65">
          Answering couples and accepting manpower gigs are free — nothing
          currently spends tokens. This is a retained balance from plan bundles
          and Setnayan grants. Earned tokens expire 45 days after they&rsquo;re
          granted; other tokens don&rsquo;t expire.
        </p>
      </div>

      <BalanceCard purchased={purchased} earned={earned} />
    </section>
  );
}
