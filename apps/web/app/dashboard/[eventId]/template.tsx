import type { ReactNode } from 'react';

/**
 * Event-shell route transition (Glass PR-2, 2026-07-15 · rollout plan § 2a).
 * App Router remounts this template on every in-shell PATHNAME change, so each
 * navigation inside `/dashboard/[eventId]/…` gets one soft rise (`.sn-page-enter`
 * → `sn-rise-soft`, 400ms). Search-param changes (`?show=all`) do NOT remount,
 * so filters correctly never replay the entrance. The prefers-reduced-motion
 * freeze (globals.css) snaps it to the end state.
 */
export default function EventShellTemplate({ children }: { children: ReactNode }) {
  return <div className="sn-page-enter">{children}</div>;
}
