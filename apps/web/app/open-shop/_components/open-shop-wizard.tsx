'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Globe, Store } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import { SERVICE_GROUPS, VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { becomeVendor } from '../actions';

/**
 * The vendor onboarding wizard (owner 2026-07-03: "we just need the basic").
 * Two compact steps, one always-mounted form (inputs persist across steps, one
 * submit at the end):
 *
 *   1 · Your shop         — shop name · primary service (pick 1) · location
 *   2 · How couples reach you — contact name · contact number · website ·
 *                              social media link
 *
 * Everything else (logo, email, exact HQ pin, EST, documents) continues on My
 * Shop — the profile checklist + Get-verified journey are the rest of the
 * onboarding. The primary-service labels come from the admin taxonomy
 * (serviceLabels), falling back to the in-code names.
 */
export function OpenShopWizard({
  mode,
  serviceLabels,
  defaults,
  error,
}: {
  /** 'create' = no shop yet · 'complete' = shop exists but was never named. */
  mode: 'create' | 'complete';
  serviceLabels?: Record<string, string>;
  defaults: {
    shopName: string;
    primaryService: string;
    locationCity: string;
    contactName: string;
    contactPhone: string;
    website: string;
  };
  error?: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [shopName, setShopName] = useState(defaults.shopName);
  const [service, setService] = useState(defaults.primaryService);
  const [stepError, setStepError] = useState<string | null>(null);

  const next = () => {
    if (!shopName.trim()) {
      setStepError('Give your shop a name.');
      return;
    }
    if (!service) {
      setStepError('Pick your primary service.');
      return;
    }
    setStepError(null);
    setStep(2);
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
            ? 'The basics first — free during launch. You can refine everything later.'
            : 'A name and number couples can trust, plus where you already live online.'}
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

        <form action={becomeVendor} className="mt-5 space-y-4">
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
                Contact name
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
                Contact number
              </span>
              <input
                name="contact_phone"
                type="tel"
                defaultValue={defaults.contactPhone}
                maxLength={32}
                placeholder="+63 917 …"
                className="input-field"
              />
            </label>

            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Website <span className="font-normal" style={{ color: 'var(--m-slate-3)' }}>· optional</span>
              </span>
              <input
                name="website"
                type="url"
                defaultValue={defaults.website}
                placeholder="https://yourstudio.ph"
                className="input-field"
              />
            </label>

            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Social media <span className="font-normal" style={{ color: 'var(--m-slate-3)' }}>· optional</span>
              </span>
              <input
                name="social_url"
                type="url"
                placeholder="instagram.com/your-brand or your Facebook page"
                className="input-field"
              />
              <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
                Helps couples find you — and counts toward your verification checklist.
              </span>
            </label>

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
