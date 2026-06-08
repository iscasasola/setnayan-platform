import Link from 'next/link';
import { Activity, ArrowRight, Building, CreditCard, Music } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { FileUpload } from '@/app/_components/file-upload';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { saveBusinessIdentity, updateOnboardingMusic } from './actions';
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

  // Onboarding background music — resolve the stored r2:// ref to a display URL
  // so the uploader can show the current track (owner 2026-06-08).
  const musicRef =
    typeof settings.onboarding_bg_music_r2_key === 'string' &&
    settings.onboarding_bg_music_r2_key.startsWith('r2://')
      ? settings.onboarding_bg_music_r2_key
      : null;
  const musicUrl = musicRef ? await displayUrlForStoredAsset(musicRef) : null;
  const musicDisplay: Record<string, string> = {};
  if (musicRef && musicUrl) musicDisplay[musicRef] = musicUrl;
  const musicEnabled = settings.onboarding_bg_music_enabled === true;

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

      <div className="mt-10 space-y-4 border-t border-ink/10 pt-8">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Onboarding background music
            </h2>
          </div>
          <p className="text-sm text-ink/60">
            A soft, low-volume soundtrack that plays while couples go through the
            wedding onboarding at <code className="rounded bg-ink/5 px-1 py-0.5 font-mono">/onboarding/wedding</code>.
            It never blasts on — it starts quietly on the first tap and each
            couple can mute it. Upload an <strong>owned / AI-generated</strong>{' '}
            track only (e.g. your Suno instrumental) — Setnayan serves the file,
            so it must be music you own the rights to. Leave empty for no music.
          </p>
        </header>

        <form action={updateOnboardingMusic} className="space-y-3 rounded-2xl border border-ink/10 bg-cream/40 p-5">
          <FileUpload
            bucket="media"
            pathPrefix="onboarding/background-music"
            name="bg_music_url"
            multiple={false}
            maxSizeMB={40}
            acceptedTypes={['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav']}
            currentValue={musicRef}
            initialDisplayUrls={musicDisplay}
            variant="wide"
            label="Music file"
            help="MP3, M4A, AAC, OGG, or WAV. Up to 40 MB (a ~30-min instrumental fits). A seamless loop also works."
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="onboarding_bg_music_enabled"
              defaultChecked={musicEnabled}
              className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
            />
            Play background music during onboarding
          </label>
          <SubmitButton className="button-primary inline-flex items-center gap-2" pendingLabel="Saving…">
            Save onboarding music
          </SubmitButton>
        </form>
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
