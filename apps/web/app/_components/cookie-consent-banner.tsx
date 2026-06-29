'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  readConsent,
  writeConsent,
  OPEN_CONSENT_EVENT,
} from '@/lib/cookie-consent';

// Site-wide cookie-consent banner under RA 10173. Mounted once in the root
// layout so it appears on every route, including the homepage. Reads/writes
// consent via lib/cookie-consent and gates PostHog analytics. "Cookie
// settings" links anywhere re-open it via OPEN_CONSENT_EVENT.
export function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [decided, setDecided] = useState(true);
  const [manage, setManage] = useState(false);
  const [analytics, setAnalytics] = useState(true);

  useEffect(() => {
    setMounted(true);
    const c = readConsent();
    setDecided(c !== null);
    setAnalytics(c?.analytics ?? true);
    const onOpen = () => {
      setDecided(false);
      setManage(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, onOpen);
  }, []);

  if (!mounted || decided) return null;

  const choose = (a: boolean) => {
    writeConsent(a);
    setDecided(true);
    setManage(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl border border-ink/10 bg-cream/95 p-4 text-sm text-ink/80 shadow-lg backdrop-blur sm:inset-x-auto sm:right-4 sm:bottom-4"
    >
      {!manage ? (
        <>
          <p>
            We use essential cookies to run Setnayan, and optional analytics to
            improve it.{' '}
            <Link href="/cookies" className="text-terracotta hover:underline">
              Cookie policy
            </Link>
            .
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => choose(true)}
              className="rounded-full bg-terracotta px-4 py-1.5 text-xs font-semibold text-cream hover:opacity-90"
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={() => choose(false)}
              className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink/70 hover:text-ink"
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => setManage(true)}
              className="px-2 py-1.5 text-xs text-ink/55 hover:text-ink"
            >
              Manage
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="font-semibold text-ink">Cookie settings</p>
          <label className="mt-3 flex items-center justify-between gap-3">
            <span>
              <strong>Essential</strong> · keeps you signed in · always on
            </span>
            <input type="checkbox" checked disabled aria-label="Essential cookies (always on)" />
          </label>
          <label className="mt-2 flex items-center justify-between gap-3">
            <span>
              <strong>Analytics</strong> · helps us improve
            </span>
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
              aria-label="Analytics cookies"
            />
          </label>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Link href="/cookies" className="px-2 py-1.5 text-xs text-ink/55 hover:text-ink">
              Learn more
            </Link>
            <button
              type="button"
              onClick={() => choose(analytics)}
              className="rounded-full bg-terracotta px-4 py-1.5 text-xs font-semibold text-cream hover:opacity-90"
            >
              Save
            </button>
          </div>
        </>
      )}
    </div>
  );
}
