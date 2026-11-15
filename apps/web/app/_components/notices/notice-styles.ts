/**
 * 🔔 The notice look's shared button classes — a plain module (no 'use client'), so a server component can hand
 * them to a notice's action without taking a value from a client module.
 */
export const NOTICE_ACTION =
  'sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink';
export const NOTICE_QUIET = 'sn-press min-h-11 rounded-full px-3 text-sm font-semibold text-ink/60';
