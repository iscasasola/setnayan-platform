import Link from 'next/link';
import { ArrowLeft, CreditCard, Smartphone, Trash2, Wallet } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SubmitButton } from '@/app/_components/submit-button';
import { Field } from '@/app/_components/forms/field';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { QrUploadForm } from '../_components/qr-upload-form';
import { removeMerchantQr, savePaymentInstruments } from '../actions';

export const metadata = { title: 'Payment methods · Admin' };

type PaymentMethodRow = {
  method_code: string;
  display_name: string;
  gateway_fee_pct: number;
  setnayan_pay_pct: number;
  // Minimum convenience-fee floor in centavos. Added by migration
  // 20260608000000 per CLAUDE.md decision-log 2026-05-17 ninth row to
  // ensure sub-₱1,000 bookings still clear Setnayan's per-transaction
  // operating cost. Nullable in the read shape only because pre-migration
  // envs would return NULL; post-migration every row carries 5000 (₱50)
  // by default. We coalesce in the cell render so a NULL doesn't break
  // the table layout.
  min_fee_centavos: number | null;
  is_active: boolean;
  display_order: number;
  effective_at: string;
  updated_at: string;
};

type Props = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    qr_uploaded?: string;
    qr_removed?: string;
  }>;
};

/**
 * Canonical home for V2 payment instruments + retired Setnayan Pay history.
 *
 * 2026-05-29 restructure (per owner directive "shouldn't this be at payment
 * methods?"): merchant payment configuration (BDO + GCash account info + QR
 * codes) lives here instead of `/admin/settings`. Reasoning:
 *
 * 1. Couples reference these rails when transferring for an order — the
 *    fields are payment configuration, not business identity.
 * 2. Conceptually, the page name "Payment methods" already promises these
 *    fields. Hiding them on the parent settings page was a discoverability
 *    bug owner caught during pre-pilot review.
 * 3. Single source-of-truth means QR upload + account info edits flow
 *    through one surface, reducing the chance of admin editing the BDO
 *    number on one page while uploading the BDO QR on another.
 *
 * Below the active V2 form, the legacy `setnayan_pay_methods` table renders
 * as a read-only historical audit (retired 2026-05-28 V2 cutover per
 * CLAUDE.md V1→V2 cutover decision-log rows).
 */
export default async function PaymentMethodsAdminPage({ searchParams }: Props) {
  const search = await searchParams;
  const admin = createAdminClient();
  const settings = await fetchPlatformSettings(admin);
  const { data, error } = await admin
    .from('setnayan_pay_methods')
    .select(
      'method_code,display_name,gateway_fee_pct,setnayan_pay_pct,min_fee_centavos,is_active,display_order,effective_at,updated_at',
    )
    .order('display_order', { ascending: true });

  // Full error → Vercel Functions log + Sentry (with call_site pivot) per
  // the canonical pattern in lib/supabase/error-detect.ts. Brand-voice copy
  // surfaces to the admin per [[feedback_setnayan_no_dev_text_post_launch]]
  // — pre-pilot audit cleanup 2026-05-30.
  if (error) {
    logQueryError('AdminPaymentMethodsPage (setnayan_pay_methods)', error);
  }

  const rows = ((data ?? []) as PaymentMethodRow[]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/admin/settings"
        className="mb-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to settings
      </Link>

      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">Payment methods</h1>
        </div>
        <p className="text-sm text-ink/65">
          BDO and GCash account details + QR codes the app shows to couples on
          order detail pages so they can transfer. Edits propagate everywhere
          immediately — order pages, receipts, and confirmation emails read
          from the same row.
        </p>
      </header>

      {search.error ? (
        <FormFlash tone="error">
          {decodeURIComponent(search.error)}
        </FormFlash>
      ) : null}
      {search.saved ? (
        <FormFlash tone="success">
          Payment details saved. Live changes show on every order detail page.
        </FormFlash>
      ) : null}
      {search.qr_uploaded ? (
        <FormFlash tone="success">
          QR code uploaded. It now shows on order detail pages for couples.
        </FormFlash>
      ) : null}
      {search.qr_removed ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/80"
        >
          QR code removed.
        </p>
      ) : null}

      <form action={savePaymentInstruments} className="space-y-8">
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              BDO bank transfer
            </h2>
          </div>
          <Field label="Account name" htmlFor="bdo_account_name">
            <input
              id="bdo_account_name"
              name="bdo_account_name"
              defaultValue={settings.bdo_account_name ?? ''}
              className="input-field"
            />
          </Field>
          <Field label="Account number" htmlFor="bdo_account_number">
            <input
              id="bdo_account_number"
              name="bdo_account_number"
              defaultValue={settings.bdo_account_number ?? ''}
              placeholder="000-000-000-000"
              className="input-field font-mono"
            />
          </Field>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              GCash
            </h2>
          </div>
          <Field label="Account name" htmlFor="gcash_account_name">
            <input
              id="gcash_account_name"
              name="gcash_account_name"
              defaultValue={settings.gcash_account_name ?? ''}
              className="input-field"
            />
          </Field>
          <Field label="GCash number" htmlFor="gcash_number">
            <input
              id="gcash_number"
              name="gcash_number"
              defaultValue={settings.gcash_number ?? ''}
              placeholder="+63 917 …"
              className="input-field font-mono"
            />
          </Field>
        </section>

        <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
            Last updated{' '}
            {new Date(settings.updated_at).toLocaleString()}
          </p>
          <SubmitButton
            className="button-primary inline-flex items-center gap-2"
            pendingLabel="Saving…"
          >
            Save payment details
          </SubmitButton>
        </div>
      </form>

      <div className="mt-10 space-y-6 border-t border-ink/10 pt-8">
        <header className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Merchant QR codes
          </h2>
          <p className="text-sm text-ink/60">
            Upload a photo or screenshot of your merchant QR code (PNG, JPEG,
            WebP, GIF, or HEIC, ≤ 6 MB). We&rsquo;ll auto-detect the QR and crop
            it to a 512×512 square before saving so it renders clean on every
            couple&rsquo;s order detail page.
          </p>
        </header>

        <QrUploadBlock
          kind="bdo"
          label="BDO QR code"
          currentUrl={settings.bdo_qr_url}
        />
        <QrUploadBlock
          kind="gcash"
          label="GCash QR code"
          currentUrl={settings.gcash_qr_url}
        />
      </div>

      <div className="mt-12 space-y-3 border-t border-ink/10 pt-8">
        <header className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Historical · Legacy Setnayan Pay methods
          </h2>
          <p className="text-sm text-ink/60">
            Read-only configuration that ran during the V1 launch period —
            gateway fee, Setnayan Pay platform fee, and minimum-floor per rail.
          </p>
          <p className="rounded-md border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
            <span className="font-semibold">Retired 2026-05-28 V2 cutover —
            read-only historical view.</span> Setnayan Pay is no longer the
            checkout rail. Setnayan is now a software publisher — customer SKUs
            sell at sticker price with no convenience fee, and vendor bookings
            settle directly off-platform with 0% commission. The rows below stay
            for audit only; new V2 orders don&apos;t consult this table.
          </p>
        </header>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
          >
            Payment methods couldn&apos;t load right now. We&apos;ve logged the
            issue — refresh in a moment or check Sentry for the full detail.
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink/15 bg-cream p-3 text-sm text-ink/55">
            No historical Setnayan Pay rows recorded. (V2 doesn&apos;t write to
            this table; this is expected on fresh environments.)
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-cream">
            <table className="min-w-full divide-y divide-ink/10 text-sm">
              <thead className="bg-ink/5">
                <tr>
                  <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Method
                  </th>
                  <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Gateway fee
                  </th>
                  <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Setnayan Pay
                  </th>
                  <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Min fee
                  </th>
                  <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Total
                  </th>
                  <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {rows.map((m) => {
                  const gatewayPct = Number(m.gateway_fee_pct) * 100;
                  const setnayanPct = Number(m.setnayan_pay_pct) * 100;
                  const totalPct = gatewayPct + setnayanPct;
                  // Coalesce a NULL (pre-migration env) to the canonical ₱50
                  // floor for display — keeps the cell stable across mixed
                  // migration states. Post-migration every row carries 5000
                  // by default.
                  const minFeeCentavos = m.min_fee_centavos ?? 5000;
                  const minFeePhp = Math.round(minFeeCentavos / 100);
                  return (
                    <tr key={m.method_code} className={m.is_active ? '' : 'opacity-50'}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-ink">{m.display_name}</div>
                        <div className="font-mono text-[11px] text-ink/55">
                          {m.method_code}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {gatewayPct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {setnayanPct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        ₱{minFeePhp.toLocaleString('en-PH')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        {totalPct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {m.is_active ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-ink/10 px-2 py-0.5 font-medium text-ink/55">
                            Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          Source · spec corpus 2026-05-16 (a0fa3c7) · flat 5.0% lock 2026-05-16
          row 16 · ₱50 min-fee floor 2026-05-17 row 9 · table{' '}
          <code>setnayan_pay_methods</code> · retired 2026-05-28 V2 cutover
          (historical audit only).
        </p>
      </div>
    </div>
  );
}

function QrUploadBlock({
  kind,
  label,
  currentUrl,
}: {
  kind: 'bdo' | 'gcash';
  label: string;
  currentUrl: string | null;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-ink/10 bg-cream p-5">
      <h3 className="text-sm font-semibold text-ink">{label}</h3>

      {currentUrl ? (
        <div className="flex flex-wrap items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt={`${label} preview`}
            className="h-40 w-40 rounded-md border border-ink/15 bg-cream object-contain"
          />
          <div className="flex-1 space-y-2 text-sm text-ink/65">
            <p>Currently shown to couples on order detail pages.</p>
            <form action={removeMerchantQr}>
              <input type="hidden" name="kind" value={kind} />
              <SubmitButton
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                pendingLabel="Removing…"
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Remove
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-ink/15 bg-cream p-3 text-xs text-ink/55">
          No {label} uploaded yet. Couples will see only account name +
          number on order detail pages.
        </p>
      )}

      <QrUploadForm kind={kind} replace={!!currentUrl} />
    </section>
  );
}
