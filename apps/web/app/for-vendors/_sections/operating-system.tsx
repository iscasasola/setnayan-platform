import { Workflow, Wallet, Star, type LucideIcon } from 'lucide-react';

// Vendor outcome strip — 3 tiles, outcome-led copy. Trimmed from 6 tiles
// on 2026-05-18 (owner directive — "too documentary, want light and
// powerful"). The other surfaces (Calendar, Chat, Proposals) live in the
// dashboard mockup in the hero — vendors see them visually rather than
// reading about them here.

const TOOLS: Array<{ Icon: LucideIcon; title: string; body: string }> = [
  {
    Icon: Workflow,
    title: 'Pipeline that pays',
    body: 'Inquiry → Proposal → Booked → Done. Every couple in one view. Drag, swipe, never lose a lead in a chat thread.',
  },
  {
    Icon: Wallet,
    title: 'Keep 100% of bookings',
    body: 'Setnayan never sits between you and your couple at checkout. Settle direct (bank transfer, GCash, in-person) and keep every peso. We sell software — not commission.',
  },
  {
    Icon: Star,
    title: 'Reviews that close deals',
    body: 'Real reviews from couples who actually booked you — no drive-by ratings. Auto-emailed after the event. Your reply ships with every one.',
  },
];

export function OperatingSystem() {
  return (
    <section className="border-b border-ink/5 bg-cream">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="mb-12 max-w-2xl space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Built to scale
          </p>
          <h2 className="text-balance font-display text-5xl font-medium tracking-tight sm:text-6xl">
            Less chasing. More booking.
          </h2>
        </div>
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {TOOLS.map((t) => {
            const { Icon } = t;
            return (
              <li
                key={t.title}
                className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-cream p-6 transition-colors hover:border-terracotta/40"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
                  <Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h3 className="text-lg font-semibold tracking-tight text-ink">
                  {t.title}
                </h3>
                <p className="text-sm leading-relaxed text-ink/65">{t.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
