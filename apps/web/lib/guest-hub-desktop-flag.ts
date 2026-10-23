import { envFlagEnabled } from '@/lib/env-flag';

/**
 * 🖥 THE GUEST'S EVENT HUB ON A DESKTOP — the approved desktop system sheet's top bar, two widths and side panel
 * (DECISION_LOG 2026-10-15 "ONE-PAGE INVITATION + SAVE THE DATE, THE DESKTOP SYSTEM SHEET, AND FIVE ANSWERS —
 * APPROVED"; desktop area 1, part 2 — `lib/guest-hub-desktop.ts`). It shipped DARK (the flag, or an internal (§10a)
 * viewer) while the owner checked it on the live page; the owner said so on 2026-10-23 (below).
 *
 * ONE reader: the guest page asks it once and writes the desk `<style>` or not (`lib/flag-chokepoint-scan.test.ts`).
 */
/*
 * 🟢 ON FOR EVERYONE (owner 23 Oct 2026, DECISION_LOG "OWNER ANSWERS ON THE BUILD TRACKER": *"turn on desktop Maker
 * columns + desktop guest Event Hub for everyone"* — after one look at /maria-and-jose at 1280). Flipped HERE, in code,
 * so it ships through the PR: an UNSET (or blank) variable now means ON. The variable stays a kill-switch through the
 * one shared parser — `false` · `0` · `no` · `off` (any case) turns the desk off for guests; an internal viewer keeps it.
 */
export function guestHubDesktopEnabled({ internal }: { internal: boolean }): boolean {
  const raw = process.env.NEXT_PUBLIC_GUEST_HUB_DESKTOP_ENABLED;
  return raw === undefined || raw.trim() === '' || envFlagEnabled(raw) || internal === true;
}
