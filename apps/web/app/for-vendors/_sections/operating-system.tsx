import { CalendarDays, Workflow, MessageSquare, FileText, Wallet, Star, type LucideIcon } from 'lucide-react';

// "The vendor operating system" — six tool cards mapping the surfaces a
// vendor actually touches. Sourced from iteration 0022 § 1 (the 6 vendor
// surfaces) plus § 5c (payment routing) and § 2.5 (proposal builder).

const TOOLS: Array<{
  Icon: LucideIcon;
  title: string;
  body: string;
  bullet: string;
}> = [
  {
    Icon: CalendarDays,
    title: 'Calendar',
    body: 'Per-service calendars roll up into one master view. Block dates, see your week, see the next year. Agents see only their own bookings; peers show as "Blocked · taken."',
    bullet: '1 master calendar · per-service filter · agent privacy redaction',
  },
  {
    Icon: Workflow,
    title: 'Pipeline',
    body: 'Five stages: Inquiry → Proposal Sent → Accepted → Active → Completed. Drag-and-drop on desktop, swipe on mobile. Every booking shows who on your team accepted it.',
    bullet: 'Inquiry → Proposal → Accepted → Active → Completed',
  },
  {
    Icon: MessageSquare,
    title: 'Chat',
    body: 'In-app text chat with couples and their planners. Customers see your business name + logo on every message — your individual senders stay anonymous unless you choose otherwise.',
    bullet: 'Couples · planners · video meetings (Pro)',
  },
  {
    Icon: FileText,
    title: 'Proposals',
    body: 'Per-client custom plan: pull a service from your catalog, override price for this couple, add or drop inclusions, attach milestones. Couple sees Accept / Counter / Decline in their dashboard.',
    bullet: 'Catalog-driven · per-client overrides · in-app accept',
  },
  {
    Icon: Wallet,
    title: 'Payments',
    body: 'Default: couple pays you direct (BDO / GCash) — Setnayan tracks the milestone, takes nothing. Or opt into Setnayan Pay: couple pays a 3% convenience fee, you receive the full quoted amount within 24h.',
    bullet: 'Direct payments · Setnayan Pay (couple pays 3%)',
  },
  {
    Icon: Star,
    title: 'Reviews',
    body: 'Reviews come only from couples who actually booked you on Setnayan — no drive-by ratings. Auto-emailed 24h after the event. You can post a public response on every review.',
    bullet: 'Verified couple-only · per-category scores · response built-in',
  },
];

export function OperatingSystem() {
  return (
    <section className="border-b border-ink/5 bg-cream">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            What you get on day one
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            The vendor operating system.
          </h2>
          <p className="text-base text-ink/65">
            Six surfaces. One login. Same Setnayan app the couples use — when
            you sign in, the app jumps you to the vendor side.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => {
            const { Icon } = t;
            return (
              <li
                key={t.title}
                className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="text-base font-semibold tracking-tight text-ink">
                  {t.title}
                </h3>
                <p className="text-sm text-ink/65">{t.body}</p>
                <p className="mt-auto pt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
                  {t.bullet}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
