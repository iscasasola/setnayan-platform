import { UserCog, Clock, CalendarRange } from 'lucide-react';

// Outsourcing, pacing, scheduling — recipient of the Section 7 content
// dropped from the homepage in the 2026-05-15 Decision 4 redesign
// (per /Users/icecasasola/Documents/Claude/Projects/Setnayan/0015_main_website/0015_main_website.md
// § "Replaced wholesale on 2026-05-15"). Three columns: outsourcing
// (planner / coordinator / stylist with role-scoped access), pacing
// (auto-generated milestones per event type), scheduling (unified calendar
// across iterations 0006 / 0007 / 0001).

const COLUMNS = [
  {
    Icon: UserCog,
    title: 'Outsourcing',
    sub: 'Bring in your planner, coordinator, or stylist &mdash; without handing over the whole account.',
    body: 'Setnayan supports role-scoped access for the people you bring in to help. A planner sees the full plan: budget, vendors, timeline. A day-of coordinator sees just the day-of run-of-show plus the vendors on the day. A stylist sees the mood board and the venue, nothing else. Each role has its own login, its own view, its own audit trail. Add or remove access in seconds &mdash; no shared passwords, no over-exposure.',
    items: [
      'Planner &mdash; full ledger, budget, vendor contracts, timeline.',
      'Day-of coordinator &mdash; run-of-show + day-of vendors only.',
      'Stylist &mdash; mood board, palette, venue diagrams.',
      'Family helper &mdash; guest list + RSVP tracking only.',
    ],
  },
  {
    Icon: Clock,
    title: 'Pacing',
    sub: 'Auto-generated milestones for every event type &mdash; you can&rsquo;t fall behind on a deadline you don&rsquo;t know about.',
    body: 'Tell Setnayan your event date and event type. Setnayan generates a milestone schedule for you &mdash; venue lock by month -10, photographer by -8, catering tasting by -5, RSVP cutoff by -2. Each milestone has a recommended action and a due date. Mark complete as you go; we adjust downstream milestones. Three event-type templates ship at V1.',
    items: [
      'Wedding &mdash; 12-month standard timeline.',
      'Corporate launch &mdash; 6-month timeline.',
      'Birthday &mdash; 2-month timeline.',
      'Custom &mdash; build your own from scratch.',
    ],
  },
  {
    Icon: CalendarRange,
    title: 'Scheduling',
    sub: 'One calendar for everything that has a date attached to it.',
    body: 'Vendor meetings, payment deadlines, RSVP cutoffs, dress fittings, food tastings, the day-of run-of-show &mdash; all rendered into a single calendar surface. Subscribe to the .ics feed; your phone&rsquo;s native calendar reflects the latest at all times. Filter by what you care about (vendors, payments, family events) and the unified view re-renders.',
    items: [
      'Vendor meetings &mdash; pulled from iteration 0006.',
      'Payment deadlines &mdash; pulled from iteration 0007.',
      'RSVP cutoffs &mdash; pulled from iteration 0001.',
      'Day-of run-of-show &mdash; the day, minute by minute.',
    ],
  },
];

export function OutsourcingPacing() {
  return (
    <section
      id="outsourcing-pacing"
      aria-labelledby="outsourcing-pacing-heading"
      className="scroll-mt-24 border-b border-ink/5"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-12 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Section 5 &middot; Operating layer
          </p>
          <h2
            id="outsourcing-pacing-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            Outsource what you can, pace what you can&rsquo;t, schedule what
            you must.
          </h2>
          <p className="text-base text-ink/65">
            Setnayan is the operating layer underneath the planning surface
            you see. Bring in helpers safely. Let the platform pace the
            work for you. Keep one calendar that reflects everything with a
            date on it.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const { Icon } = col;
            return (
              <article
                key={col.title}
                className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-cream p-6"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h3 className="text-2xl font-semibold tracking-tight text-ink">
                  {col.title}
                </h3>
                <p
                  className="text-sm font-medium text-ink/80"
                  dangerouslySetInnerHTML={{ __html: col.sub }}
                />
                <p
                  className="text-sm text-ink/65"
                  dangerouslySetInnerHTML={{ __html: col.body }}
                />
                <ul className="mt-2 space-y-2 border-t border-ink/5 pt-4">
                  {col.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-xs text-ink/65"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta"
                      />
                      <span dangerouslySetInnerHTML={{ __html: item }} />
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
