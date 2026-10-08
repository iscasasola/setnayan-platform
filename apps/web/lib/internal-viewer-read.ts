/**
 * apps/web/lib/internal-viewer-read.ts
 *
 * What the `users.is_internal` read SAID — with "it did not answer" kept apart
 * from "no". Pure, so the Maker's gate can be tested from the failed read to
 * the refusal (`lib/the-maker-choice-is-never-a-failed-read.test.ts`).
 *
 * Its own file, on purpose: `lib/view-as-free.ts` is imported by the Maker's
 * client bundle (the switch's labels), which has no room to spare; this is
 * read by the server half only (`lib/view-as-free.server.ts`).
 *
 * `internal` is false on a failure (the view switch then does nothing, which
 * shows the real page). `read` is what the Maker's gate asks: with the flag
 * off, an unread answer must never be taken for "not internal → the shipped
 * Maker" (production incident, 2026-10-08).
 */
export function internalAnswerFrom(res: { data: unknown; error: unknown }): { read: boolean; internal: boolean } {
  if (res.error) return { read: false, internal: false };
  return { read: true, internal: (res.data as { is_internal?: boolean | null } | null)?.is_internal === true };
}
