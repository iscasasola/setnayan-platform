/**
 * lib/update-json-column.ts — ONE WRITE AT A TIME ON A JSON COLUMN (owner 2026-10-18, two hosts never overwrite — round 2).
 *
 * The other half of the "merge from base" pattern (`lib/merge-from-base.ts`), for a live `jsonb` column a server action
 * reads, changes and writes back WHOLE (`events.print_details`, `events.reception_design`, `events.role_names`,
 * `event_moderators.permissions_json`, a guest's `extra_roles` …). Two saves that read the same value both wrote it
 * back with only their own change, and the first one was silently gone. The Maker draft row answers this with a counter
 * (`updateHubDraft`, `event_site_drafts.revision`); these columns have none, so the compare is on the VALUE ITSELF:
 * write only if the column still holds exactly what was read (jsonb equality — key order means nothing), otherwise read
 * again and build again on the newer value. An equal value read twice (A→B→A) is harmless: building on it is correct.
 *
 * `build` gets the value as it is now and returns what to write (and, optionally, other columns written with it and
 * anything it wants handed back), or `null` to write nothing. It may run more than once — a function of what it is
 * given. Gives up after `JSON_COLUMN_WRITE_ATTEMPTS` lost rounds with an Error the caller already turns into words —
 * never a silent overwrite.
 *
 * ⚠ The compare travels in the request's URL. Every column it is used for measured small in production (2026-10-18:
 * the largest, `style_preferences`, 763 characters); a value over `JSON_COMPARE_MAX_CHARS` is written WITHOUT the
 * compare — exactly the old behaviour — and says so in the log, rather than failing a save on a URL limit.
 */

export const JSON_COLUMN_WRITE_ATTEMPTS = 5;
/** Above this many characters of JSON the compare is not sent (see the ⚠ above). */
export const JSON_COMPARE_MAX_CHARS = 3000;

export class JsonColumnMovedError extends Error {
  constructor(what: string) {
    super(`${what} kept changing while it was being saved. Please try again.`);
    this.name = 'JsonColumnMovedError';
  }
}

/** The structural slice of a supabase client this needs (the session client, the admin client, the db tests' client). */
type Filterable = {
  eq(column: string, value: unknown): Filterable;
  is(column: string, value: null): Filterable;
  select(columns: string): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
};
type Readable = {
  eq(column: string, value: unknown): Readable;
  maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
};
export type JsonColumnClient = {
  from(table: string): {
    select(columns: string): Readable;
    update(values: Record<string, unknown>): Filterable;
  };
};

export type JsonColumnTarget = {
  table: string;
  /** The row: column → value, every one an equality (`{ event_id }`, `{ event_id, guest_id }`). */
  row: Readonly<Record<string, string>>;
  column: string;
  /** For the refusal's words ("Your menu"). */
  what?: string;
};

export type JsonColumnBuilt<V, R> = { next: V; also?: Record<string, unknown>; said?: R } | null;

export async function updateJsonColumn<V = unknown, R = undefined>(
  client: JsonColumnClient,
  target: JsonColumnTarget,
  build: (current: V | null, found: boolean) => JsonColumnBuilt<V, R> | Promise<JsonColumnBuilt<V, R>>,
): Promise<{ written: boolean; value: V | null; said?: R }> {
  const keys = Object.entries(target.row);
  /** What the last LOST round read: read again unchanged, nothing moved — the write was refused, not raced. */
  let lost: string | null | undefined;
  for (let attempt = 1; ; attempt += 1) {
    let read = client.from(target.table).select(target.column);
    for (const [k, v] of keys) read = read.eq(k, v);
    const got = await read.maybeSingle();
    if (got.error) throw new Error(got.error.message);
    const found = got.data !== null;
    const current = (found ? (got.data![target.column] ?? null) : null) as V | null;
    if (lost !== undefined && found && (current === null ? null : JSON.stringify(current)) === lost) {
      throw new Error(`${target.what ?? 'This'} could not be saved.`);
    }
    const built = await build(current, found);
    if (!built || !found) return { written: false, value: current };
    let write = client.from(target.table).update({ ...(built.also ?? {}), [target.column]: built.next });
    for (const [k, v] of keys) write = write.eq(k, v);
    const spelled = current === null ? null : JSON.stringify(current);
    if (spelled === null) write = write.is(target.column, null);
    else if (spelled.length <= JSON_COMPARE_MAX_CHARS) write = write.eq(target.column, spelled);
    else console.warn(`[update-json-column] ${target.table}.${target.column} is ${spelled.length} characters — written without the compare`);
    const done = await write.select(keys[0]![0]);
    if (done.error) throw new Error(done.error.message);
    if (Array.isArray(done.data) && done.data.length > 0) return { written: true, value: built.next, said: built.said };
    // 👥 The row moved on since it was read (another screen's save) — read again and build again on the newer value.
    if (attempt >= JSON_COLUMN_WRITE_ATTEMPTS) throw new JsonColumnMovedError(target.what ?? 'This');
    lost = spelled;
  }
}
