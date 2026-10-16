'use client';

import { useEffect, useRef } from 'react';

// Fires a single, fire-and-forget view beacon when the public profile / chapter
// page mounts. Kept in a client island so the page itself stays ISR-cacheable:
// the aggregate view counter is bumped out of band (POST /api/u/view → atomic
// SECURITY DEFINER RPC, with first-party cookie dedup) instead of on the cached
// server render.
//
// ⚠ A ROUTE, NOT A SERVER ACTION (2026-10-13). The action set the dedup cookie,
// and a cookie-setting server action re-renders the page — whose new view count
// hydrated against the old one: React error #418 on every first visit to
// /u/<slug>. See app/api/u/view/route.ts.
//
// Renders nothing. A ref guards React StrictMode's double-mount in dev so a
// single page load never double-counts even before the cookie dedup kicks in.

type Props =
  | { kind: 'chapter'; id: string }
  | { kind: 'profile'; id: string };

export function ViewBeacon({ kind, id }: Props) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !id) return;
    fired.current = true;
    try {
      void fetch('/api/u/view', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, id }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* best-effort */
    }
  }, [kind, id]);
  return null;
}
