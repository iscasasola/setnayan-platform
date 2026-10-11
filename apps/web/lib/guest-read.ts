/**
 * guest-read.ts — a guest-side read that FAILED never answers as "no such row".
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * `const { data } = await admin.from(…)…maybeSingle()` throws the error away,
 * and supabase-js RESOLVES a failed read with `data: null` — the exact value
 * that means "nothing has this slug / this code / this guest". On the guest
 * side every caller then told the person something about THEM:
 *
 *   the personal link ...... "That invite link doesn't look right"
 *   the day's hub, the cast  "This link can't be found."
 *   the entourage .......... "The entourage hasn't been shared yet."
 *
 * to a guest holding a perfectly good link, because the database took a moment
 * (the small plan answers its first call after a quiet gap in up to 3 s, and
 * every deploy that carries a migration has a 20 s – 1 min schema-cache blip).
 *
 * ── The rule ───────────────────────────────────────────────────────────────
 *   1. The read is retried through a transient blip (`withSchemaRetry`, a few
 *      seconds, bounded).
 *   2. `error` set after that → THROW. Under `app/[slug]` a throw is the guest
 *      boundary: "This invitation didn't load. … Your link is fine". A route
 *      handler catches it and answers the same words in place.
 *   3. `error` null → the data, exactly as before. `null` now means ONE thing:
 *      the read answered and there is no such row. The caller's `notFound()`
 *      or empty state stays, and is true.
 *
 * ⚠ READS ONLY (the same warning as lib/read-retry.ts): a retried write is a
 * second write.
 * ⚠ Do not wrap a read whose soft failure is DELIBERATE — one that selects a
 * column prod may not have yet and degrades by design. Every error throws here.
 *
 * 🛡 lib/guest-read.test.ts · app/[slug]/a-failed-read-is-not-an-absence.test.ts
 */
import {
  isTransientReadError,
  schemaBlipError,
  withSchemaRetry,
  type SchemaRetryOptions,
} from '@/lib/read-retry';

/** What a supabase-js read resolves with — the three fields this helper reads. */
type ReadResult = { data: unknown; error: unknown; status?: number | null };

/** Thrown for a guest-side read that failed for a reason a retry does not fix. */
export class GuestReadError extends Error {
  readonly callSite: string;
  constructor(callSite: string, cause?: unknown) {
    const m = (cause as { message?: unknown } | null | undefined)?.message;
    super(`Could not read at ${callSite}${typeof m === 'string' ? `: ${m}` : ''}`);
    this.name = 'GuestReadError';
    this.callSite = callSite;
  }
}

/**
 * Run a guest-side READ. Returns its `data` (`null` = the read answered, no
 * such row). Throws when the read failed — a `SchemaBlipError` for a blip that
 * outlasted the retry window, a `GuestReadError` for anything else.
 *
 * `read` must build a FRESH query each call: `() => admin.from(…)…`.
 */
export async function guestRead<R extends ReadResult>(
  callSite: string,
  read: () => PromiseLike<R>,
  opts: SchemaRetryOptions = {},
): Promise<R['data']> {
  const result = await withSchemaRetry(read, opts);
  if (result.error) {
    console.error(`[guest-read] ${callSite}`, result.error);
    if (isTransientReadError(result.error, result.status)) {
      throw schemaBlipError(callSite, result.error);
    }
    throw new GuestReadError(callSite, result.error);
  }
  return result.data;
}

/**
 * THE REPLY'S SAVE NEVER LANDS ON THE SITE'S HOME.
 *
 * Every redirect out of the reply's save is built from the event's address as
 * the DATABASE holds it. Where that address was not in hand the fallback used
 * to be `redirect('/')` — the marketing home, a page about buying a product —
 * for a guest who had pressed Send on a wedding invitation.
 *
 * This is that fallback now: a THROW. With script the reply card catches it and
 * says the reply was not sent, with everything typed still there
 * (`app/[slug]/_components/reply-form.tsx`); without script the guest boundary
 * answers ("This invitation didn't load. … Your link is fine").
 *
 * ⚠ Call it only BEFORE the write, or where the write itself failed. A throw
 * after a write that landed would tell a guest their saved reply was not saved.
 */
export function eventAddressUnread(callSite: string): never {
  throw new GuestReadError(`${callSite} (the event's address)`);
}
