import Link from 'next/link';
import { Activity, ArrowRight, Building, CreditCard, Music } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { saveBusinessIdentity } from './actions';
import { TinInput } from './_components/tin-input';
import { SentrySmokeTestButton } from './_components/sentry-smoke-test-button';

export const metadata = { title: 'Settings · Admin' };

type Props = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
};

/**
 * Platform settings · business identity + system health (V2).
 *
 * 2026-05-29 restructure: BDO/GCash account fields + Merchant QR codes used
 * to live here too. They moved to `/admin/settings/payment-methods` per
 * owner directive ("shouldn't this be at payment methods?") because they're
 * payment configuration, not business identity. Couples reference those
 * rails when transferring for an order; business identity is what's printed
 * on every transaction receipt. Two distinct concerns, two surfaces.
 *
 * What stays here: business name, TIN, address, email, default VAT rate
 * (all values printed on transaction receipts) + the Sentry prod smoke test
 * button under System health (owner-only one-shot diagnostic).
 *
 * What moved: BDO + GCash account info + QR uploads + remove actions.
 * The "Manage payment methods →" link card below carries hosts to the
 * canonical home for those fields.
 */
export default async function AdminSettingsPage({ searchParams }: Props) {
  const search = await searchParams;
  const admin = createAdminClient();
  const settings = await fetchPlatformSettings(admin);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Platform settings</h1>
        <p className="text-sm text-ink/60">
          Business identity printed on every transaction receipt. Everything
          here is read-everywhere across the app; only internal/team-pool
          admins can edit. The actual BIR Official Receipt for a paid order
          is issued separately, offline &mdash; these are not BIR ORs.
        </p>
      </header>

      {search.error ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {decodeURIComponent(search.error)}
        </p>
      ) : null}
      {search.saved ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Settings saved. Live changes propagate to all surfaces immediately.
        </p>
      ) : null}

      <form action={saveBusinessIdentity} className="space-y-8">
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Business identity
            </h2>
          </div>
          <Field label="Business name" htmlFor="business_name">
            <input
              id="business_name"
              name="business_name"
              required
              defaultValue={settings.business_name}
              className="input-field"
            />
          </Field>
          <Field
            label="Tax Identification Number (TIN)"
            htmlFor="business_tin"
            help="Format: 000-000-000-000. Shown on every transaction receipt. Dashes are inserted automatically as you type."
          >
            <TinInput defaultValue={settings.business_tin ?? ''} />
          </Field>
          <Field label="Business address" htmlFor="business_address">
            <textarea
              id="business_address"
              name="business_address"
              rows={3}
              defaultValue={settings.business_address ?? ''}
              placeholder="Suite 123, ABC Building, Quezon City"
              className="input-field min-h-[80px] py-2"
            />
          </Field>
          <Field label="Business email" htmlFor="business_email">
            <input
              id="business_email"
              name="business_email"
              type="email"
              defaultValue={settings.business_email ?? ''}
              placeholder="hello@setnayan.com"
              className="input-field"
            />
          </Field>
          <Field
            label="Default VAT rate (%)"
            htmlFor="default_vat_rate_pct"
            help="PH standard is 12%. Receipts already issued won't be re-rated."
          >
            <input
              id="default_vat_rate_pct"
              name="default_vat_rate_pct"
              type="number"
              min={0}
              max={100}
              step="0.01"
              required
              defaultValue={settings.default_vat_rate_pct}
              className="input-field"
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
            Save business identity
          </SubmitButton>
        </div>
      </form>

      {/* Onboarding settings moved to their own type-organized surface
          (/admin/onboarding) 2026-06-09 — background music + future onboarding
          knobs live there, grouped by onboarding type. */}
      <div className="mt-10 border-t border-ink/10 pt-8">
        <Link
          href="/admin/onboarding"
          className="group block rounded-xl border border-ink/10 bg-cream p-5 hover:border-terracotta/30 hover:bg-terracotta/5"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-terracotta/10 text-terracotta">
              <Music className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">Onboarding</h3>
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 text-ink/40 transition group-hover:translate-x-0.5 group-hover:text-terracotta"
                  strokeWidth={1.75}
                />
              </div>
              <p className="mt-1 text-sm text-ink/60">
                Settings for the new-account onboarding flows — background music
                and future per-flow knobs, grouped by onboarding type. (Moved
                here from this page.)
              </p>
            </div>
          </div>
        </Link>
      </div>

      <div className="mt-10 border-t border-ink/10 pt-8">
        <Link
          href="/admin/settings/payment-methods"
          className="group block rounded-xl border border-ink/10 bg-cream p-5 hover:border-terracotta/30 hover:bg-terracotta/5"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-terracotta/10 text-terracotta">
              <CreditCard className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">Payment methods</h3>
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 text-ink/40 transition group-hover:translate-x-0.5 group-hover:text-terracotta"
                  strokeWidth={1.75}
                />
              </div>
              <p className="mt-1 text-sm text-ink/60">
                BDO and GCash account details + QR codes the app shows to
                couples on order detail pages.
              </p>
            </div>
          </div>
        </Link>
      </div>

      <div className="mt-10 space-y-4 border-t border-ink/10 pt-8">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              System health
            </h2>
          </div>
          <p className="text-sm text-ink/60">
            Verify production observability is wired and routing alerts correctly.
            One-shot owner actions — no background sweeps. Punch-list item #19e
            (Sentry prod smoke test).
          </p>
        </header>

        <section className="rounded-xl border border-ink/10 bg-cream p-5">
          <h3 className="text-sm font-semibold text-ink">Sentry prod smoke test</h3>
          <p className="mt-1 text-xs text-ink/60">
            Triggers a controlled error tagged{' '}
            <code className="rounded bg-ink/5 px-1 py-0.5 font-mono">source=manual-smoke-test</code>
            {' '}so it&rsquo;s easy to find in the Sentry dashboard. POST-only — the
            endpoint cannot be triggered by URL paste or preview-deploy crawlers.
          </p>
          <div className="mt-4">
            <SentrySmokeTestButton />
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="block text-sm font-medium text-ink">{label}</span>
      {children}
      {help ? <span className="block text-xs text-ink/55">{help}</span> : null}
    </label>
  );
}
