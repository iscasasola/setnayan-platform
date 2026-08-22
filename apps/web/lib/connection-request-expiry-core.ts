/**
 * connection-request-expiry-core.ts — the declared retention period, on its own.
 *
 * Split from `connection-request-expiry.ts` for the same blunt reason as
 * `papic-fullres-drop-core.ts`: that file imports `server-only`, so nothing in
 * it can be loaded by a unit test or by a db test, and this number is exactly
 * what those need to assert against.
 *
 * ⚠ THE NUMBER LIVES HERE AND THE COPY IS DERIVED FROM IT, never the reverse.
 * `/privacy` renders this constant; two hand-typed numbers agreeing today is how
 * `llms.txt` drifted for three weeks with green CI.
 */

/** What the public privacy notice declares for an unanswered or refused request. */
export const CONNECTION_REQUEST_RETENTION_DAYS = 30;
