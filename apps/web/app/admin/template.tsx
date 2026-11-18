import type { ReactNode } from 'react';
import './_components/admin-look.css';

/**
 * Admin-shell route transition (Glass PR-8, 2026-07-15 · rollout plan § 2a).
 * App Router remounts this template on every in-shell PATHNAME change, so each
 * navigation across the `/admin/…` console (overview · payments · verify ·
 * disputes · the long-tail queues) gets one soft rise (`.sn-page-enter` →
 * `sn-rise-soft`, 400ms). Search-param changes (`?filter=pending`) do NOT
 * remount, so in-page filters correctly never replay the entrance. The
 * prefers-reduced-motion freeze (globals.css) snaps it to the end state.
 *
 * ⚫ `data-admin-look` turns on the admin dashboard's MONOCHROME look (owner 19 Nov 2026: "black and white … buttons
 * will stay colord. just the background. same effects") while an admin page is on screen — `_components/admin-look.css`
 * re-points the colour tokens on <html> for as long as it is present. Tokens only; no component is recoloured.
 */
export default function AdminShellTemplate({ children }: { children: ReactNode }) {
  return (
    <div className="sn-page-enter" data-admin-look="">
      {children}
    </div>
  );
}
