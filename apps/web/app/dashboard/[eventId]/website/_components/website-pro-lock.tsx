import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';
import { isStoreShellRequest } from '@/lib/request-platform';

/**
 * WebsiteProLock — the couple-facing "locked" state for a website editor that
 * now lives behind Couple Website PRO (owner 2026-07-24 split · Launch settings
 * design spec §3). Rendered ONLY when a couple is NOT PRO **and** has no
 * existing content for the feature (the grandfather rule — a couple that
 * already set content, or owns PRO, always sees the real editor). Never seven
 * separate buy buttons: one umbrella CTA into the existing Event Hub PRO buy
 * surface (/dashboard/[eventId]/studio/website-pro). Presentation only — the
 * server action for each editor re-enforces the gate.
 *
 * `variant`:
 *   • 'page'   — full-page lock (whole editor is PRO, e.g. gallery / editorial).
 *   • 'inline' — a single card that replaces one PRO field inside an otherwise
 *                free editor (e.g. the background-music field on site-chrome).
 *
 * 🔒 IN THE STORE SHELL THERE IS NO LOCK TO SHOW (sweep 2026-10-19 row C14).
 * Event Hub PRO is a digital unlock with no In-App Purchase yet, so the app
 * may not advertise it (guideline 3.1.1). `StoreShellLinkGuard` already hid
 * the "Unlock Event Hub PRO" button (its href is a refused /studio route),
 * which left the card's "Part of Event Hub PRO" / "One unlock covers…" words
 * on screen with nothing to press — an upsell with the door removed. So the
 * card is not drawn at all: 'inline' renders nothing (the field is simply not
 * there, like every other web-only feature), 'page' says only that this part
 * is not in the app, with the way back. Never a price, a feature pitch, or a
 * pointer to where else it lives.
 */
export async function WebsiteProLock({
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
  if (await isStoreShellRequest()) {
    if (variant === 'inline') return null;
    return (
      <section className="space-y-6">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-terracotta hover:text-terracotta-700"
          >
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Back to Event Hub
          </Link>
        ) : null}
        <p className="max-w-prose text-sm text-ink/75">This part of your Event Hub is not included in the app.</p>
      </section>
    );
  }

  const upsellHref = `/dashboard/${eventId}/studio/website-pro`;

  const card = (
    <div className="rounded-card bg-[var(--m-paper-2)] p-4 sm:p-6">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-mulberry/10 text-mulberry">
        <PaidMark state="locked" label={paidMarkLabel('locked', 'Event Hub Pro')} size="lg" tone="current" />
      </span>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
        Part of Event Hub PRO
      </p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">
        {featureName}
      </h2>
      <p className="mt-2 max-w-prose text-sm text-ink/75">{description}</p>
      <Link
        href={upsellHref}
        className="ab ab-brand ab-main mt-5"
      >
        Unlock Event Hub PRO
        <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
      </Link>
      <p className="mt-3 text-[13px] text-ink/75">
        One unlock covers every premium touch across your Event Hub — and removes
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
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-terracotta-700 hover:underline"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to Event Hub
        </Link>
      ) : null}
      {card}
    </section>
  );
}
