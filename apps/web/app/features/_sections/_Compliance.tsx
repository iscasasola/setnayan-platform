import { Receipt, Shield, FileCheck2, Scale, type LucideIcon } from 'lucide-react';

// Privacy & receipts — itemized receipts on Setnayan software purchases,
// RA 10173 data protection, and 0% commission on vendor bookings.
//
// Rewritten 2026-05-28 (V2 cutover) — Setnayan no longer routes vendor
// payments through its books per owner directive ("we will no longer
// transact their packages · vendors earn the whole money · Setnayan will
// not take money from purchases of the Customers"). Vendors handle their
// own tax treatment on the bookings they receive directly.
//
// Stale-claim purge 2026-06-13 — all "BIR-compliant OR / 12% VAT /
// sequential OR number / 2307" claims removed; Setnayan does not issue
// BIR-compliant Official Receipts. Software purchases get a plain itemized
// receipt only.

type Item = {
  Icon: LucideIcon;
  title: string;
  body: string;
};

const ITEMS: Item[] = [
  {
    Icon: Receipt,
    title: 'A receipt for every software purchase',
    body: 'Every software service you buy from Setnayan (Animated Monogram, Setnayan AI, Panood, Patiktok, etc.) gets an itemized receipt — emailed to you and archived in your dashboard, so you always have a record of what you paid.',
  },
  {
    Icon: Shield,
    title: 'RA 10173 (Data Privacy Act) compliant',
    body: 'Your guest list, your vendor contracts, your photos &mdash; the data you put into Setnayan stays yours. We process it under a Data Processing Agreement, you can export everything in one click, and you can delete your account permanently. We never sell guest lists, ever.',
  },
  {
    Icon: FileCheck2,
    title: 'Zero commission on vendor bookings',
    body: 'When you pay your photographer, caterer, or florist, that money goes straight from your account to theirs. Setnayan never sits between you at checkout — so there&rsquo;s no platform deduction and no markup. Your vendor handles their own receipts and tax treatment.',
  },
  {
    Icon: Scale,
    title: 'Receipts in one place',
    body: 'Your Setnayan software receipts download together so you always have a record. Vendor-side: monthly subscription receipts + token-pack receipts download the same way. The boring parts &mdash; handled, not handed back to you.',
  },
];

export function Compliance() {
  return (
    <section
      id="compliance"
      aria-labelledby="compliance-heading"
      className="scroll-mt-24 border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Section 6 &middot; Privacy & receipts
          </p>
          <h2
            id="compliance-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            Your data. Your money. Your records.
          </h2>
          <p className="text-base text-ink/65">
            Every software purchase comes with a receipt you can pull up
            anytime. Your guest data stays yours. And when you pay a vendor,
            the money goes straight to them &mdash; Setnayan never sits in
            the middle. The boring parts of running an event &mdash; handled,
            not handed back to you.
          </p>
        </header>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ITEMS.map((item) => {
            const { Icon } = item;
            return (
              <li
                key={item.title}
                className="flex items-start gap-4 rounded-xl border border-ink/10 bg-cream p-5"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold tracking-tight text-ink">
                    {item.title}
                  </h3>
                  <p
                    className="text-sm text-ink/65"
                    dangerouslySetInnerHTML={{ __html: item.body }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
