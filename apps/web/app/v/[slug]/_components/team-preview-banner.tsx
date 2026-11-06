import Link from 'next/link';
import { EyeOff } from 'lucide-react';
import { TEAM_PREVIEW_COPY, TEAM_PREVIEW_HEAD, type ShopPreviewReason } from '@/lib/own-shop-preview';

/**
 * The band a shop's owner and helpers see on their own page before couples can (lib/own-shop-preview.ts).
 *
 * Owner, 23 Oct 2026: the page must say who can see it, what couples are waiting on, and the next step as a button.
 * A band, not a card — frames go only on what you press, so the one framed thing here is the button (44 px).
 * `data-team-preview` carries the reason so a walk and a guard can read which state was drawn.
 */
export function TeamPreviewBanner({ reason }: { reason: ShopPreviewReason }) {
  const copy = TEAM_PREVIEW_COPY[reason];
  return (
    <section
      aria-label="Only your team can see this page"
      data-team-preview={reason}
      className="border-b border-ink/10 bg-ink/[0.04]"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-6 lg:px-8">
        <EyeOff aria-hidden className="hidden h-5 w-5 shrink-0 text-ink/60 sm:block" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">{TEAM_PREVIEW_HEAD}</p>
          <p className="mt-0.5 text-sm text-ink/70">{copy.line}</p>
        </div>
        <Link
          href={copy.action.href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-cream transition-colors hover:bg-ink/85"
        >
          {copy.action.label}
        </Link>
      </div>
    </section>
  );
}
