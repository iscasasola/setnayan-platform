import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Crown } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { approveSubscription, rejectSubscription } from './actions';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = {
  title: 'Subscriptions · Admin',
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ done?: string; error?: string }>;
};

type SubscriptionRow = {
  purchase_id: string;
  vendor_id: string;
  sku_code: string;
  tier: 'pro' | 'enterprise' | 'free' | 'verified';
  billing_cycle: 'monthly' | 'annual' | null;
  amount_php: number | string | null;
  reference_code: string | null;
  status: 'pending_payment' | 'paid' | 'rejected' | 'superseded';
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
  rejection_reason: string | null;
};

const NUMBER = new Intl.NumberFormat('en-PH');
const TIER_LABEL: Record<string, string> = { pro: 'Pro', enterprise: 'Enterprise' };

function fmtDate(s: string) {
  return new Date(s).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * /admin/subscriptions — reconcile vendor Pro/Enterprise subscription orders
 * (apply-then-pay · Phase D · Vendor Tier #5).
 *
 * A vendor starts an upgrade at /vendor-dashboard/subscription, pays our BDO /
 * GCash account with the reference code, and lands here as pending. Admin
 * confirms the payment → the PLAN activates, via approve_vendor_subscription
 * (idempotent). Same path a future Maya / PayMongo webhook will hit via
 * confirm_vendor_subscription_by_reference.
 *
 * ── WHAT THIS SCREEN NO LONGER SAYS, AND WHY (2026-08-24) ──────────────────
 * It used to promise that confirming hands the vendor a bundle of the old
 * currency, and to render a per-order pill counting it. (The exact old wording
 * is deliberately NOT reproduced here — a guard bans that phrasing on the RAW
 * source.) The vendor token currency was retired
 * product-wide on 2026-08-07 and the GRANT was taken out of
 * `_apply_subscription_credit` the same day — its live body in production says
 * so in its own words. The sentence outlived the mechanism by seventeen days.
 *
 * 🔑 THE PILL COULD NEVER HAVE RENDERED, AND THAT IS WHY NOBODY NOTICED. It is
 * gated on `addon_token_count > 0`; the only writer of that column reads the
 * pack price from `vendor_billing_catalog WHERE offering_type = 'token_pack'
 * AND is_active = TRUE`, and all six of those rows are inactive. A dead branch
 * over a false sentence: the screen made a claim, and the one thing that could
 * have contradicted it on-screen was unreachable.
 *
 * ⚠ `addon_token_count` and `addon_amount_php` ARE NO LONGER READ HERE — and
 * this page was their ONLY reader in the whole repo. The COLUMNS STAY: their
 * writer (`create_vendor_subscription`) is live and still populates them, so
 * they are unread, not orphaned. Dropping them is a migration and a separate
 * decision.
 */
export default async function AdminSubscriptionsPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;

  // Admin gate — bounce non-admins before any read.
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
    redirect('/dashboard');
  }

  const admin = createAdminClient();

  const COLS =
    'purchase_id, vendor_id, sku_code, tier, billing_cycle, amount_php, reference_code, status, created_at, paid_at, expires_at, rejection_reason';

  // Pending first (the actionable queue), then the 30 most recent resolved.
  const [pendingRes, recentRes] = await Promise.all([
    admin
      .from('vendor_subscriptions')
      .select(COLS)
      .eq('status', 'pending_payment')
      .order('created_at', { ascending: true }),
    admin
      .from('vendor_subscriptions')
      .select(COLS)
      .neq('status', 'pending_payment')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const pending = (pendingRes.data ?? []) as SubscriptionRow[];
  const recent = (recentRes.data ?? []) as SubscriptionRow[];

  // Resolve vendor display names in one query.
  const vendorIds = Array.from(
    new Set([...pending, ...recent].map((p) => p.vendor_id)),
  );
  const nameById = new Map<string, { business_name: string; public_id: string }>();
  if (vendorIds.length > 0) {
    const { data: vendors } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, public_id')
      .in('vendor_profile_id', vendorIds);
    for (const v of vendors ?? []) {
      nameById.set(v.vendor_profile_id, {
        business_name: v.business_name,
        public_id: v.public_id,
      });
    }
  }

  const pendingTotal = pending.reduce((s, p) => s + Number(p.amount_php ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 space-y-2">
        {/* The page starts at its content. 🔒 THE PENDING COUNT IS NOT THE
            PAGE NAME and does not go with it — it is the number of vendors
            waiting on somebody here, so it moves into `actions`.
            ⚖ The sentence survives: it is the procedure (they pay our account
            with the reference code, THEN you confirm here) and it says the
            confirm is idempotent, which is what an operator needs when a
            press looks like it did nothing.
            ⚠ ITS TOKEN PROMISE IS GONE — READ OUT OF PRODUCTION, NOT INFERRED.
            `approve_vendor_subscription` delegates to `_apply_subscription_credit`,
            whose LIVE body carries its own comment dated 2026-08-07: "The token
            bundle and the add-on credit were REMOVED here. Activating a plan now
            activates a plan. Nothing else." It returns `bundle: 0` and
            `addon_tokens: 0` as constants. So this sentence told an operator
            that pressing Confirm hands a vendor tokens, and it has not done
            that since the day the currency was retired. */}
        <PageMasthead
          title="Subscriptions"
          className="mb-2"
          actions={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-orange">
              <Crown aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {pending.length} pending
            </span>
          }
        />
        <p className="max-w-prose text-sm text-ink/70">
          Vendors upgrade to Pro / Enterprise apply-then-pay: they pay our BDO /
          GCash account with the reference code, then you confirm here. Confirming
          activates the plan and nothing else — it is safe to press twice, a
          repeat is a no-op.
          {pending.length > 0 && (
            <>
              {' '}
              <span className="font-medium text-ink">
                ₱{NUMBER.format(pendingTotal)}
              </span>{' '}
              awaiting confirmation.
            </>
          )}
        </p>
      </div>

      {search.done === 'approved' && (
        <div className="mb-6 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
          ✓ Payment confirmed and the plan activated.
        </div>
      )}
      {search.done === 'rejected' && (
        <div className="mb-6 rounded-md border border-warn-200 bg-warn-50 px-4 py-3 text-sm text-warn-900">
          Order marked rejected. No tier change was made.
        </div>
      )}
      {search.error && (
        <div className="mb-6 rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-900">
          {search.error}
        </div>
      )}

      {/* Pending queue */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">
          Awaiting confirmation
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-md border border-ink/10 bg-paper px-4 py-6 text-center text-sm text-ink/55">
            No pending subscription orders. New upgrades show up here the moment a
            vendor starts one.
          </p>
        ) : (
          <ul className="space-y-4">
            {pending.map((p) => {
              const v = nameById.get(p.vendor_id);
              const tier = TIER_LABEL[p.tier] ?? p.tier;
              return (
                <li
                  key={p.purchase_id}
                  className="rounded-lg border border-ink/10 bg-paper p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {v?.business_name ?? 'Unknown vendor'}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink/50">
                        {v?.public_id ?? p.vendor_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">
                        {tier} · {p.billing_cycle ?? '—'} · ₱
                        {NUMBER.format(Number(p.amount_php ?? 0))}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink/50">
                        Started {fmtDate(p.created_at)}
                      </p>
                    </div>
                  </div>

                  <div
                    className="mt-3 flex items-center justify-between gap-2 rounded-md px-3 py-2"
                    style={{ background: 'rgba(45, 48, 56, 0.04)' }}
                  >
                    <span className="text-[10px] uppercase tracking-[0.15em] text-ink/50">
                      Reference
                    </span>
                    <span className="font-mono text-sm font-semibold text-ink">
                      {p.reference_code}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <form action={approveSubscription}>
                      <input type="hidden" name="purchase_id" value={p.purchase_id} />
                      <SubmitButton className="button-primary h-9 px-4 text-sm" pendingLabel="Confirming…">
                        Confirm payment &amp; activate plan
                      </SubmitButton>
                    </form>
                    <form
                      action={rejectSubscription}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="purchase_id" value={p.purchase_id} />
                      <input
                        type="text"
                        name="reason"
                        placeholder="Reason (optional)"
                        className="w-44 rounded-md border border-ink/15 bg-paper px-2 py-1.5 text-xs"
                      />
                      <SubmitButton
                        pendingLabel="Rejecting…"
                        className="rounded-md border border-danger-300 px-3 py-1.5 text-xs font-medium text-danger-700 hover:bg-danger-50"
                      >
                        Reject
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recent resolved */}
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">
          Recently resolved
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-ink/55">Nothing resolved yet.</p>
        ) : (
          <ul className="divide-y divide-ink/10 rounded-md border border-ink/10 bg-paper">
            {recent.map((p) => {
              const v = nameById.get(p.vendor_id);
              const paid = p.status === 'paid';
              const tier = TIER_LABEL[p.tier] ?? p.tier;
              return (
                <li
                  key={p.purchase_id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">
                      {v?.business_name ?? 'Unknown vendor'}
                      <span className="ml-2 font-mono text-[10px] text-ink/40">
                        {p.reference_code}
                      </span>
                    </p>
                    {p.rejection_reason && (
                      <p className="text-[11px] text-ink/50">{p.rejection_reason}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={
                        'rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ' +
                        (paid
                          ? 'bg-success-100 text-success-800'
                          : 'bg-ink/5 text-ink/55')
                      }
                    >
                      {paid ? `${tier} · ${p.billing_cycle ?? '—'}` : p.status}
                    </span>
                    <p className="mt-0.5 text-[11px] text-ink/45">
                      {fmtDate(p.paid_at ?? p.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-ink/40">
        <Link href="/admin/pricing" className="underline hover:text-ink/60">
          Plan pricing
        </Link>
      </p>
    </div>
  );
}
