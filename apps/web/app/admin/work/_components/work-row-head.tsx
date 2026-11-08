'use client';

/**
 * The pressable head of one Admin › Work supplier row. The row is URL-driven (`?item=` — a plain link, bookmarkable,
 * JS off still works), so the server page stays a Server Component and only this head is client: it joins the ONE
 * reveal rule (owner 2026-11-04, app-wide — `useRevealOnOpen`). A tap that opens a row on a phone, where the body opens
 * IN PLACE under it, glides the row's head to the pin line once the body settles if it runs past the bottom.
 *
 * The open is a soft navigation — the body arrives a round trip after the press — so the press stays good for a while
 * (`intentMs`, the same call as `FeatureAccordion`). A row that is open on load (a bookmarked `?item=`) never moves.
 * From `md` the body is a fixed right-side panel; the row itself then fits, so nothing glides.
 */
import Link from 'next/link';
import { useRef, type ReactNode } from 'react';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';

export function WorkRowHead({ open, href, children }: { open: boolean; href: string; children: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const intend = useRevealOnOpen(open, () => ({ head: ref.current?.closest('li') ?? ref.current }), { intentMs: 10000 });
  return (
    <Link
      ref={ref}
      href={href}
      aria-expanded={open}
      className="sn-row flex min-h-16 items-center gap-3 p-3.5"
      scroll={false}
      onClick={() => {
        if (!open) intend();
      }}
    >
      {children}
    </Link>
  );
}
