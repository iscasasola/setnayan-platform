// Section 8.5 — Transparent pricing (iteration 0015 § Section 8.5)
// Locked 2026-05-16 (spec-corpus decision-log row 9). Replaces the prior
// "no commission on vendor bookings" couple-side copy that hid the 5.0%
// Setnayan Pay convenience fee. The fee is paid by the couple on top of
// the vendor's listed price at checkout — the vendor still receives 100%
// of their listed price, so the vendor-side "no commission, no monthly
// bill" framing in Sections 5 / 8 / /for-vendors stays intact.
//
// Layout follows the spec-corpus shape:
//   - Headline + sub-claim
//   - Three-column transparency strip (Free forever · À la carte ·
//     +5.0% at checkout). Mobile collapses to single column.
//   - Worked-example accordion (₱100,000 → +₱5,500 → ₱105,500).
//     Native <details>/<summary> — auto-open on lg+, tap-to-expand on
//     mobile to keep above-the-fold density readable.
//
// Server Component — no client state, all copy is static. Reuses the
// existing Tailwind tokens already in use across the other page-sections
// (border-ink/5, max-w-6xl, font-mono uppercase terracotta eyebrow,
// rounded-xl border-ink/10 bg-cream cards) — no new primitives.

const TRANSPARENCY_COLUMNS: Array<{ heading: string; body: string }> = [
  {
    heading: 'Free forever',
    body: 'Guest list, RSVP, seating, budget, mood board, schedule — every planning surface is free. No paywall, no per-guest fee.',
  },
  {
    heading: 'À la carte',
    body: 'Panood, Patiktok, Save-the-Date Video, Custom Monogram — you only pay when you opt into a specific service. Most add-ons are FREE during the launch promo (until Mar 31, 2027). Couple-side prices are listed on /pricing and re-shown at checkout.',
  },
  {
    heading: '+5.0% at checkout',
    body: 'Vendor lists their price. At checkout we add a 5.0% Setnayan Pay convenience fee that powers BIR-compliant receipts, in-app messaging, milestone-protected payments, and platform safety. Your vendor sees their listed price 100%.',
  },
];

const WORKED_EXAMPLE_LINES: Array<{
  label: string;
  value: string;
  emphasis?: boolean;
}> = [
  { label: "Vendor's listed price", value: '₱100,000' },
  { label: 'Setnayan Pay convenience fee (5.0%)', value: '₱5,000' },
  { label: 'You pay at checkout', value: '₱105,000', emphasis: true },
];

export function TransparentPricing() {
  return (
    <section
      aria-labelledby="transparent-pricing-heading"
      className="border-b border-ink/5"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="max-w-3xl space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Transparent pricing
          </p>
          <h2
            id="transparent-pricing-heading"
            className="text-balance font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl lg:text-6xl"
          >
            Transparent pricing.
          </h2>
          <p className="text-base text-ink/65 sm:text-lg">
            Free to plan — the planning tools are free forever. Vendor
            bookings add a 5.0% Setnayan Pay convenience fee at checkout,
            shown on the order summary before you confirm. No subscription,
            no per-guest fee, no hidden charges.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-1 xl:grid-cols-3">
            {TRANSPARENCY_COLUMNS.map((c) => (
              <li
                key={c.heading}
                className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5"
              >
                <h3 className="text-base font-semibold tracking-tight text-ink sm:text-lg">
                  {c.heading}
                </h3>
                <p className="text-sm text-ink/65">{c.body}</p>
              </li>
            ))}
          </ul>
          <details className="group flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5 open:gap-4 lg:open lg:[&_summary_.indicator]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold tracking-tight text-ink lg:cursor-default">
              <span>Worked example — ₱100,000 vendor booking</span>
              <span
                aria-hidden
                className="indicator inline-flex h-6 w-6 items-center justify-center rounded-full border border-ink/15 font-mono text-[11px] text-ink/55 transition-transform group-open:rotate-180 lg:hidden"
              >
                +
              </span>
              <span className="sr-only lg:hidden"> — See how it works</span>
            </summary>
            <dl className="flex flex-col gap-2 text-sm">
              {WORKED_EXAMPLE_LINES.map((line) => (
                <div
                  key={line.label}
                  className={`flex items-baseline justify-between gap-3 ${
                    line.emphasis ? 'border-t border-ink/10 pt-2' : ''
                  }`}
                >
                  <dt className="text-ink/65">{line.label}</dt>
                  <dd
                    className={`font-mono ${
                      line.emphasis
                        ? 'text-sm font-semibold text-terracotta'
                        : 'text-sm text-ink'
                    }`}
                  >
                    {line.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-ink/55">
              Your vendor receives the ₱100,000 listed price (minus their
              own terminal fee + BIR withholding — same as any payment
              platform). Setnayan keeps the 5,000 to run the app.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
