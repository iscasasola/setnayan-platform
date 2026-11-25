import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Crown } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { Badge } from '@/app/_components/badge';
import { PostedFieldRow } from '@/app/admin/_components/posted-field-row';
import { actionButtonClass } from '@/components/action-button-class';
import {
  TEMPLATE_MONEY,
  TEMPLATE_SUBLINE,
  TemplateEmpty,
  TemplateFail,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';
import { approveSubscription, rejectSubscription } from './actions';

import { requireAdmin } from '@/lib/admin/require-admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { PLAN_PERIOD, planWord } from '@/lib/vendor-plan-change-words';
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
  tier: string;
  billing_cycle: 'monthly' | 'annual' | null;
  amount_php: number | string | null;
  reference_code: string | null;
  // 'refunded' (migration 20271359936839): its money went back and the plan dropped at once — shown by its own word below.
  status: 'pending_payment' | 'paid' | 'rejected' | 'superseded' | 'refunded';
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
  rejection_reason: string | null;
};

const NUMBER = new Intl.NumberFormat('en-PH');

function fmtDate(s: string) {
  return new Date(s).toLocaleString('en-PH', { timeZone: 'Asia/Manila',
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
  const user = await getCurrentUser();
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

  // ── READS ARE HONEST (2026-09-30) ─────────────────────────────────────────
  // A refused read resolves with `{ error }`, not a throw — unbound, it became
  // `[]` and the masthead said "0 pending" to an admin with vendors waiting to
  // be activated. Each list renders "Couldn't load" instead of its empty state.
  const pendingFailed = Boolean(pendingRes.error);
  const recentFailed = Boolean(recentRes.error);
  if (pendingRes.error) logQueryError('admin/subscriptions: pending', pendingRes.error);
  if (recentRes.error) logQueryError('admin/subscriptions: recent', recentRes.error);
  const pending = (pendingRes.data ?? []) as SubscriptionRow[];
  const recent = (recentRes.data ?? []) as SubscriptionRow[];

  // Resolve vendor display names in one query.
  const vendorIds = Array.from(
    new Set([...pending, ...recent].map((p) => p.vendor_id)),
  );
  const nameById = new Map<string, { business_name: string; public_id: string }>();
  // A8·A-21: a refused names read is not an unknown supplier — the row says it could not read the name.
  let namesReadFailed = false;
  if (vendorIds.length > 0) {
    const { data: vendors, error: vendorsErr } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, public_id')
      .in('vendor_profile_id', vendorIds);
    if (vendorsErr) {
      namesReadFailed = true;
      logQueryError('admin/subscriptions.vendorNames', vendorsErr);
    }
    for (const v of vendors ?? []) {
      nameById.set(v.vendor_profile_id, {
        business_name: v.business_name,
        public_id: v.public_id,
      });
    }
  }

  // 🏷 AW-9 (admin walk 14 Nov 2026): the plan's NAME, read from the catalog the supplier bought from
  // (`vendor_billing_catalog.title`, e.g. "Plus (monthly)") — the row's raw `tier · billing_cycle`
  // printed "solo · monthly". Names only; no price is read here. A refused read falls back to words, never a code.
  const skus = Array.from(new Set([...pending, ...recent].map((p) => p.sku_code).filter(Boolean)));
  const planTitle = new Map<string, string>();
  if (skus.length > 0) {
    const { data: plans, error: plansErr } = await admin
      .from('vendor_billing_catalog')
      .select('sku_code, title')
      .in('sku_code', skus);
    if (plansErr) logQueryError('admin/subscriptions: plan names', plansErr);
    for (const pl of (plans ?? []) as { sku_code: string; title: string | null }[]) {
      if (pl.title?.trim()) planTitle.set(pl.sku_code, pl.title.trim());
    }
  }
  const planName = (p: SubscriptionRow): string =>
    planTitle.get(p.sku_code) ??
    `${p.tier === 'solo' || p.tier === 'pro' || p.tier === 'enterprise' ? planWord(p.tier) : 'Supplier plan'}${p.billing_cycle === 'annual' ? ' · yearly' : p.billing_cycle === 'monthly' ? ` · ${PLAN_PERIOD.adjective}` : ''}`;

  const pendingTotal = pending.reduce((s, p) => s + Number(p.amount_php ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2 sm:px-6">
      {/* The page starts at its content. 🔒 THE PENDING COUNT IS NOT THE
          PAGE NAME and does not go with it — it is the number of vendors
          waiting on somebody here, so it moves into `actions`.
          ⚖ The procedure sentence survives behind the ⓘ on "Awaiting confirmation"
          (admin clean port 19 Nov 2026 — words unchanged, moved, not cut).
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
          <Badge tone="wait">
            <Crown aria-hidden className="mr-1 h-3.5 w-3.5" strokeWidth={2} />
            {pendingFailed ? 'Pending unknown' : `${pending.length} pending`}
          </Badge>
        }
      />

      {search.done === 'approved' && (
        <div role="status" className="my-2 border-y py-2.5 text-[14px] text-ink" style={{ borderColor: 'rgb(var(--color-ok))' }}>
          ✓ Payment confirmed and the plan activated.
        </div>
      )}
      {search.done === 'approved_deferred' && (
        <div role="status" className="my-2 border-y py-2.5 text-[14px] text-ink" style={{ borderColor: 'rgb(var(--color-ok))' }}>
          ✓ Payment confirmed. This is a downgrade, so nothing changes yet — the
          new plan starts when the supplier&rsquo;s current plan runs out.
        </div>
      )}
      {search.done === 'rejected' && (
        <div role="status" className="my-2 border-y py-2.5 text-[14px] text-ink" style={{ borderColor: 'rgb(var(--color-warn))' }}>
          Order marked rejected. No tier change was made.
        </div>
      )}
      {search.error && (
        <div role="alert" className="my-2 border-y py-2.5 text-[14px] text-ink" style={{ borderColor: 'rgb(var(--color-danger))' }}>
          {search.error}
        </div>
      )}

      {/* Pending queue */}
      <TemplateSection
        label="Awaiting confirmation"
        first
        data="subscriptions-pending"
        tip={
          <>
            Suppliers upgrade to Pro / Ultra apply-then-pay: they pay our BDO /
            GCash account with the reference code, then you confirm here. Confirming
            activates the plan and nothing else — it is safe to press twice, a
            repeat is a no-op.
          </>
        }
        right={
          pending.length > 0 ? (
            <>
              <span className={TEMPLATE_MONEY}>
                ₱{NUMBER.format(pendingTotal)}
              </span>{' '}
              awaiting confirmation.
            </>
          ) : undefined
        }
      >
        {pendingFailed ? (
          <TemplateFail retryHref="/admin/payments?view=subscriptions" data="subscriptions-pending">
            Couldn&rsquo;t load this — refresh to try again. This is not an empty queue.
          </TemplateFail>
        ) : pending.length === 0 ? (
          <TemplateEmpty data="subscriptions-pending">
            No pending subscription orders. New upgrades show up here the moment a
            supplier starts one.
          </TemplateEmpty>
        ) : (
          <TemplateRows label="Awaiting confirmation">
            {pending.map((p) => {
              const v = nameById.get(p.vendor_id);
              const tier = planName(p);
              return (
                <li key={p.purchase_id} className="py-3" data-template-row="subscription">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <b className="block truncate text-[15px] font-semibold leading-tight text-ink">
                        {v?.business_name ?? (namesReadFailed ? 'Couldn’t read the supplier' : 'Unknown supplier')}
                      </b>
                      <span className={`mt-0.5 block truncate ${TEMPLATE_SUBLINE}`}>
                        {v?.public_id ?? p.vendor_id}
                      </span>
                    </div>
                    <div className="text-right">
                      <b className={`block text-[15px] ${TEMPLATE_MONEY}`}>
                        {tier} · ₱
                        {NUMBER.format(Number(p.amount_php ?? 0))}
                      </b>
                      <span className={`mt-0.5 block ${TEMPLATE_SUBLINE}`}>
                        Started {fmtDate(p.created_at)}
                      </span>
                    </div>
                  </div>

                  <p className={`mt-2 flex items-center justify-between gap-2 ${TEMPLATE_SUBLINE}`}>
                    <span>Reference</span>
                    <span className="text-[14px] font-semibold tabular-nums text-ink">
                      {p.reference_code}
                    </span>
                  </p>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <form action={approveSubscription}>
                      <input type="hidden" name="purchase_id" value={p.purchase_id} />
                      <SubmitButton className={actionButtonClass('ok', { main: true })} pendingLabel="Confirming…">
                        Confirm payment &amp; activate plan
                      </SubmitButton>
                    </form>
                    <form
                      action={rejectSubscription}
                      className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm"
                    >
                      <input type="hidden" name="purchase_id" value={p.purchase_id} />
                      <div className="min-w-0 flex-1">
                        {/* The house typed row, posted with the form under the same name (`reason`). */}
                        <PostedFieldRow name="Reason (optional)" fieldName="reason" />
                      </div>
                      <SubmitButton
                        pendingLabel="Rejecting…"
                        className={actionButtonClass('danger')}
                      >
                        Reject
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </TemplateRows>
        )}
      </TemplateSection>

      {/* Recent resolved */}
      <TemplateSection label="Recently resolved" data="subscriptions-recent">
        {recentFailed ? (
          <TemplateFail retryHref="/admin/payments?view=subscriptions" data="subscriptions-recent">
            Couldn&rsquo;t load this — refresh to try again.
          </TemplateFail>
        ) : recent.length === 0 ? (
          <TemplateEmpty data="subscriptions-recent">Nothing resolved yet.</TemplateEmpty>
        ) : (
          <TemplateRows label="Recently resolved">
            {recent.map((p) => {
              const v = nameById.get(p.vendor_id);
              const paid = p.status === 'paid';
              const tier = planName(p);
              return (
                <TemplateRow
                  key={p.purchase_id}
                  data="subscription-resolved"
                  title={v?.business_name ?? (namesReadFailed ? 'Couldn’t read the supplier' : 'Unknown supplier')}
                  line={[p.reference_code, p.rejection_reason, fmtDate(p.paid_at ?? p.created_at)].filter(Boolean).join(' · ')}
                  right={
                    <Badge tone={paid ? 'ok' : 'quiet'}>
                      {paid ? tier : String(p.status).replace(/_/g, ' ')}
                    </Badge>
                  }
                />
              );
            })}
          </TemplateRows>
        )}
      </TemplateSection>

      <p className={`mt-8 text-center ${TEMPLATE_SUBLINE}`}>
        <Link href="/admin/pricing" className="underline hover:text-ink">
          Plan pricing
        </Link>
      </p>
    </div>
  );
}
