/**
 * The picked choice's look — the app's accent and the ink that reads on it (`--sn-accent` / `--sn-on-accent`, `globals.css`; never a colour written here —
 * `lib/the-accent-is-one-token.test.ts`). It lives HERE, with no 'use client', because a SERVER file (`lib/studio-skin.ts`) builds a class from it at module load, and
 * a plain value imported from a client module is a client reference there, not the string (`lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts`).
 * `pill-selector.tsx` re-exports it, so every existing import keeps working.
 */
export const PILL_ON_CLASS = 'bg-sn-accent text-sn-on-accent';
