'use client';

/**
 * SignInHereLink — a Sign-in control a SERVER component can render.
 *
 * The surfaces that most need the seam are server-rendered: the public shop
 * page (`app/v/[slug]/page.tsx`), the marketplace, the article reader. They
 * cannot call `useSignInHere()` themselves, and each hand-rolling its own
 * client wrapper is how five copies of one behaviour start. This is the one
 * copy.
 *
 * ⚠ IT IS A REAL LINK, AND THAT IS LOAD-BEARING — not a styled <button>.
 *   • <Link> server-renders a real <a href>, so it works with JavaScript off
 *     and before hydration.
 *   • It works if the provider is ever unmounted (the press is intercepted
 *     ONLY when the panel is actually available), so this can never become a
 *     control that looks pressable and does nothing.
 *   • Middle-click and open-in-new-tab keep working, which people genuinely do
 *     with a sign-in link.
 * `href` is that fallback destination, and callers pass it EXPLICITLY rather
 * than letting this file assume it. Two reasons, one of them measured:
 *   • it is the honest shape — the call site is choosing where a person goes
 *     when the panel is unavailable, and that is a decision worth reading at
 *     the call site;
 *   • `lint-port-no-lost-controls.mjs` scans a ROUTE'S OWN FILES for where it
 *     can send you. Hiding `/login` inside this shared component made the shop
 *     page look like it had lost its sign-in — and the sanctioned fix for a
 *     "loss" is to write it into the baseline, i.e. to record a removal that
 *     never happened. The destination stays where the guard, and a reader, can
 *     see it.
 * The current path is appended as `?next=` at render so even that fallback
 * comes back here instead of dumping the visitor on the account board.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSignInHere } from './sign-in-here';

export function SignInHereLink({
  href = '/login',
  className,
  children,
  title,
}: {
  /** Where the press goes with no JavaScript / no panel mounted. */
  href?: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  const signInHere = useSignInHere();
  /*
    ⚠ PATHNAME ONLY — no `useSearchParams()`. This link is rendered BY SERVER
    COMPONENTS (the public shop page), and `useSearchParams` in their tree opts
    those pages out of static rendering. The href is the no-JavaScript fallback
    and a path is enough to come back to; the panel that actually opens reads
    the full URL, query and all, from `window` at press time.
  */
  const pathname = usePathname();
  const here = pathname ?? '/';
  const fallback = here === '/' ? href : `${href}?next=${encodeURIComponent(here)}`;

  return (
    <Link
      href={fallback}
      prefetch={false}
      className={className}
      title={title}
      aria-haspopup="dialog"
      onClick={(e) => {
        if (!signInHere.available) return;
        // Let the browser handle the presses that mean "somewhere else":
        // new tab, new window, download, or a non-primary button.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        signInHere.open();
      }}
    >
      {children}
    </Link>
  );
}
