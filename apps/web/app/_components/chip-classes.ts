/**
 * The chip's classes — the ONE chip look (`chips.tsx`, `INTERACTION_RULES.md` § 9 kind 11): 40 px drawn, a 44-px press
 * (`sn-hit`), the word on one line. They live HERE, with no 'use client', so a SERVER file can draw a link in the same
 * chip (the admin tab landings, `app/admin/_components/tab-landing.tsx`): a plain value imported from a client module is
 * a client reference there, not the string (`lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts`).
 * `chips.tsx` re-exports them, so every existing import keeps working.
 */
import { PILL_ON_CLASS } from './pill-classes';

/** One chip's shape — the same chosen or not. */
export const CHIP_CLASS =
  "sn-press relative inline-flex h-10 min-h-10 min-w-[84px] flex-none items-center justify-center whitespace-nowrap rounded-full border px-[18px] text-[14px] font-semibold transition-colors duration-sn-control ease-sn sn-hit motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40";
/** Chosen: the accent, and the ink that reads on it. */
export const CHIP_ON_CLASS = `border-sn-accent ${PILL_ON_CLASS}`;
/** Not chosen: grey words on white — on the page's own ground in dark mode (white stayed white there). */
export const CHIP_OFF_CLASS = 'border-ink/15 bg-white text-ink/55 dark:bg-raised';

export function chipClass(on: boolean): string {
  return `${CHIP_CLASS} ${on ? CHIP_ON_CLASS : CHIP_OFF_CLASS}`;
}
