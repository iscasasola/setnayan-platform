import type { ReactNode } from 'react';

/**
 * Account-spoke route transition (Glass PR-5, 2026-07-15 · rollout plan § 2a).
 * App Router remounts this template on every in-shell PATHNAME change, so each
 * navigation between the `(account)` spokes (profile · people · library ·
 * setnayan-ai · notifications · year · create-event · api-keys · life-flash ·
 * samahan) gets one soft rise (`.sn-page-enter` → `sn-rise-soft`, 400ms).
 * Search-param changes do NOT remount, so in-page filters correctly never
 * replay the entrance. The prefers-reduced-motion freeze (globals.css) snaps it
 * to the end state.
 */
export default function AccountShellTemplate({ children }: { children: ReactNode }) {
  return <div className="sn-page-enter">{children}</div>;
}
