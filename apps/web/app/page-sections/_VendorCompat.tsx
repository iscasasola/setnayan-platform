'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

// Section 8 — Vendor compatibility & verification (iteration 0015 § Section 8)
// Tabbed module that flips between "What you get as a vendor" and "How
// verification works."

const TABS = [
  { id: 'what-you-get', label: 'What you get' },
  { id: 'verification', label: 'How verification works' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const WHAT_YOU_GET: string[] = [
  'Free profile with logo, photos, services, packages, contact button',
  "Showing up in every couple's vendor finder for your service category",
  'Direct lead capture — couples message you in-app, no third-party fees',
  'Calendar block for inquiries → meetings → bookings',
  'Vendor dashboard inside the same Setnayan app — no second download, no second login. Log in, the app jumps you to the vendor surface.',
  'Lightweight CRM + supplier inbox built into the vendor surface from V1 (one product, three doorways).',
];

const VERIFICATION_STEPS: Array<{ n: string; body: string }> = [
  {
    n: '01',
    body: 'Apply with business name, owner name, service category, service area, sample work.',
  },
  {
    n: '02',
    body: "Setnayan Team admin reviews legitimacy (DTI / SEC / Mayor's Permit photo OK; portfolio review for solo creatives).",
  },
  {
    n: '03',
    body: 'Status flips from Pending Verification → Verified (typical SLA: 3 business days).',
  },
  {
    n: '04',
    body: 'Verified vendors get a Setnayan check badge on every surface.',
  },
  {
    n: '05',
    body: 'Couples see only verified vendors by default; unverified profiles are toggle-on in advanced search.',
  },
];

// Default export so this client component is import-able via `next/dynamic`
// (the App Router lazy-load helper) from the homepage Server Component.
// Named export retained for any sibling page that wants direct, eager use.
export default function VendorCompat() {
  const [active, setActive] = useState<TabId>('what-you-get');

  return (
    <section
      aria-labelledby="vendor-compat-heading"
      className="border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="max-w-3xl space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            For vendors
          </p>
          <h2
            id="vendor-compat-heading"
            className="text-balance font-sans text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl"
          >
            Vendor compatibility &amp; verification.
          </h2>
          <p className="text-base text-ink/65 sm:text-lg">
            How vendors plug in. How couples know who&rsquo;s real. Built
            into the same app, one login.
          </p>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Vendor compatibility and verification"
          className="mt-10 inline-flex rounded-full border border-ink/10 bg-cream p-1"
        >
          {TABS.map((t) => {
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${t.id}`}
                id={`tab-${t.id}`}
                type="button"
                onClick={() => setActive(t.id)}
                className={`min-h-[44px] rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
                  isActive
                    ? 'bg-terracotta text-cream'
                    : 'text-ink/65 hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Panels */}
        <div className="mt-10">
          {active === 'what-you-get' ? (
            <div
              role="tabpanel"
              id="panel-what-you-get"
              aria-labelledby="tab-what-you-get"
            >
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {WHAT_YOU_GET.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 rounded-xl border border-ink/10 bg-cream p-5"
                  >
                    <CheckCircle2
                      aria-hidden
                      className="mt-0.5 h-5 w-5 shrink-0 text-terracotta"
                      strokeWidth={1.75}
                    />
                    <span className="text-sm text-ink/75 sm:text-base">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div
              role="tabpanel"
              id="panel-verification"
              aria-labelledby="tab-verification"
            >
              <ol className="space-y-3">
                {VERIFICATION_STEPS.map((s) => (
                  <li
                    key={s.n}
                    className="flex gap-4 rounded-xl border border-ink/10 bg-cream p-5"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/10 font-mono text-xs font-semibold text-terracotta-700">
                      {s.n}
                    </span>
                    <span className="text-sm text-ink/75 sm:text-base">
                      {s.body}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-5">
                <ShieldCheck
                  aria-hidden
                  className="mt-0.5 h-5 w-5 shrink-0 text-terracotta"
                  strokeWidth={1.75}
                />
                <p className="text-sm text-ink/75 sm:text-base">
                  Every verified vendor wears the Setnayan check badge. Couples
                  can trust at a glance who&rsquo;s been reviewed by the team.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-10">
          <Link
            href="/signup?as=vendor"
            className="button-primary inline-flex min-h-[48px] items-center justify-center gap-2 px-7 text-sm font-semibold sm:text-base"
          >
            Apply now
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// Named re-export keeps the original `import { VendorCompat } from …`
// call sites working alongside the new default export.
export { VendorCompat };
