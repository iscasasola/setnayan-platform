import { envFlagEnabled } from '@/lib/env-flag';

/**
 * 🖥 THE GUEST'S EVENT HUB ON A DESKTOP — the approved desktop system sheet's top bar, two widths and side panel
 * (DECISION_LOG 2026-10-15 "ONE-PAGE INVITATION + SAVE THE DATE, THE DESKTOP SYSTEM SHEET, AND FIVE ANSWERS —
 * APPROVED"; desktop area 1, part 2 — `lib/guest-hub-desktop.ts`). It ships DARK: guests see nothing new until the
 * owner says so. ON for the flag (`NEXT_PUBLIC_GUEST_HUB_DESKTOP_ENABLED`), or for an internal (§10a) viewer, so the
 * owner checks it on the live page signed in while every guest keeps today's desktop.
 *
 * ONE reader: the guest page asks it once and writes the desk `<style>` or not (`lib/flag-chokepoint-scan.test.ts`).
 */
export function guestHubDesktopEnabled({ internal }: { internal: boolean }): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_GUEST_HUB_DESKTOP_ENABLED) || internal === true;
}
