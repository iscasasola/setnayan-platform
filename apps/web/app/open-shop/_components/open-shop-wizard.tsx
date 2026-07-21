'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Globe, Store } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import { OPEN_SHOP_ERRORS, isValidOpenShopEmail } from '@/lib/open-shop-validation';
import { FileUpload } from '@/app/_components/file-upload';
import { SERVICE_GROUPS, VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { becomeVendor } from '../actions';

/**
 * The vendor onboarding wizard (owner 2026-07-03: "we just need the basic";
 * 2026-07-05 owner-required basics folded in — logo + company email are now
 * collected here, not deferred to My Shop). Two compact steps, one
 * always-mounted form (inputs persist across steps, one submit at the end):
 *
 *   1 · Your shop         — shop name · logo · primary service (pick 1)
 *   2 · How couples reach you — owner name · contact number · company email
 *                              (all required) · location (optional)
 *
 * Everything else (website, social links, exact HQ pin, EST, portfolio,
 * documents) continues on My Shop — the profile checklist + Get-verified
 * journey are the rest of the onboarding (owner 2026-07-05: keep onboarding to
 * the six basics + location; website + social move to the dashboard). The logo
 * upload reuses the shared <FileUpload> → R2 pattern from My Shop; the
 * primary-service labels come from the admin taxonomy (serviceLabels), falling
 * back to the in-code names.
 */
export function OpenShopWizard({
  mode,
  serviceLabels,
  vendorProfileId,
  logoDisplayMap,
  defaults,
  error,
  initialStep = 1,
}: {
  /** 'create' = no shop yet · 'complete' = shop exists but was never named. */
  mode: 'create' | 'complete';
  serviceLabels?: Record<string, string>;
  /** Owned shop id (null before the row exists) — scopes the logo R2 prefix. */
  vendorProfileId?: string | null;
  /** r2Ref → 24h display URL, so an already-uploaded logo paints on load. */
  logoDisplayMap?: Record<string, string>;
  defaults: {
    shopName: string;
    logoUrl: string;
    primaryService: string;
    locationCity: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
  };
  error?: string;
  /** From `?step=` — the server sends `&step=2` when it rejects a step-2 field,
   *  so the wizard resumes there instead of discarding those values. */
  initialStep?: 1 | 2;
}) {
  // Seeded from the `?step=` param so a SERVER rejection of a step-2 field
  // re-renders at step 2 instead of dumping the vendor back to step 1 with
  // their three step-2 values gone.
  const [step, setStep] = useState<1 | 2>(initialStep === 2 ? 2 : 1);
  const [shopName, setShopName] = useState(defaults.shopName);
  const [logoUrl, setLogoUrl] = useState(defaults.logoUrl);
  const [service, setService] = useState(defaults.primaryService);
  const [stepError, setStepError] = useState<string | null>(null);

  const next = () => {
    if (!shopName.trim()) {
      setStepError(OPEN_SHOP_ERRORS.shopName);
      return;
    }
    if (!logoUrl.trim()) {
      setStepError(OPEN_SHOP_ERRORS.logo);
      return;
    }
    if (!service) {
      setStepError(OPEN_SHOP_ERRORS.service);
      return;
    }
    setStepError(null);
    setStep(2);
  };

  /**
   * Step 2 had NO client validation while the server rejected three of its
   * fields — so a blank phone or `juan@gmail` round-tripped to the server and
   * came back as a step-1 remount with everything retyped. This mirrors next()
   * using the SHARED strings + regex, so the two layers cannot disagree.
   * The server remains authoritative; this only stops the pointless round trip.
   */
  const submitGate = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const read = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
    if (!read('contact_name').trim()) {
      setStepError(OPEN_SHOP_ERRORS.contactName);
      e.preventDefault();
      return;
    }
    if (!read('contact_phone').trim()) {
      setStepError(OPEN_SHOP_ERRORS.contactPhone);
      e.preventDefault();
      return;
    }
    if (!isValidOpenShopEmail(read('contact_email'))) {
      setStepError(OPEN_SHOP_ERRORS.contactEmail);
      e.preventDefault();
      return;
    }
    if (!read('location_city').trim()) {
      setStepError(OPEN_SHOP_ERRORS.locationCity);
      e.preventDefault();
      return;
    }
    setStepError(null);
  };

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-lg rounded-2xl border p-7"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <span
            aria-hidden
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
          >
            <Store className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate-3)' }}>
            Step {step} of 2
          </span>
        </div>

        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--m-ink)' }}>
          {step === 1 ? 'Open your shop on Setnayan' : 'How couples reach you'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--m-slate)' }}>
          {step === 1
            ? 'This takes about a minute — just the basics, free during launch.'
            : 'A name, number, and email couples can trust — plus where you already live online.'}
        </p>

        {(error || stepError) && (
          <p
            className="mt-4 rounded-lg border p-3 text-xs"
            style={{ borderColor: 'var(--m-orange-3)', background: 'var(--m-orange-4)', color: 'var(--m-ink)' }}
            role="alert"
          >
            {stepError ?? error}
          </p>
        )}

        <form action={becomeVendor} onSubmit={submitGate} className="mt-5 space-y-4">
          {/* Step 1 — always mounted so values survive step switches. */}
          <div className={step === 1 ? 'space-y-4' : 'hidden'}>
            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Shop name<span className="ml-1 text-terracotta">*</span>
              </span>
              <input
                name="shop_name"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                maxLength={128}
                placeholder="Your studio / company name"
                className="input-field"
                autoFocus
              />
            </label>

            <div className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Shop logo<span className="ml-1 text-terracotta">*</span>
              </span>
              <FileUpload
                bucket="media"
                pathPrefix={`vendors/${vendorProfileId ?? 'unassigned'}/logo`}
                name="logo_url"
                currentValue={logoUrl || null}
                initialDisplayUrls={logoDisplayMap ?? {}}
                onChange={(v) =>
                  setLogoUrl(Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))
                }
                maxSizeMB={10}
                compressImage
                acceptedTypes={[
                  'image/png',
                  'image/jpeg',
                  'image/webp',
                  'image/heic',
                  'image/heif',
                ]}
                variant="square"
                qrGuard
              />
              <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
                PNG, JPEG, or WebP up to 2&nbsp;MB. Couples see this on every vendor card.
              </span>
            </div>

            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Primary service<span className="ml-1 text-terracotta">*</span>
              </span>
              <select
                name="primary_service"
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="input-field"
              >
                <option value="" disabled>
                  Pick the one thing you&rsquo;re known for
                </option>
                {SERVICE_GROUPS.map((g) => (
                  <optgroup key={g.key} label={g.label}>
                    {g.members.map((m) => (
                      <option key={m} value={m}>
                        {serviceLabels?.[m] ?? VENDOR_CATEGORY_LABEL[m]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
                Just one for now — add the rest from My Shop.
              </span>
            </label>

            <button
              type="button"
              onClick={next}
              className="button-primary inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm"
            >
              Continue
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>

          {/* Step 2 */}
          <div className={step === 2 ? 'space-y-4' : 'hidden'}>
            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Owner name<span className="ml-1 text-terracotta">*</span>
              </span>
              <input
                name="contact_name"
                defaultValue={defaults.contactName}
                maxLength={128}
                placeholder="Owner / representative full name"
                className="input-field"
              />
            </label>

            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Contact number<span className="ml-1 text-terracotta">*</span>
              </span>
              <input
                name="contact_phone"
                type="tel"
                inputMode="tel"
                defaultValue={defaults.contactPhone}
                maxLength={32}
                placeholder="+63 917 …"
                className="input-field"
              />
            </label>

            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Company email<span className="ml-1 text-terracotta">*</span>
              </span>
              <input
                name="contact_email"
                type="email"
                defaultValue={defaults.contactEmail}
                maxLength={254}
                placeholder="hello@yourstudio.ph"
                className="input-field"
              />
            </label>

            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Location
              </span>
              <input
                name="location_city"
                defaultValue={defaults.locationCity}
                maxLength={64}
                placeholder="Quezon City"
                className="input-field"
              />
            </label>

            <p
              className="rounded-lg border p-3 text-xs"
              style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)', color: 'var(--m-slate)' }}
            >
              You can upgrade your business further anytime — add your website, social links,
              photos, services and pricing from your dashboard.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium text-ink/60 hover:bg-ink/5"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Back
              </button>
              <SubmitButton
                className="button-primary flex-1 justify-center py-2.5 text-sm"
                pendingLabel="Opening your shop…"
              >
                {mode === 'create' ? 'Open my shop — free' : 'Save and continue'}
              </SubmitButton>
            </div>
          </div>
        </form>

        <p className="mt-4 text-center text-xs" style={{ color: 'var(--m-slate-3)' }}>
          <Link href="/vendors" className="inline-flex items-center gap-1 font-medium text-terracotta hover:underline">
            <Globe className="h-3 w-3" strokeWidth={2} aria-hidden />
            See what vendors get
          </Link>
        </p>
      </div>
    </main>
  );
}
