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
 * Built in several PRs (the doc's build plan), it shipped DARK (ON for the flag or an internal (§10a) viewer) while
 * the owner checked each PR on the live site. Widening it is the plan's last PR — this one (2026-10-23, below). ONE
 * reader: the launch page asks and hands `MakerShell` one boolean (`lib/flag-chokepoint-scan.test.ts`).
 */
/*
 * 🟢 ON FOR EVERYONE (owner 23 Oct 2026, DECISION_LOG "OWNER ANSWERS ON THE BUILD TRACKER": *"turn on desktop Maker
 * columns + desktop guest Event Hub for everyone"* — after the one 1280 look). The default flipped HERE, in code, so it
 * ships through the PR rather than a dashboard: an UNSET (or blank) variable now means ON. The variable stays as a
 * kill-switch read through the one shared parser — `false` · `0` · `no` · `off` (any case) turns the columns off again
 * for couples; an internal viewer keeps them either way.
 */
export function makerDesktopColumnsEnabled({ internal }: { internal: boolean }): boolean {
  const raw = process.env.NEXT_PUBLIC_MAKER_DESKTOP_COLUMNS_ENABLED;
  return raw === undefined || raw.trim() === '' || envFlagEnabled(raw) || internal === true;
}
