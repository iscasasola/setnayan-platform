import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

/**
 * Customer Card — the five-step pipeline strip + the tab rail.
 *
 * Design source: 03_Strategy/Customer_Card_Prototype_2026-07-03.html (View 2).
 * Both are pure server render; the tab rail is `?tab=` Link-driven so the whole
 * card stays a server component (no client state). Mobile: the tab rail is a
 * horizontally scrollable pill row; the pipeline strip scrolls too.
 */

export type CustomerCardTab = 'overview' | 'quote' | 'files' | 'schedule' | 'activity';

export const CARD_TABS: { key: CustomerCardTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'quote', label: 'Quote & Payments' },
  { key: 'files', label: 'Files' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'activity', label: 'Activity' },
];

export function normalizeTab(raw: string | undefined): CustomerCardTab {
  return CARD_TABS.some((t) => t.key === raw) ? (raw as CustomerCardTab) : 'overview';
}

export function CardTabs({
  eventId,
  active,
}: {
  eventId: string;
  active: CustomerCardTab;
}) {
  return (
    <nav
      aria-label="Customer card sections"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:gap-1 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {CARD_TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={
              t.key === 'overview'
                ? `/vendor-dashboard/clients/${eventId}`
                : `/vendor-dashboard/clients/${eventId}?tab=${t.key}`
            }
            aria-current={on ? 'page' : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition sm:rounded-none sm:border-x-0 sm:border-t-0 sm:border-b-2 sm:px-3 sm:py-2 ${
              on
                ? 'border-ink bg-ink text-cream sm:border-terracotta sm:bg-transparent sm:text-ink'
                : 'border-ink/15 bg-white text-ink/60 hover:text-ink sm:border-transparent sm:bg-transparent'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Pipeline strip: Inquiry → Quoted → Booked → Delivered → Reviewed.
//
// `reached` = index (0-based) of the furthest step the vendor has reached
// (that step + everything before it render as "done"); `current` = the step
// the card highlights as the live stage. `capAt` truncates the strip when a
// later step's data isn't cheaply readable (e.g. reviews) — passed as the last
// renderable index.
// ---------------------------------------------------------------------------

const PIPELINE_STEPS: { key: string; label: string }[] = [
  { key: 'inquiry', label: 'Inquiry' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'booked', label: 'Booked' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'reviewed', label: 'Reviewed' },
];

export function PipelineStrip({
  reached,
  current,
  capAt = PIPELINE_STEPS.length - 1,
}: {
  reached: number;
  current: number;
  capAt?: number;
}) {
  const steps = PIPELINE_STEPS.slice(0, capAt + 1);
  return (
    <ol
      aria-label="Booking pipeline"
      className="-mx-4 flex items-center gap-0 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {steps.map((s, i) => {
        const done = i < current || i <= reached;
        const isCurrent = i === current;
        return (
          <li key={s.key} className="flex shrink-0 items-center">
            <span className="flex shrink-0 items-center gap-2">
              <span
                aria-hidden
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold ${
                  isCurrent
                    ? 'border-ink bg-ink text-cream ring-4 ring-ink/10'
                    : done
                      ? 'border-success-600 bg-success-600 text-white'
                      : 'border-ink/15 bg-white text-ink/40'
                }`}
              >
                {done && !isCurrent ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} /> : i + 1}
              </span>
              <span
                className={`whitespace-nowrap text-xs font-medium ${
                  isCurrent ? 'text-ink' : done ? 'text-ink/70' : 'text-ink/40'
                }`}
              >
                {s.label}
              </span>
            </span>
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className={`mx-2 h-0.5 w-6 shrink-0 ${done ? 'bg-success-600' : 'bg-ink/15'}`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
