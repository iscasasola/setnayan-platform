// Section 8.5 — Transparent pricing (iteration 0015 § Section 8.5)
// Rewritten 2026-05-28 (V2 cutover) — retired the 5.0% Setnayan Pay
// convenience-fee framing entirely. Per owner directive:
//   "We will no longer transact their packages. they can post on our page,
//    but they can earn the whole money. Setnayan will not take money from
//    the purchases of the Customers."
//
// New thesis: Setnayan sells software SKUs at retail · vendors transact
// directly with couples off-platform · 0% commission on vendor bookings.
// Couples + vendors both get a free website on top.
//
// Server Component — no client state, all copy is static.

const TRANSPARENCY_COLUMNS: Array<{ heading: string; body: string }> = [
  {
    heading: 'Free websites',
    body: "Your wedding lives at setnayan.com/your-slug — free forever. Vendors get their own subdomain at slug.setnayan.com — also free. Branded QR, RSVP, and event details are built in.",
  },
  {
    heading: 'Software at retail',
    body: 'Animated Monogram, Panood live-stream, Patiktok, Save-the-Date Video, Custom Guest QRs, Today’s Focus — paid one-time at the listed PHP price on /pricing. BIR receipts on every purchase.',
  },
  {
    heading: '0% on vendor bookings',
    body: 'Your photographer, caterer, florist, coordinator — their package is between you and them. Setnayan never sits between you at checkout. They keep 100% of what you pay them.',
  },
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
            Real software prices.
            <br className="hidden sm:block" />{' '}
            <span className="text-ink/55">Zero commission.</span>
          </h2>
          <p className="text-base text-ink/65 sm:text-lg">
            Setnayan only sells you software you opt into. Your vendor bookings
            stay between you and the vendor — Setnayan never takes a cut at
            checkout.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      </div>
    </section>
  );
}
