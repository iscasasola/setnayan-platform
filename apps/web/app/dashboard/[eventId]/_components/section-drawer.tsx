'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

/**
 * <SectionDrawer> — the in-place sheet an INTERCEPTED route renders into.
 *
 * Owner directive 2026-07-13 ("isolated loading, only what needs to load"):
 * for surfaces that are genuine NAVIGATIONS — the Studio App-Store detail, and
 * light sections like Orders / Activity — an accordion can't hold the
 * destination, so instead of a full-screen route swap (chrome gone + full-page
 * skeleton + everything re-fetched) the destination slides in OVER the current
 * screen. Only the intercepted segment loads; the page beneath stays mounted.
 *
 * HOW: a `@drawer` parallel slot on the event layout renders `(.)`-intercepting
 * routes here. Interception only fires on SOFT navigation from within the event
 * layout (a `<Link>` click) — a hard refresh / shared URL / back-forward
 * restore renders the FULL page instead, so the drawer is purely additive and
 * fail-safe. Closing pops the intercepted history entry (`router.back()`),
 * revealing the untouched page beneath.
 *
 * Right-anchored sheet on desktop, full-width on mobile. Locks body scroll,
 * closes on Esc / backdrop / the close button, and moves focus into the panel.
 */
export function SectionDrawer({
  children,
  label = 'Details',
  onClose,
}: {
  children: React.ReactNode;
  /** Accessible dialog name. */
  label?: string;
  /** Override the dismiss behaviour. Defaults to `router.back()` — the right
   *  action for an intercepted route (pop the intercepted history entry). */
  onClose?: () => void;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  const close = () => (onClose ? onClose() : router.back());

  useEffect(() => {
    // Enter transition on mount.
    setShown(true);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);

    // Lock the page beneath from scrolling while the sheet is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the sheet for keyboard + screen-reader users.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // close is a stable router.back closure; run this once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[70] flex justify-end"
    >
      {/* Backdrop — click to dismiss. */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={close}
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-200 ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Sheet */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-cream shadow-2xl outline-none transition-transform duration-200 ease-out ${
          shown ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-end border-b border-ink/5 bg-cream/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
          >
            <X className="h-5 w-5" aria-hidden strokeWidth={2} />
          </button>
        </div>
        <div className="px-4 pb-10 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
