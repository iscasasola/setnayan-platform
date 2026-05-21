import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// Section 11 — Dual CTA conversion module + brand-origin footer
// (iteration 0015 § Section 11)
//
// Conversion module:
//   - Brand-reveal payoff "Set na 'yan."
//   - Single primary CTA `Apply now →` (couples, foregrounded)
//   - Ghost vendor secondary (visually subordinate)
//
// Footer chrome (shared across marketing pages — rendered here in the
// homepage skeleton; could later be extracted as a shared layout footer):
//   - SETNAYAN wordmark + symbol
//   - Brand-origin paragraph
//   - Nav · Legal · Compliance · Language switcher (self-names)
//   - Address, copyright
//
// Language switcher is a placeholder per skeleton scope — non-functional
// in V1, just visible. Self-names per the locked Smartling / Lionbridge /
// Digital.gov localization best practice: "English · Tagalog · Sugbuanon"
// (replaces the "Cebuano" exonym).

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '/signup', label: 'Plan an event' },
  { href: '/for-vendors', label: 'For vendors' },
  // /about and /contact don't exist yet in this codebase; route to /help
  // until those pages land (per spec routes list). Contact deep-links to
  // the help-page contact form section (id="contact" verified to exist).
  { href: '/help', label: 'About' },
  { href: '/help', label: 'Help center' },
  { href: '/help#contact', label: 'Contact' },
  { href: '/login', label: 'Login' },
];

const LEGAL_LINKS: Array<{ href: string; label: string }> = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'tl', label: 'Tagalog' },
  { code: 'ceb', label: 'Sugbuanon' },
];

export function ConversionModule() {
  return (
    <section
      id="conversion-module"
      aria-labelledby="conversion-heading"
      className="bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-terracotta">
            Set na &lsquo;yan.
          </p>
          <h2
            id="conversion-heading"
            className="mt-4 text-balance font-display text-5xl font-medium tracking-tight text-ink sm:text-6xl lg:text-7xl"
          >
            <span className="italic text-ink/85">Everything&rsquo;s set.</span>
          </h2>
          <p className="mt-4 text-base text-ink/65 sm:text-lg">
            Nothing else like it in the Philippines.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-ink/10 bg-cream p-8 shadow-[0_30px_60px_-40px_rgba(26,26,26,0.18)] sm:p-10">
          <h3 className="font-sans text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Plan your event with Setnayan.
          </h3>
          <p className="mt-3 text-base text-ink/65">
            Apply now. Setnayan Team will contact you within 24 hours with
            your activation link.
          </p>
          <div className="mt-6">
            <Link
              href="/signup"
              className="button-primary inline-flex min-h-[48px] items-center justify-center gap-2 px-7 text-sm font-semibold sm:text-base"
            >
              Apply now
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-ink/55">
          You&rsquo;re a vendor?{' '}
          <Link
            href="/signup?as=vendor"
            className="font-medium text-terracotta underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
          >
            Register your business — free &rarr;
          </Link>
        </p>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer
      aria-label="Site footer"
      className="border-t border-ink/10 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Brand block */}
          <div className="space-y-5 lg:col-span-5">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink text-cream"
              >
                {/* Symbol placeholder — replace with real setnayan_logo.svg */}
                <span className="font-mono text-xs font-semibold">S</span>
              </span>
              <span className="font-sans text-lg font-semibold tracking-tight text-ink">
                SETNAYAN
              </span>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-ink/65">
              <span className="italic">&ldquo;Set na &lsquo;yan.&rdquo;</span>{' '}
              A Tagalog phrase that means &ldquo;it&rsquo;s all set&rdquo; —
              the moment everything clicks into place. Your venue&rsquo;s
              booked. Your photographer confirmed. Your guests are
              RSVP&rsquo;d. Your day is ready.
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">
              Setnayan · the platform behind Setnayan
            </p>
          </div>

          {/* Nav */}
          <nav
            aria-label="Footer navigation"
            className="lg:col-span-3"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
              Navigate
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-ink/70 transition-colors hover:text-ink focus-visible:outline-none focus-visible:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal + Compliance */}
          <div className="lg:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
              Legal
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-ink/70 transition-colors hover:text-ink focus-visible:outline-none focus-visible:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
              Compliance
            </p>
            <ul className="mt-4 space-y-1 text-xs text-ink/55">
              <li>BIR-compliant receipts</li>
              <li>RA 10173 compliant</li>
            </ul>
          </div>

          {/* Language switcher (placeholder — non-functional in V1) */}
          <div className="lg:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
              Language
            </p>
            <ul
              role="list"
              aria-label="Language switcher (English, Tagalog, Sugbuanon — available at launch)"
              className="mt-4 space-y-2 text-sm"
            >
              {LANGUAGES.map((l, i) => (
                <li key={l.code}>
                  <button
                    type="button"
                    aria-current={i === 0 ? 'true' : undefined}
                    disabled
                    className={`inline-flex min-h-[36px] items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-80 ${
                      i === 0
                        ? 'border-terracotta/40 bg-terracotta/5 text-ink'
                        : 'border-ink/10 text-ink/60'
                    }`}
                    title="Language switcher activates with the localization release"
                  >
                    <span
                      aria-hidden
                      className="font-mono text-[10px] uppercase tracking-[0.15em]"
                    >
                      {l.code}
                    </span>
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-ink/45">
              Switcher activates with the localization release.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-ink/10 pt-6 text-xs text-ink/55 sm:flex-row sm:items-center sm:justify-between">
          <p>Quezon City, Philippines</p>
          <p>&copy; 2026 Setnayan</p>
        </div>
      </div>
    </footer>
  );
}

export function DualCTAFooter() {
  return (
    <>
      <ConversionModule />
      <SiteFooter />
    </>
  );
}
