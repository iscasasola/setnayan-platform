/**
 * The notice's action button — one look, 44 px (prototype `.btn.sec`). In a plain module, NOT the `'use client'`
 * notices.tsx, so a SERVER component can use the class string: a value imported from a client module arrives on the
 * server as a client reference, not the string (lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts).
 * notices.tsx re-exports it, so there is still one constant.
 */
export const NOTICE_ACTION =
  'sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink';
