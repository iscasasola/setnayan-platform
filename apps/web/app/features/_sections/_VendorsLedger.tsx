import {
  Briefcase,
  ListChecks,
  CalendarPlus,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import type { MarketingLocale } from '@/lib/marketing-i18n';

// Vendors & ledger — vendor management (0006), payment milestones,
// calendar export (.ics), contract uploads. Mirrors the homepage
// "Vendors" tab on the four-tab walkthrough but unpacked.
//
// Bilingual (EN + Taglish). META (icon + iteration tag) is language-neutral
// and zips with COPY[locale].items by index — keep both arrays in lockstep.

const META: { Icon: LucideIcon; iteration: string }[] = [
  { Icon: Briefcase, iteration: 'Iteration 0006' },
  { Icon: ListChecks, iteration: 'Iteration 0007' },
  { Icon: CalendarPlus, iteration: 'Iteration 0008' },
  { Icon: FileText, iteration: 'Iteration 0006' },
];

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
    eyebrow: 'Section 3 · Vendors & ledger',
    heading: 'Every vendor, every payment, one ledger.',
    intro:
      'Track contracts, milestones, deadlines, and crew-meal counts. Calendar-export every payment + every vendor meeting. Vendors stay in sync — you stay in control.',
    items: [
      {
        title: 'Vendor management — every vendor in one ledger',
        body: 'Add a vendor (or pick from the verified Setnayan directory). Save their contact, contract, packages, payment schedule, deliverables, and notes against a single row. Their reply-to-your-DM lives in the same row as their contract PDF and your last payment OR. No more hunting through three apps to remember what you agreed to.',
      },
      {
        title: 'Payment milestones, tracked',
        body: '50% reservation, 30% midway, 20% balance — set the schedule once, Setnayan reminds you (and the vendor) when each milestone is due. Mark paid; we attach the OR. Watch the budget bar move. No more “wait, did we already pay them for this?”',
      },
      {
        title: 'Calendar export — .ics for everything',
        body: 'Vendor meetings, payment deadlines, RSVP cutoffs, dress fittings, food tastings — all exportable as a single .ics feed your phone subscribes to. Updates push live; you don’t re-import. Family members get their own subscribable feed (filtered to just events they’re part of).',
      },
      {
        title: 'Contract & document uploads',
        body: 'Drop the PDF the vendor sent you. Setnayan stores it against the vendor row, OCR-scans the signed page, and surfaces the key fields (deposit amount, balance due date, deliverables list) into the ledger automatically. Reachable from anywhere in the app — no more digging through your email for that one PDF.',
      },
    ],
  },
  tl: {
    eyebrow: 'Section 3 · Vendors & ledger',
    heading: 'Bawat vendor, bawat bayad, isang ledger.',
    intro:
      'I-track ang contracts, milestones, deadlines, at crew-meal counts. Calendar-export ang bawat bayad + bawat vendor meeting. Naka-sync ang vendors — ikaw ang may kontrol.',
    items: [
      {
        title: 'Vendor management — lahat ng vendor sa isang ledger',
        body: 'Magdagdag ng vendor (o pumili mula sa verified Setnayan directory). I-save ang contact, contract, packages, payment schedule, deliverables, at notes nila sa isang row. Ang reply nila sa DM mo ay nasa parehong row ng contract PDF nila at ng huling payment OR mo. Hindi mo na kailangang maghanap sa tatlong app para maalala kung ano ang napagkasunduan niyo.',
      },
      {
        title: 'Payment milestones, na-track',
        body: '50% reservation, 30% midway, 20% balance — set ang schedule once, ire-remind ka ng Setnayan (at ang vendor) kung kailan due ang bawat milestone. I-mark na paid; ikakabit namin ang OR. Panoorin mong gumalaw ang budget bar. Wala nang “teka, nabayaran na ba natin sila dito?”',
      },
      {
        title: 'Calendar export — .ics para sa lahat',
        body: 'Vendor meetings, payment deadlines, RSVP cutoffs, dress fittings, food tastings — lahat exportable bilang isang .ics feed na sina-subscribe ng phone mo. Live ang updates; hindi mo na kailangang mag-re-import. May sariling subscribable feed ang mga kapamilya (naka-filter sa mga event lang na kasali sila).',
      },
      {
        title: 'Contract & document uploads',
        body: 'I-drop ang PDF na pinadala sa’yo ng vendor. Iso-store ito ng Setnayan sa vendor row, ie-OCR-scan ang naka-pirmang page, at ila-labas ang mga key fields (deposit amount, balance due date, deliverables list) papunta sa ledger nang automatic. Maa-access kahit saan sa app — hindi mo na kailangang halungkatin ang email mo para sa isang PDF.',
      },
    ],
  },
};

export function VendorsLedger({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  return (
    <section
      id="vendors-ledger"
      aria-labelledby="vendors-ledger-heading"
      className="scroll-mt-24 border-b border-ink/5"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            {c.eyebrow}
          </p>
          <h2
            id="vendors-ledger-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            {c.heading}
          </h2>
          <p className="text-base text-ink/65">{c.intro}</p>
        </header>

        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {c.items.map((item, i) => {
            const { Icon, iteration } = META[i]!;
            return (
              <li
                key={item.title}
                className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
                    {iteration}
                  </span>
                </div>
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
