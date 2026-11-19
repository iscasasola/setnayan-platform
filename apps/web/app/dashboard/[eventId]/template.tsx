import type { ReactNode } from 'react';

/**
 * Event-shell route transition (Glass PR-2, 2026-07-15 · rollout plan § 2a).
 * App Router remounts this template on every in-shell PATHNAME change, so each
 * navigation inside `/dashboard/[eventId]/…` gets one soft rise (`.sn-page-enter`
 * → `sn-rise-soft`, the standard's Move on Settle — Enter). Search-param changes (`?show=all`) do NOT remount,
 * so filters correctly never replay the entrance. The prefers-reduced-motion
 * freeze (globals.css) snaps it to the end state.
 *
 * → PUSH (motion standard 18 Nov 2026, § 5 #30): a page DEEPER in its section arrives from the right and its Back from
 * the left — `NavSlideController` marks `html[data-sn-push]`, and `.sn-page-enter` reads it (globals.css). A first load
 * and a sideways link keep Enter. Fill is `backwards`, never `both`.
 * 🔒 app/_components/nav/the-screens-move-by-the-standard.test.ts
 */
export default function EventShellTemplate({ children }: { children: ReactNode }) {
  return <div className="sn-page-enter">{children}</div>;
}
