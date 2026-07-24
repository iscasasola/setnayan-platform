import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Lock } from 'lucide-react';

/**
 * WebsiteProLock — the couple-facing "locked" state for a website editor that
 * now lives behind Couple Website PRO (owner 2026-07-24 split · Launch settings
 * design spec §3). Rendered ONLY when a couple is NOT PRO **and** has no
 * existing content for the feature (the grandfather rule — a couple that
 * already set content, or owns PRO, always sees the real editor). Never seven
 * separate buy buttons: one umbrella CTA into the existing Website PRO buy
 * surface (/dashboard/[eventId]/studio/website-pro). Presentation only — the
 * server action for each editor re-enforces the gate.
 *
 * `variant`:
 *   • 'page'   — full-page lock (whole editor is PRO, e.g. gallery / editorial).
 *   • 'inline' — a single card that replaces one PRO field inside an otherwise
 *                free editor (e.g. the background-music field on site-chrome).
 */
export function WebsiteProLock({
  eventId,
  featureName,
  description,
  backHref,
  variant = 'page',
}: {
  eventId: string;
  featureName: string;
  description: string;
  backHref?: string;
  variant?: 'page' | 'inline';
}) {
  const upsellHref = `/dashboard/${eventId}/studio/website-pro`;

  const card = (
    <div className="rounded-2xl border border-mulberry/20 bg-mulberry/5 p-6 sm:p-8">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-mulberry/10 text-mulberry">
        <Lock aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-mulberry">
        Part of Website PRO
      </p>
      <h2 className="mt-1 font-serif text-2xl italic tracking-tight text-ink sm:text-3xl">
        {featureName}
      </h2>
      <p className="mt-2 max-w-prose text-sm text-ink/70">{description}</p>
      <Link
        href={upsellHref}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream shadow-sm transition hover:bg-mulberry-600"
      >
        Unlock Website PRO
        <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
      </Link>
      <p className="mt-3 text-xs text-ink/45">
        One unlock covers every premium touch across your website — and removes
        the “Powered by Setnayan” footer.
      </p>
    </div>
  );

  if (variant === 'inline') return card;

  return (
    <section className="space-y-6">
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-terracotta hover:text-terracotta-700"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to website
        </Link>
      ) : null}
      {card}
    </section>
  );
}
