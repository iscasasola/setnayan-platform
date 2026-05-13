import { Building, Wallet, Smartphone, Trash2, Upload } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import {
  removeMerchantQr,
  savePlatformSettings,
  uploadMerchantQr,
} from './actions';

export const metadata = { title: 'Settings · Admin' };

type Props = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    qr_uploaded?: string;
    qr_removed?: string;
  }>;
};

export default async function AdminSettingsPage({ searchParams }: Props) {
  const search = await searchParams;
  const admin = createAdminClient();
  const settings = await fetchPlatformSettings(admin);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Platform settings</h1>
        <p className="text-sm text-ink/60">
          Business identity (printed on every app transaction receipt) and merchant payment
          info (rendered on order detail + receipts). Everything here is read-everywhere
          across the app; only internal/team-pool admins can edit. The actual BIR Official
          Receipt for a paid order is issued separately, offline &mdash; these are not BIR
          ORs.
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
      {search.qr_uploaded ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          QR code uploaded. It now shows on order detail pages for couples.
        </p>
      ) : null}
      {search.qr_removed ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/80"
        >
          QR code removed.
        </p>
      ) : null}

      <form action={savePlatformSettings} className="space-y-8">
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
            help="Format: 000-000-000-000. Shown on every transaction receipt."
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
            Save settings
          </SubmitButton>
        </div>
      </form>

      <div className="mt-10 space-y-6 border-t border-ink/10 pt-8">
        <header className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Merchant QR codes
          </h2>
          <p className="text-sm text-ink/60">
            Upload PNG/JPEG images (≤ 5 MB) of your merchant QR codes.
            They appear on every couple&rsquo;s order detail page next to the
            payment instructions.
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
                className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
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

      <form
        action={uploadMerchantQr}
        encType="multipart/form-data"
        className="flex flex-col gap-2 border-t border-ink/10 pt-3 sm:flex-row sm:items-center"
      >
        <input type="hidden" name="kind" value={kind} />
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          required
          className="flex-1 cursor-pointer rounded-md border border-ink/15 bg-cream p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-terracotta/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-terracotta-700 hover:file:bg-terracotta/15"
        />
        <SubmitButton
          className="inline-flex items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta-600 disabled:opacity-70"
          pendingLabel="Uploading…"
        >
          <Upload aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {currentUrl ? 'Replace' : 'Upload'}
        </SubmitButton>
      </form>
    </section>
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
