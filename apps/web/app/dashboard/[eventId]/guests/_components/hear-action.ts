import { unstable_rethrow } from 'next/navigation';

/**
 * hear-action.ts — A PRESS ON THE GUEST LIST IS HEARD, WHATEVER HAPPENS TO THE REQUEST.
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * Every add / mark / save on the guest list calls a server action that ANSWERS with a result — `{ ok: true, … }` or
 * `{ ok: false, error }` — and each call site already says a plain sentence for the refusal. But the call sat bare
 * inside `startTransition(async () => { const res = await action(…) … })`. When the REQUEST fails — the phone is
 * offline, the server answers 5xx, the action throws — there is no result at all: the await rejects, and a rejected
 * `useTransition` action is thrown into the nearest error boundary. The dashboard has none of its own, so the app's
 * error screen ("Something on our end didn't work.") REPLACED the whole roster, and the names typed into the sheet —
 * or the invitation message being written — were gone with it.
 *
 * ── The rule ───────────────────────────────────────────────────────────────
 * `hearAction(() => action(…))` gives a failed request the SAME shape as a refusal: `{ ok: false, error: '' }`. The
 * call site's own `if (!res.ok)` branch then runs as it always did — the sheet stays, what was typed stays, and its
 * existing sentence is said (`plainRefusal('', fallback)` is the fallback: "Couldn’t save that. Try again.").
 * No new words, no new state, no second code path.
 *
 * The framework's own signals (a redirect, a not-found) are not failures and pass straight through
 * (`unstable_rethrow`) — the same rule as the guest card's `hearSave` (`guest-card-autosave.tsx`).
 *
 * ⚠ NOT A RETRY. It never calls the action twice: a retried write is a second write.
 * ⚠ It answers "not saved" for a request whose fate is unknown (a connection that dropped after the server had the
 * press). The roster re-reads on the next refresh; a second press of an ADD can then add the same name twice — the
 * sheet's own "already on your list" check is what catches that, once the list has re-read.
 *
 * 🛡 a-failed-press-keeps-the-sheet.test.ts
 */
export type Unheard = { ok: false; error: '' };

export async function hearAction<T extends { ok: boolean }>(call: () => Promise<T> | T): Promise<T | Unheard> {
  try {
    return await call();
  } catch (err) {
    unstable_rethrow(err);
    return { ok: false, error: '' };
  }
}
