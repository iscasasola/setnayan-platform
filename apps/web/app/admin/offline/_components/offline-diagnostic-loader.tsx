'use client';

/**
 * OfflineDiagnosticLoader — client wrapper around `next/dynamic` for the
 * offline diagnostic panel.
 *
 * WHY · Next.js 15 forbids `dynamic({ ssr: false })` inside a Server
 *       Component (`/admin/offline/page.tsx`). The page itself wants to
 *       stay a Server Component so the `metadata` + admin chrome render
 *       on the server, but `<OfflineDiagnostic>` reaches `window.indexedDB`
 *       which would crash during SSR. This thin Client Component boundary
 *       hosts the dynamic import so the SSR-disabled load happens entirely
 *       inside the client subtree.
 *
 *       Symmetric with the pattern Next.js docs recommend for client-only
 *       libraries in App Router. The 6-line wrapper is the smallest diff
 *       that unblocks builds — extracted instead of marking the whole page
 *       `'use client'` because the page's header + note panel don't need
 *       client-side state and benefit from server rendering.
 *
 *       This file unblocks every Vercel production deploy from PR #623
 *       (V2 Phase G offline daemon · merged 2026-05-29T08:55Z) onward.
 *       Before this fix, `next build` errored with:
 *         `ssr: false` is not allowed with `next/dynamic` in Server
 *         Components. Please move it into a Client Component.
 */

import dynamic from 'next/dynamic';

const OfflineDiagnostic = dynamic(
  () => import('./offline-diagnostic'),
  {
    ssr: false,
    loading: () => (
      <div className="m-card p-6 text-sm text-ink-soft">
        Loading offline diagnostic…
      </div>
    ),
  },
);

export function OfflineDiagnosticLoader() {
  return <OfflineDiagnostic />;
}
