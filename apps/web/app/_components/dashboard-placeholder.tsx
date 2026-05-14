import type { LucideIcon } from 'lucide-react';

type Props = {
  Icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  blurb: string;
  features?: string[];
};

// Reusable placeholder for surfaces where the nav entry + route exist but
// the full feature ships in a follow-up PR. Renders a clean "coming soon"
// card with optional bullet list of what the surface will eventually do —
// concrete, not vapor-marketing.
export function DashboardPlaceholder({ Icon, eyebrow, title, blurb, features }: Props) {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          {Icon ? (
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
              <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </span>
          ) : null}
          <span className="rounded-full bg-ink/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            {eyebrow ?? 'Coming soon'}
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="max-w-prose text-base text-ink/65">{blurb}</p>
      </header>
      {features && features.length > 0 ? (
        <ul className="space-y-2 rounded-xl border border-dashed border-ink/15 bg-cream p-5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-ink/70">
              <span aria-hidden className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-terracotta" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
