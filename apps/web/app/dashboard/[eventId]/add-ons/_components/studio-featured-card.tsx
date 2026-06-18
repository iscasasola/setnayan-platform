import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';

/**
 * StudioFeaturedCard — the large App Store "featured" hero that leads each
 * Studio section. The feature's poster gradient fills the card; an eyebrow,
 * title, and tagline sit on top in cream, with a GET/price/status pill and a
 * "Learn more" affordance. Whole card → the feature's App Store detail page.
 *
 * Server component — Link only. Cream-on-gradient; the poster baseBackgrounds
 * are deep enough for AA contrast against cream text.
 */

type Props = {
  href: string;
  eyebrow: string;
  label: string;
  tagline: string;
  Icon: LucideIcon;
  gradient: string;
  /** Short GET/price/status label — "Free", "₱2,999", "Active", "Free to try". */
  pillText: string;
};

export function StudioFeaturedCard({
  href,
  eyebrow,
  label,
  tagline,
  Icon,
  gradient,
  pillText,
}: Props) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-3xl p-6 text-cream shadow-[var(--m-shadow-md)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 sm:p-7"
      style={{ background: gradient }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent"
      />
      <span className="relative flex flex-col gap-4">
        <span className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-cream/75">
            {eyebrow}
          </span>
          <span
            aria-hidden
            className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/15 text-cream backdrop-blur-sm"
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </span>
        </span>

        <span className="block">
          <span className="block text-2xl font-semibold tracking-tight sm:text-[28px]">
            {label}
          </span>
          <span className="mt-1.5 block max-w-md text-sm leading-relaxed text-cream/85">
            {tagline}
          </span>
        </span>

        <span className="flex items-center gap-3">
          <span className="rounded-full bg-cream px-4 py-1.5 text-sm font-bold tracking-tight text-ink">
            {pillText}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-cream/90">
            Learn more
            <ArrowRight
              aria-hidden
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </span>
        </span>
      </span>
    </Link>
  );
}
