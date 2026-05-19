import { Receipt, Shield, FileCheck2, Scale, type LucideIcon } from 'lucide-react';

// Compliance & receipts — BIR-compliant ORs, RA 10173, EWT, Form 2307.
// Reassurance for the financial-anxiety audience: the people who need to
// know "if my parents ask, can I show them an OR?" before they apply.

type Item = {
  Icon: LucideIcon;
  title: string;
  body: string;
};

const ITEMS: Item[] = [
  {
    Icon: Receipt,
    title: 'BIR-compliant ORs on every payment',
    body: 'Every payment you make on Setnayan generates an Official Receipt with the 12% VAT split, the seller&rsquo;s TIN, your TIN (if you have one), and a sequential OR number that survives audit. We file these with the BIR on the seller&rsquo;s behalf so the receipt is real, not a printout.',
  },
  {
    Icon: Shield,
    title: 'RA 10173 (Data Privacy Act) compliant',
    body: 'Your guest list, your vendor contracts, your photos &mdash; the data you put into Setnayan stays yours. We process it under a Data Processing Agreement, you can export everything in one click, and you can delete your account permanently. We never sell guest lists, ever.',
  },
  {
    Icon: FileCheck2,
    title: 'Expanded Withholding Tax (EWT) handled',
    body: 'When you pay a vendor through Setnayan, we calculate, withhold, and remit the correct EWT (1% / 2% / 5% / 10% depending on the service category) directly to the BIR. The vendor sees the gross, you pay the gross, and the withheld portion never touches the vendor&rsquo;s account. No spreadsheets, no surprises in April.',
  },
  {
    Icon: Scale,
    title: 'Form 2307 generated automatically',
    body: 'For every EWT-applicable payment, Setnayan generates Form 2307 (Certificate of Creditable Tax Withheld at Source) with both your details and the vendor&rsquo;s. The vendor can claim the credit on their own returns. Your bookkeeper gets the year-end summary as a CSV.',
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
            Section 6 &middot; Compliance & receipts
          </p>
          <h2
            id="compliance-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            Real receipts. Real compliance. No tax-day surprises.
          </h2>
          <p className="text-base text-ink/65">
            If your parents ask for the OR, you have one. If your accountant
            asks for the 2307s, they&rsquo;re downloadable. If your vendor
            asks for proof of payment, it&rsquo;s in their dashboard. The
            boring parts of running an event &mdash; handled, not handed
            back to you.
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
