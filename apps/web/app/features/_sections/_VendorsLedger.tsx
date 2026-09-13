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
// Bilingual (EN + Taglish). META (icon) is language-neutral and zips with
// COPY[locale].items by index — keep both arrays in lockstep.
//
// The `iteration` tag ('Iteration 0006' …) was removed 2026-08-06: it rendered
// on the PUBLIC features page, in both locales, to anonymous visitors and to
// Google. The field is gone rather than merely unrendered so it cannot be
// re-surfaced by a later edit.

// `slug` is a language-neutral per-item anchor, so a rail card (Vendor
// ledger, Contracts) can deep-link to its own row instead of the shared
// `#vendors-ledger` section top.
const META: { Icon: LucideIcon; slug: string }[] = [
  { Icon: Briefcase, slug: 'vendor-management' },
  { Icon: ListChecks, slug: 'payment-milestones' },
  { Icon: CalendarPlus, slug: 'calendar-export' },
  { Icon: FileText, slug: 'contract-uploads' },
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
      'Track contracts, milestones, deadlines, and crew-meal counts. Calendar-export every payment + every vendor meeting. Vendors stay in sync. You stay in control.',
    items: [
      {
        title: 'Vendor management · every vendor in one ledger',
        body: 'Add a vendor (or pick from the verified Setnayan directory). Save their contact, contract, packages, payment schedule, deliverables, and notes against a single row. Their reply-to-your-DM lives in the same row as their contract PDF and your last payment OR. No more hunting through three apps to remember what you agreed to.',
      },
      {
        title: 'Payment milestones, tracked',
        body: '50% reservation, 30% midway, 20% balance. Set the schedule once, Setnayan reminds you (and the vendor) when each milestone is due. Mark paid; we attach the OR. Watch the budget bar move. No more “wait, did we already pay them for this?”',
      },
      {
        title: 'Calendar export · your dates, your calendar',
        body: 'Every vendor payment with a due date exports from the budget page as one .ics file, and each confirmed vendor meeting exports as its own. Download, import, done — into whichever calendar you already use. Overdue milestones sort above what is merely next, so you see what is late first.',
      },
      {
        title: 'Contract & document uploads',
        body: 'Your vendor uploads the contract PDF against your event, and the two of you sign it in the browser — signatures captured on the page, with a timestamped record of who signed and when. It stays on the vendor row, reachable from anywhere in the app, so nobody has to dig through email for that one PDF.',
      },
    ],
  },
  tl: {
    eyebrow: 'Section 3 · Vendors & ledger',
    heading: 'Bawat vendor, bawat bayad, isang ledger.',
    intro:
      'I-track ang contracts, milestones, deadlines, at crew-meal counts. Calendar-export ang bawat bayad + bawat vendor meeting. Naka-sync ang vendors. Ikaw ang may kontrol.',
    items: [
      {
        title: 'Vendor management · lahat ng vendor sa isang ledger',
        body: 'Magdagdag ng vendor (o pumili mula sa verified Setnayan directory). I-save ang contact, contract, packages, payment schedule, deliverables, at notes nila sa isang row. Ang reply nila sa DM mo ay nasa parehong row ng contract PDF nila at ng huling payment OR mo. Hindi mo na kailangang maghanap sa tatlong app para maalala kung ano ang napagkasunduan niyo.',
      },
      {
        title: 'Payment milestones, na-track',
        body: '50% reservation, 30% midway, 20% balance. Set ang schedule once, ire-remind ka ng Setnayan (at ang vendor) kung kailan due ang bawat milestone. I-mark na paid; ikakabit namin ang OR. Panoorin mong gumalaw ang budget bar. Wala nang “teka, nabayaran na ba natin sila dito?”',
      },
      {
        title: 'Calendar export · ang mga petsa mo, sa calendar mo',
        body: 'Bawat vendor payment na may due date ay nae-export mula sa budget page bilang isang .ics file, at ang bawat kumpirmadong vendor meeting ay may sarili ring export. I-download, i-import, tapos — sa kahit anong calendar na ginagamit mo na. Nauuna ang overdue na milestones kaysa sa mga paparating pa lang, para makita mo agad kung ano ang huli na.',
      },
      {
        title: 'Contract & document uploads',
        body: 'Ang vendor mo ang mag-a-upload ng contract PDF sa event mo, at pareho kayong pipirma sa browser — nakukuha ang pirma sa mismong page, may timestamp kung sino ang pumirma at kailan. Nananatili ito sa vendor row, maa-access kahit saan sa app, para walang maghahalungkat ng email para sa isang PDF.',
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
            const { Icon, slug } = META[i]!;
            return (
              <li
                key={item.title}
                id={slug}
                className="scroll-mt-24 flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5"
              >
                {/* The internal spec code ("Iteration 0006") used to sit opposite
                    the icon, public to every visitor. Removed — the icon carries
                    the row on its own. */}
                <div className="flex items-center">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
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
