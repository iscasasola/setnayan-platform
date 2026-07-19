import type { ReactNode } from 'react';

/**
 * Vendor-shell route transition (Glass PR-6, 2026-07-15 · rollout plan § 2a).
 * App Router remounts this template on every in-shell PATHNAME change, so each
 * navigation inside `/vendor-dashboard/…` gets one soft rise (`.sn-page-enter`
 * → `sn-rise-soft`, 400ms). Search-param changes (`?tab=…`) do NOT remount, so
 * filters correctly never replay the entrance. The prefers-reduced-motion
 * freeze (globals.css) snaps it to the end state. Twin of the event shell's
 * `dashboard/[eventId]/template.tsx`.
 */
export default function VendorShellTemplate({ children }: { children: ReactNode }) {
  return <div className="sn-page-enter">{children}</div>;
}
