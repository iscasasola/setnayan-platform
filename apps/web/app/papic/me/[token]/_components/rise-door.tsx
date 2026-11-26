'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

/**
 * ⤴ A door on My photos that RISES its page over this one (final check A4-55 / A4-81, approved drawing §§ 05–06).
 *
 * Decorate and Everyone's photos read the guest's pass (the session), which this token page does not hold — so their
 * door has always been the token → session bridge (`./session`, a GET that writes the pass and redirects). That stays
 * the link's own `href`: without script, or on any failure, the door still works exactly as before (two hops, full page).
 *
 * With script the same bridge is asked in the background first (it writes the pass; its redirect is not followed),
 * then a soft navigation to the page itself, which the `@rise` slot intercepts and draws risen over My photos — no
 * second hop, no full reload, and ✕ / Back land back here at the same scroll. No new server action: the bridge is the
 * one that already writes this pass.
 */
export function RiseDoor({
  href,
  pageHref,
  className,
  children,
}: {
  /** The token → session bridge (`/papic/me/<token>/session?next=…`) — the link without script. */
  href: string;
  /** The page the bridge would land on (`/papic/decorate` · `/papic/pool`), opened risen. */
  pageHref: '/papic/decorate' | '/papic/pool';
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  return (
    <a
      href={href}
      aria-busy={opening || undefined}
      className={className}
      onClick={async (e) => {
        // A new tab, a modified click: the plain link, as always.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        if (opening) return;
        setOpening(true);
        try {
          await fetch(href, { redirect: 'manual', credentials: 'same-origin', cache: 'no-store' });
          router.push(pageHref);
        } catch {
          // The bridge could not be reached in the background: take the plain door instead.
          window.location.assign(href);
        } finally {
          setOpening(false);
        }
      }}
    >
      {children}
    </a>
  );
}
