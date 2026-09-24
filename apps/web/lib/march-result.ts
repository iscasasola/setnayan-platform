/**
 * march-result.ts — what a Wedding March move hands back.
 *
 * ⚖ Owner 2026-09-23: *"we want them to move and pair people easily and
 * fast."* Until this, every move ended in `redirect('…?gview=walk&error=…')`
 * and the refusal travelled as a query string through a full page navigation.
 * The actions return this instead, and the island says it in place.
 *
 * 🔑 A REASON, NOT A BOOLEAN. These refusals are sentences a couple can act on
 * ("Rosaria walks on the right, so they cannot take a place on the left") and
 * they were already written — they were just being smuggled through a URL.
 * `ok: false` with nothing to say would be the same silence the 2026-08-19
 * sweep existed to remove.
 *
 * ⛔ ITS OWN MODULE ON PURPOSE. The client island imports this TYPE; the
 * actions that produce it import a database. A type shared through a
 * `'use server'` file drags the action surface with it, and a type shared
 * through a `server-only` file cannot be named on the client at all.
 */
export type MarchResult =
  | { ok: true; written: number }
  | { ok: false; reason: string };
