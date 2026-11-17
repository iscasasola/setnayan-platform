/**
 * 🔔 The notice look's shared button classes — a plain module (no 'use client'), so a server component can hand
 * them to a notice's action without taking a value from a client module.
 */
export const NOTICE_ACTION =
  'sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink';
export const NOTICE_QUIET = 'sn-press min-h-11 rounded-full px-3 text-sm font-semibold text-ink/60';

/**
 * 📐 LAY OUT BY YOUR OWN WIDTH, NOT THE SCREEN'S (W1 tablet/desktop walk RW-351, 16 Nov 2026). The notice look
 * (`NoticeLine`) puts the line and its actions on one row from a 768px SCREEN. An in-place notice can stand in a
 * pane far narrower than the screen — the supplier's chat thread, beside its list — where that one row crushed the
 * sentence to a word per line under its own buttons. This wrapper makes the box a size container and, while IT is
 * under 600px, keeps the phone's stacked layout (sentence, then the actions on their own row) whatever the screen.
 * Wider than that it changes nothing; on a phone it restates what the phone already draws.
 *
 * Here, in the plain module, so a server file (`payout-method-nudge.tsx`) can take it without taking a value from a
 * 'use client' module (`lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts`).
 */
export const BY_ITS_OWN_WIDTH =
  '[container-type:inline-size] [@container(max-width:599px)]:[&_[data-notice-key]]:block [@container(max-width:599px)]:[&_[data-notice-actions]]:mt-2';
