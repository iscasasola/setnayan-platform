import { Check, X } from 'lucide-react';

// "What you'd give up vs what you'd gain" — outcome-led comparison à la
// Shopify. Five scattered apps vs one Setnayan workflow. The pattern
// here mirrors the homepage's "chaos panel" framing (iter 0015 § Section 4)
// but reframes it for the vendor side.

const ROWS: Array<{
  job: string;
  before: string;
  after: string;
}> = [
  {
    job: 'Take a booking inquiry',
    before: 'IG DM, FB Messenger, Viber, sometimes a personal text — wherever the couple finds you',
    after: 'One inbox, threaded per couple, contact details kept private until you reply',
  },
  {
    job: 'Block a date for a wedding',
    before: 'Notebook, Google Calendar, sticky note on the studio wall',
    after: 'Per-service calendar — block one camera, leave the prenup slot open',
  },
  {
    job: 'Send a proposal',
    before: 'Word doc, copy-paste from the last one, hope the price math is still right',
    after: 'Proposal builder pulls from your service catalog; couple accepts in-app',
  },
  {
    job: 'Get the reservation paid',
    before: 'GCash screenshot, &ldquo;chineck mo na po,&rdquo; manually note in the spreadsheet',
    after: 'Couple pays through Setnayan Pay or direct; milestones tick automatically',
  },
  {
    job: 'Issue a BIR-compliant receipt',
    before: 'Printed OR booklet, paste the line items, send a photo',
    after: 'Auto-generated OR with the 12% VAT split, emailed to the couple',
  },
  {
    job: 'Collect a review after the event',
    before: 'Awkward DM the next week asking for a Google review',
    after: 'Setnayan emails the couple 24 hours after the event; review lands on your profile',
  },
];

export function Comparison() {
  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Sounds familiar?
          </p>
          <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
            Five apps, three spreadsheets, a Viber group at 11pm.
          </h2>
          <p className="text-base text-ink/65">
            That&rsquo;s how most Filipino wedding vendors run a season today.
            Setnayan folds those jobs into one place — same business, fewer tabs.
          </p>
        </div>

        {/* Mobile: card stack */}
        <ul className="grid gap-3 sm:hidden">
          {ROWS.map((r) => (
            <li
              key={r.job}
              className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-4"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                {r.job}
              </p>
              <div className="flex items-start gap-2">
                <X
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-ink/40"
                  strokeWidth={1.75}
                />
                <p
                  className="text-sm text-ink/65"
                  dangerouslySetInnerHTML={{ __html: r.before }}
                />
              </div>
              <div className="flex items-start gap-2">
                <Check
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                  strokeWidth={1.75}
                />
                <p
                  className="text-sm font-medium text-ink"
                  dangerouslySetInnerHTML={{ __html: r.after }}
                />
              </div>
            </li>
          ))}
        </ul>

        {/* Desktop: 3-column table */}
        <div className="hidden overflow-x-auto rounded-xl border border-ink/10 sm:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  The job
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Today, across 5 apps
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  On Setnayan
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.job} className="border-t border-ink/5">
                  <th scope="row" className="w-1/4 px-4 py-3 align-top font-medium text-ink">
                    {r.job}
                  </th>
                  <td className="w-2/5 px-4 py-3 align-top text-ink/65">
                    <span className="inline-flex items-start gap-2">
                      <X
                        aria-hidden
                        className="mt-0.5 h-4 w-4 shrink-0 text-ink/40"
                        strokeWidth={1.75}
                      />
                      <span dangerouslySetInnerHTML={{ __html: r.before }} />
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top font-medium text-ink">
                    <span className="inline-flex items-start gap-2">
                      <Check
                        aria-hidden
                        className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                        strokeWidth={1.75}
                      />
                      <span dangerouslySetInnerHTML={{ __html: r.after }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
