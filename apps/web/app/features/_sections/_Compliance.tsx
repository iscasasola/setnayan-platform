import { Receipt, Shield, FileCheck2, Scale, type LucideIcon } from 'lucide-react';
import type { MarketingLocale } from '@/lib/marketing-i18n';

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
//
// Bilingual (EN + Taglish). Icons are language-neutral (ICONS) and zip with
// COPY[locale].items by index — keep the two arrays the same length + order.

const ICONS: LucideIcon[] = [Receipt, Shield, FileCheck2, Scale];

const COPY: Record<
  MarketingLocale,
  {
    eyebrow: string;
    heading: string;
    intro: string;
    items: { title: string; body: string }[];
  }
> = {
  en: {
    eyebrow: 'Section 6 · Privacy & receipts',
    heading: 'Your data. Your money. Your records.',
    intro:
      'Every software purchase comes with a receipt you can pull up anytime. Your guest data stays yours. And when you pay a vendor, the money goes straight to them — Setnayan never sits in the middle. The boring parts of running an event — handled, not handed back to you.',
    items: [
      {
        title: 'A receipt for every software purchase',
        body: 'Every software service you buy from Setnayan (Animated Monogram, Setnayan AI, Panood, Patiktok, etc.) gets an itemized receipt — emailed to you and archived in your dashboard, so you always have a record of what you paid.',
      },
      {
        title: 'RA 10173 (Data Privacy Act) compliant',
        body: 'Your guest list, your vendor contracts, your photos — the data you put into Setnayan stays yours. We process it under a Data Processing Agreement, you can export everything in one click, and you can delete your account permanently. We never sell guest lists, ever.',
      },
      {
        title: 'Zero commission on vendor bookings',
        body: 'When you pay your photographer, caterer, or florist, that money goes straight from your account to theirs. Setnayan never sits between you at checkout — so there’s no platform deduction and no markup. Your vendor handles their own receipts and tax treatment.',
      },
      {
        title: 'Receipts in one place',
        body: 'Your Setnayan software receipts download together so you always have a record. Vendor-side: monthly subscription receipts + token-pack receipts download the same way. The boring parts — handled, not handed back to you.',
      },
    ],
  },
  tl: {
    eyebrow: 'Section 6 · Privacy & receipts',
    heading: 'Data mo. Pera mo. Records mo.',
    intro:
      'May resibo ang bawat software purchase na pwede mong tingnan anytime. Sa’yo nananatili ang guest data mo. At pag nagbayad ka sa vendor, diretso sa kanila ang pera — hindi nakikialam ang Setnayan sa gitna. Ang mga nakakaantok na parte ng pag-aasikaso ng event — kami na ang bahala, hindi isinasauli sa’yo.',
    items: [
      {
        title: 'Resibo para sa bawat software purchase',
        body: 'Bawat software service na binili mo sa Setnayan (Animated Monogram, Setnayan AI, Panood, Patiktok, etc.) ay may itemized receipt — ipinapadala sa email mo at naka-archive sa dashboard mo, para may record ka lagi ng binayaran mo.',
      },
      {
        title: 'RA 10173 (Data Privacy Act) compliant',
        body: 'Ang guest list mo, ang vendor contracts mo, ang photos mo — ang data na inilalagay mo sa Setnayan ay nananatiling sa’yo. Pinoproseso namin ito sa ilalim ng Data Processing Agreement, pwede mong i-export lahat in one click, at pwede mong i-delete nang permanente ang account mo. Hindi namin kailanman ibinebenta ang guest lists.',
      },
      {
        title: 'Zero commission sa vendor bookings',
        body: 'Pag binayaran mo ang photographer, caterer, o florist mo, diretso sa kanila galing sa account mo ang pera. Hindi kailanman pumapagitna ang Setnayan sa checkout — kaya walang platform deduction at walang markup. Ang vendor mo ang humahawak ng sarili nilang resibo at tax treatment.',
      },
      {
        title: 'Lahat ng resibo, nasa isang lugar',
        body: 'Ang Setnayan software receipts mo ay sabay-sabay na nada-download para may record ka lagi. Sa vendor-side: ganun din ang monthly subscription receipts + token-pack receipts. Ang mga nakakaantok na parte — kami na ang bahala, hindi isinasauli sa’yo.',
      },
    ],
  },
};

export function Compliance({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  return (
    <section
      id="compliance"
      aria-labelledby="compliance-heading"
      className="scroll-mt-24 border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            {c.eyebrow}
          </p>
          <h2
            id="compliance-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            {c.heading}
          </h2>
          <p className="text-base text-ink/65">{c.intro}</p>
        </header>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {c.items.map((item, i) => {
            const Icon = ICONS[i]!;
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
