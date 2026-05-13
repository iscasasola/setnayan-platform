import { Building, Wallet, Smartphone } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { savePlatformSettings } from './actions';

export const metadata = { title: 'Settings · Admin' };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminSettingsPage({ searchParams }: Props) {
  const search = await searchParams;
  const admin = createAdminClient();
  const settings = await fetchPlatformSettings(admin);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Platform settings</h1>
        <p className="text-sm text-ink/60">
          Business identity (printed on every Official Receipt) and merchant payment info
          (rendered on order detail + receipts). Everything here is read-everywhere across
          the app; only internal/team-pool admins can edit.
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

      <form action={savePlatformSettings} className="space-y-8">
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Business identity (BIR §113)
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
            help="Format: 000-000-000-000. Shown on every Official Receipt."
          >
            <input
              id="business_tin"
              name="business_tin"
              defaultValue={settings.business_tin ?? ''}
              placeholder="000-000-000-000"
              className="input-field font-mono"
            />
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
          <Field
            label="QR image URL"
            htmlFor="bdo_qr_url"
            help="Hosted PNG/SVG of your BDO merchant QR. File upload to R2 ships later — paste a URL for now."
          >
            <input
              id="bdo_qr_url"
              name="bdo_qr_url"
              type="url"
              defaultValue={settings.bdo_qr_url ?? ''}
              placeholder="https://…"
              className="input-field"
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
          <Field label="QR image URL" htmlFor="gcash_qr_url">
            <input
              id="gcash_qr_url"
              name="gcash_qr_url"
              type="url"
              defaultValue={settings.gcash_qr_url ?? ''}
              placeholder="https://…"
              className="input-field"
            />
          </Field>
        </section>

        <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
            Last updated{' '}
            {new Date(settings.updated_at).toLocaleString()}
          </p>
          <button type="submit" className="button-primary">
            Save settings
          </button>
        </div>
      </form>
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
