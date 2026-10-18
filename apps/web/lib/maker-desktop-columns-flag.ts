import { envFlagEnabled } from '@/lib/env-flag';

/**
 * 🖥 THE NEW MAKER ON A DESKTOP — three columns (owner 2026-10-07, all "A" on
 * `MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md`; 2026-10-15 "DESKTOP MOVES AHEAD OF THE ADMIN DASHBOARD"
 * and "DESKTOP COVERS THE WHOLE APP — FOUR AREAS, IN ORDER", area 1 = the Maker first).
 *
 * The new Maker ("Stages | Studio", `makerStagesStudioEnabled`) was a PHONE's only: from `lg` (1024 px) the
 * shell drew the OLD Maker. With this ON, a desktop draws the new one too — the parts of the page on the left
 * (from 1280), the page in the middle, the phone's lower third as a full-height tools column on the right —
 * every word and control the phone's. OFF: a desktop is exactly as it was. A phone is the same either way.
 *
 * Built in several PRs (the doc's build plan), so it ships DARK: ON for the flag, or for an internal (§10a)
 * viewer — the same reading the launch page hands `makerStagesStudioEnabled` — so the owner checks each PR on
 * the live site while every couple keeps today's desktop. Widening it is the plan's last PR. ONE reader: the
 * launch page asks and hands `MakerShell` one boolean (`lib/flag-chokepoint-scan.test.ts`).
 */
export function makerDesktopColumnsEnabled({ internal }: { internal: boolean }): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_MAKER_DESKTOP_COLUMNS_ENABLED) || internal === true;
}
