import {
  Briefcase,
  ListChecks,
  CalendarPlus,
  FileText,
  type LucideIcon,
} from 'lucide-react';

// Vendors & ledger — vendor management (0006), payment milestones,
// calendar export (.ics), contract uploads. Mirrors the homepage
// "Vendors" tab on the four-tab walkthrough but unpacked.

type Item = {
  Icon: LucideIcon;
  title: string;
  body: string;
  iteration: string;
};

const ITEMS: Item[] = [
  {
    Icon: Briefcase,
    title: 'Vendor management — every vendor in one ledger',
    body: 'Add a vendor (or pick from the verified Setnayan directory). Save their contact, contract, packages, payment schedule, deliverables, and notes against a single row. Their reply-to-your-DM lives in the same row as their contract PDF and your last payment OR. No more hunting through three apps to remember what you agreed to.',
    iteration: 'Iteration 0006',
  },
  {
    Icon: ListChecks,
    title: 'Payment milestones, tracked',
    body: '50% reservation, 30% midway, 20% balance — set the schedule once, Setnayan reminds you (and the vendor) when each milestone is due. Mark paid; we attach the OR. Watch the budget bar move. No more &ldquo;wait, did we already pay them for this?&rdquo;',
    iteration: 'Iteration 0007',
  },
  {
    Icon: CalendarPlus,
    title: 'Calendar export — .ics for everything',
    body: 'Vendor meetings, payment deadlines, RSVP cutoffs, dress fittings, food tastings — all exportable as a single .ics feed your phone subscribes to. Updates push live; you don&rsquo;t re-import. Family members get their own subscribable feed (filtered to just events they&rsquo;re part of).',
    iteration: 'Iteration 0008',
  },
  {
    Icon: FileText,
    title: 'Contract & document uploads',
    body: 'Drop the PDF the vendor sent you. Setnayan stores it against the vendor row, OCR-scans the signed page, and surfaces the key fields (deposit amount, balance due date, deliverables list) into the ledger automatically. Reachable from anywhere in the app — no more digging through your email for that one PDF.',
    iteration: 'Iteration 0006',
  },
];

export function VendorsLedger() {
  return (
    <section
      id="vendors-ledger"
      aria-labelledby="vendors-ledger-heading"
      className="scroll-mt-24 border-b border-ink/5"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Section 3 &middot; Vendors & ledger
          </p>
          <h2
            id="vendors-ledger-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            Every vendor, every payment, one ledger.
          </h2>
          <p className="text-base text-ink/65">
            Track contracts, milestones, deadlines, and crew-meal counts.
            Calendar-export every payment + every vendor meeting. Vendors
            stay in sync &mdash; you stay in control.
          </p>
        </header>

        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {ITEMS.map((item) => {
            const { Icon } = item;
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
                    {item.iteration}
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
