/**
 * remembered-read-core.ts — the RULE behind a remembered public read. Pure: no
 * `server-only`, no Next, no Supabase, so a test can execute it.
 * `lib/remembered-read.ts` hands it Next's `unstable_cache` as the store.
 *
 * ─── WHAT IS REMEMBERED ──────────────────────────────────────────────────────
 * ROWS that are the same for every visitor, read with the service client and
 * keyed by arguments that carry no viewer (a date, a list of public event ids,
 * a limit). Never an answer about the person looking, never a signed address —
 * the same shape `lib/hub-music-server.ts` set: "rows, not addresses".
 *
 * ─── TWO AGES, AND WHY THE SECOND ONE EXISTS ─────────────────────────────────
 * Next's `unstable_cache` is stale-while-revalidate: once an entry is older than
 * `revalidate` it is STILL RETURNED, and refreshed behind the response. With
 * steady traffic that is an entry about a minute old. After a quiet night it is
 * last night's shelf, shown once, to the first visitor of the morning — and an
 * event its host made private at midnight would be on the public page at 7 am
 * if the write's own clear had been missed. So every value carries the time it
 * was read, and a value older than `hardSeconds` is never shown: the read is
 * asked again, now, for that request.
 *
 *   age ≤ softSeconds              → the remembered rows, no database call
 *   softSeconds < age ≤ hardSeconds → the remembered rows, refreshed behind
 *   age > hardSeconds              → asked again now (the refresh behind it has
 *                                    already started; this one request pays twice)
 *
 * ─── A REFUSED READ IS NEVER REMEMBERED ──────────────────────────────────────
 * A reader THROWS `ReadRefused` when the database did not answer (Supabase
 * resolves `{ data: null, error }` — nothing throws on its own). A thrown read
 * stores nothing, so the next view asks again; the caller turns the refusal into
 * "couldn't load", exactly as it did before anything was remembered.
 */

/** The database did not answer. `site` names the read; `partial` carries what did. */
export class ReadRefused<P = unknown> extends Error {
  readonly site: string;
  readonly reason: unknown;
  readonly partial: P | undefined;
  constructor(site: string, reason?: unknown, partial?: P) {
    super(`read refused: ${site}`);
    this.name = 'ReadRefused';
    this.site = site;
    this.reason = reason;
    this.partial = partial;
  }
}

export type Stamped<T> = { at: number; value: T };

/**
 * A keyed store with a soft age — `unstable_cache` in the app, a Map in a test.
 * It returns a function that answers from the store when it can.
 */
export type RememberStore = <A extends unknown[], T>(
  load: (...args: A) => Promise<T>,
  key: string,
  opts: { tags: string[]; revalidate: number },
) => (...args: A) => Promise<T>;

export type RememberOptions = {
  /** Names the read. Bump the suffix when the SHAPE of the rows changes. */
  key: string;
  /** Cleared by the writes that change these rows (`lib/home-shelf-clear.ts`). */
  tags: string[];
  softSeconds: number;
  hardSeconds: number;
  /** A test's clock. */
  now?: () => number;
};

export function rememberWith<A extends unknown[], T>(
  store: RememberStore,
  load: (...args: A) => Promise<T>,
  opts: RememberOptions,
): (...args: A) => Promise<T> {
  const now = opts.now ?? Date.now;
  const stamped = store(
    async (...args: A): Promise<Stamped<T>> => ({ at: now(), value: await load(...args) }),
    opts.key,
    { tags: opts.tags, revalidate: opts.softSeconds },
  );
  return async (...args: A): Promise<T> => {
    const hit = await stamped(...args);
    if (now() - hit.at <= opts.hardSeconds * 1000) return hit.value;
    // Too old to show anybody. Not stored from here — the store's own refresh is.
    return load(...args);
  };
}

/** One spelling for one set of ids, so two askers of the same set share one entry. */
export function stableIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
}

/** A remembered read in the `{ data, error }` shape the callers already branch on. */
export function asRead<T>(read: Promise<T>): Promise<{ data: T; error: null } | { data: null; error: unknown }> {
  return read.then(
    (data) => ({ data, error: null }),
    (error: unknown) => ({ data: null, error: error instanceof ReadRefused && error.reason ? error.reason : error }),
  );
}
