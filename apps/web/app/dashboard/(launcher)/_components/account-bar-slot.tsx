'use client';

import dynamic from 'next/dynamic';
import type { AccountBarTab } from '@/lib/account-bar';
import type { ShellBoundary } from '@/app/_components/shell-boundary';

/**
 * AccountBarSlot — how the two account layouts mount <AccountBottomNav>: in its
 * OWN chunk, still server-rendered (`dynamic`'s default `ssr: true`), so the
 * bar is in the first paint and is only hydrated once its chunk arrives.
 *
 * ⚡ WHY NOT A PLAIN IMPORT — MEASURED, not assumed (local `next build`,
 * `scripts/check-maker-js-budget.mjs`, 2026-10-21, vs main aff7c0c5b4):
 *   · plain import → the Maker's first load +234 B gzipped and one MORE chunk.
 *     With the launcher and account layouts now also shipping the canonical
 *     <BottomNav>, webpack carved it out of the event layout's chunk into a
 *     shared one (6,126 B → 1,284 + 5,076 B) — two files compress worse than
 *     one. The Maker sat at its 507 KB ceiling that day.
 *   · this slot → +28 B: 11 B of words the ruling requires (the mark's Events
 *     address, the sheet's "Admin" / "Setnayan HQ") and 17 B of webpack runtime
 *     for this one async chunk. The event layout's chunk is byte-identical.
 * Held by `the-account-bar-is-the-ruling.test.ts` (no account layout imports
 * the bar, or the canonical bar, directly).
 */
const AccountBottomNav = dynamic(() => import('./account-bottom-nav').then((m) => m.AccountBottomNav));

/**
 * `boundary` is the line the layout gave its shell (`shell-boundary.tsx`), handed to the dock so the phone bar and the
 * rail's strip switch at ONE width. Both account layouts pass `"tab"` (701, owner-approved plan D5, 2026-11-13).
 */
export function AccountBarSlot({ tabs, boundary }: { tabs: readonly AccountBarTab[]; boundary?: ShellBoundary }) {
  return <AccountBottomNav tabs={tabs} boundary={boundary} />;
}
