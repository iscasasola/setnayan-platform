'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// Section 1 — Announcement bar (iteration 0015 § Section 1)
// Persistent strip at top of every marketing page; dismissible per session.
// Hide condition per spec: auto-hides when `verified_vendor_count >= 500`
// (boost-service launch gate). That hide-logic is widget-registry territory;
// the static placeholder here always renders unless the user dismisses it
// for the session. The TODO is logged in apps/web/app/page.tsx.

// gitleaks:allow — sessionStorage key for announcement-bar dismissal, not a credential
const DISMISS_STORAGE_KEY = 'sn-banner-dismissed';

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_STORAGE_KEY) === '1') {
        setDismissed(true);
      }
    } catch {
      // sessionStorage can throw in private-mode Safari etc.; fail open.
    }
  }, []);

  // Render the bar by default so SSR HTML matches first-paint and we don't
  // ship CLS by popping the strip in after hydration. Visitors who have
  // already dismissed it get a brief flash on return; that trade-off
  // protects the much more common first-load CLS that Lighthouse measures.
  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Site announcement"
      className="border-b border-ink/10 bg-ink text-cream"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6 sm:text-sm lg:px-8">
        <p className="flex-1 leading-snug">
          <span aria-hidden className="mr-2">
            ✦
          </span>
          Vendors pre-register today · Couples launch{' '}
          <span className="font-semibold">December 1, 2026</span>.{' '}
          <Link
            href="/signup?as=vendor"
            className="font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
          >
            Vendor sign-up &rarr;
          </Link>
          <span className="hidden sm:inline">
            {' '}·{' '}
            <Link
              href="/waitlist"
              className="font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
            >
              Couple waitlist &rarr;
            </Link>
          </span>
        </p>
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={() => {
            setDismissed(true);
            try {
              sessionStorage.setItem(DISMISS_STORAGE_KEY, '1');
            } catch {
              /* noop */
            }
          }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cream/70 transition-colors hover:bg-cream/10 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
