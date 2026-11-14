'use client';

/**
 * Client shell for `<DemoModeBanner>`.
 *
 * The wrapper decides whether to render at all (admin + cookie set).
 * This piece draws it as a live notice whose "Hide" the one notice
 * memory keeps for the day.
 *
 * Hiding the banner does NOT turn demo mode off — the cookie
 * remains live so demo vendors keep surfacing on /vendors and
 * /v/[slug]. To turn demo mode off entirely, the admin uses the
 * toggle at /admin/settings/demo-mode.
 */

import { LazyInlineNotice } from './notices/inline-notice-lazy';

/**
 * 🔔 Inventory #45 — "Demo mode active", a LIVE notice (warning) in the one notice system (owner approved 14 Nov 2026).
 * Admin-only (the status route decides). "Hide" is kept by the one notice memory for the day (it was per tab); the
 * fact is still true tomorrow, so it comes back. Demo shops are permanent and public, marked "(DEMO ONLY)" (owner,
 * DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS"); the Dec-1 "must be cleaned out" deadline is retired.
 */
export function DemoModeBannerClient() {
  return (
    <aside className="px-4 pt-2">
      <LazyInlineNotice
        kind="live"
        tone="warning"
        noticeKey={`demo-mode:${new Date().toISOString().slice(0, 10)}`}
        title="Demo mode active"
        detail="Demo shops show their prices publicly. Real-supplier posture is unchanged."
      />
    </aside>
  );
}
