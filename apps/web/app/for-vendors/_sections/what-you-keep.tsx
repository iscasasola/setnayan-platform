import { Receipt, Wallet, FileSignature, Percent, type LucideIcon } from 'lucide-react';

// "What you keep" — the trust block. Pulls from iteration 0022 § 5c
// (vendor-controlled final price + payment routing) and CLAUDE.md
// "BIR receipts handled · EWT/2307 · your branding on contracts."
// Frames Setnayan as the operating layer underneath your business,
// not a marketplace skimming the top of every booking.

const ITEMS: Array<{
  Icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    Icon: Wallet,
    title: 'Your payouts, your accounts',
    body: 'Default payment is direct: couple sends to your BDO or GCash. Setnayan tracks the milestone and issues the receipt — but the money never sits in our account. Zero platform fee on the booking itself.',
  },
  {
    Icon: Receipt,
    title: 'BIR receipts handled',
    body: 'Every booking generates a BIR-compliant Official Receipt with the 12% VAT split spelled out — auto-emailed to the couple, archived in your dashboard. No more booklet scribbles, no more lost ORs.',
  },
  {
    Icon: Percent,
    title: 'EWT / 2307 done for you',
    body: 'For Setnayan Pay bookings we handle the 1% creditable withholding tax and ship you a quarterly Form 2307 you can hand straight to your bookkeeper. Direct-payment bookings keep your normal flow.',
  },
  {
    Icon: FileSignature,
    title: 'Your branding on contracts',
    body: 'Proposals and contracts go out under your business name and logo, not Setnayan&rsquo;s. Couples see Mariposa Bloom Photography on the agreement — we&rsquo;re the rails, not the signatory.',
  },
];

export function WhatYouKeep() {
  return (
    <section className="border-b border-ink/5 bg-cream">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            What you keep
          </p>
          <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
            Setnayan is the rails, not the storefront.
          </h2>
          <p className="text-base text-ink/65">
            Your couples are still your couples. Your brand stays on the contract.
            Your money lands in your accounts. We handle the receipts and the
            tax paperwork so you can focus on the gig.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ITEMS.map((item) => {
            const { Icon } = item;
            return (
              <li
                key={item.title}
                className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="text-base font-semibold tracking-tight text-ink">
                  {item.title}
                </h3>
                <p
                  className="text-sm text-ink/65"
                  dangerouslySetInnerHTML={{ __html: item.body }}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
