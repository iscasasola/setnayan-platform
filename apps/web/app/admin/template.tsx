import type { ReactNode } from 'react';

/**
 * Admin-shell route transition (Glass PR-8, 2026-07-15 · rollout plan § 2a).
 * App Router remounts this template on every in-shell PATHNAME change, so each
 * navigation across the `/admin/…` console (overview · payments · verify ·
 * disputes · the long-tail queues) gets one soft rise (`.sn-page-enter` →
 * `sn-rise-soft`, 400ms). Search-param changes (`?filter=pending`) do NOT
 * remount, so in-page filters correctly never replay the entrance. The
 * prefers-reduced-motion freeze (globals.css) snaps it to the end state.
 */
export default function AdminShellTemplate({ children }: { children: ReactNode }) {
  return <div className="sn-page-enter">{children}</div>;
}
