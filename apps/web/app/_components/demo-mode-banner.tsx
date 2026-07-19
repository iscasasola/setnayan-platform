'use client';

/**
 * Sitewide "demo mode is active" banner (admin-only).
 *
 * Previously a SERVER component that read cookies() + auth.getUser() on every
 * render. Because it mounts from the root layout, that cookies() call forced
 * EVERY route — including the marketing homepage — into dynamic rendering (no
 * edge cache). It's now a CLIENT component so the root layout no longer touches
 * cookies() during SSR, which lets the public pages be statically/ISR-cached.
 *
 * How it stays cheap AND secure:
 *   · It reads the non-httpOnly PRESENCE HINT cookie (setnayan_demo_mode_hint)
 *     client-side. Absent (the case for ~every visitor) → it renders nothing and
 *     makes NO network request, so the static page pays zero per-load cost.
 *   · Present → it fetches /api/demo-mode/status, where the AUTHORITATIVE check
 *     lives server-side (httpOnly cookie + admin verification). A non-admin with
 *     a stale hint cookie gets { show: false } and sees nothing.
 *
 * The per-session dismiss flag + editorial copy live in DemoModeBannerClient.
 * (Perf sweep 2026-07-02, homepage ISR.)
 */

import { useEffect, useState } from 'react';
import { DEMO_MODE_HINT_COOKIE_NAME } from '@/lib/demo-mode-constants';
import { DemoModeBannerClient } from './demo-mode-banner-client';

type Status = { show: boolean; deadlineLabel?: string };

export function DemoModeBanner() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    // Only ask the server when the non-httpOnly hint cookie is present. Normal
    // visitors (no demo mode) never trigger a request.
    const hasHint = document.cookie
      .split('; ')
      .some((c) => c === `${DEMO_MODE_HINT_COOKIE_NAME}=1`);
    if (!hasHint) return;

    let cancelled = false;
    fetch('/api/demo-mode/status', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Status>) : { show: false }))
      .then((d) => {
        if (!cancelled) setStatus(d);
      })
      .catch(() => {
        /* banner is best-effort — a failed check simply shows nothing */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status?.show) return null;
  return <DemoModeBannerClient deadlineLabel={status.deadlineLabel ?? ''} />;
}
