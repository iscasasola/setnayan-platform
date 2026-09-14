'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * lens-pill.tsx — one facet pill (Side / RSVP / View / Tags), with the payload
 * fetched while the pointer is still travelling toward it.
 *
 * ── WHY THIS IS A CLIENT COMPONENT ────────────────────────────────────────
 * Owner, 2026-09-14: "clicking here takes a lot of time to show."
 *
 * Every facet is a `<Link>`, so a click is a FULL SERVER NAVIGATION: auth, five
 * parallel reads, the JS filter, an RSC render, the transfer. Measured the same
 * day, the roster query itself runs in **1.2 ms** — so essentially none of that
 * wait is the database. It is the round trip.
 *
 * 🔑 AND THE ROUND TRIP RECOMPUTES NOTHING NEW. No facet reaches SQL: the page
 * fetches the identical roster every time and filters it in JavaScript. The
 * click pays for a render of data that did not change.
 *
 * The structural fix is to filter on the client and stop navigating at all.
 * This is the cheap half of it, and it is worth having on its own: warm the
 * payload on HOVER / FOCUS, so the click lands on a cache instead of starting a
 * round trip.
 *
 * ── WHY HOVER AND NOT `prefetch` ──────────────────────────────────────────
 * `<Link prefetch>` on a dynamic route warms the payload when the link enters
 * the VIEWPORT. Every pill is on screen at once — Side, RSVP, the seven views,
 * every group, every tag — so that would fire ~25 full page renders on every
 * load, competing with the render the host is actually waiting for. Making the
 * first paint slower to make a later click faster is the wrong trade.
 *
 * Hover costs nothing until the host reaches for a pill, and the reach itself
 * (pointer travel plus the decision) is the budget the fetch spends. Focus is
 * wired too so keyboard tabbing gets the same benefit.
 *
 * `router.prefetch` is idempotent and Next caches the result briefly, so
 * sweeping the pointer across the row does not re-fetch each pill.
 */
export function LensPill({
  href,
  active,
  children,
  count,
  dot,
  title,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  count?: number;
  dot?: string;
  title?: string;
}) {
  const router = useRouter();

  // Nothing to warm for the pill already applied — its href is the page the
  // host is standing on.
  const warm = () => {
    if (!active) router.prefetch(href);
  };

  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      title={title}
      onMouseEnter={warm}
      onFocus={warm}
      // Off by default: see the docblock. Viewport prefetching every pill would
      // slow the very render the host is waiting for.
      prefetch={false}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-[background-color,transform,color] ${
        active
          ? 'sn-chip-pop border-transparent bg-terracotta font-bold text-cream'
          : 'border-ink/15 bg-white/55 text-ink/70 hover:bg-white/85'
      }`}
    >
      {dot ? <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} /> : null}
      <span className="whitespace-nowrap">{children}</span>
      {typeof count === 'number' ? (
        <span
          className={`font-mono tabular-nums ${active ? 'text-cream/75' : 'text-ink/40'}`}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
