/**
 * Make failed PostgREST calls VISIBLE instead of silently empty.
 *
 * THE PROBLEM THIS SOLVES. Almost every read in this app is written as
 *
 *     const { data } = await admin.from('t').select('a,b').eq(…);
 *     const rows = (data ?? []) as Row[];
 *
 * — `error` is never destructured. When the query fails (a column that does not
 * exist → 42703, a table that does not exist → 42P01, an RLS policy that denies
 * the read), PostgREST answers 400/404 and supabase-js resolves with
 * `data: null`. The `?? []` then turns the failure into an empty list, and the
 * feature renders as "nothing here" — indistinguishable from a genuinely empty
 * result. Two shipped features (the date-selection vendor pool, and the
 * Setnayan-AI run-of-show clash check) were dead in production for weeks in
 * exactly this way, with no error anywhere.
 *
 * WHY AT THE FETCH LAYER. The obvious alternative — proxying `.from()` and
 * intercepting the thenable — has to re-implement the builder's chaining
 * contract, and a mistake there changes the behaviour of ~3,000 call sites. A
 * `fetch` wrapper cannot alter query semantics at all: it observes the HTTP
 * response and hands the untouched original back. It also covers strictly more
 * ground than a builder proxy — writes, RPCs, and RLS denials all surface here,
 * because all of them are just non-2xx PostgREST responses.
 *
 * The static guards (lib/security/select-column-scan.ts and the schema-drift
 * replay) catch phantom columns BEFORE merge. This is the runtime backstop for
 * what static analysis structurally cannot see: RLS denials, dynamically-built
 * selects, filter-only column references, and failed writes.
 *
 * RA 10173 — NO PII IN LOGS. A PostgREST URL carries filter values in its query
 * string (`?email=eq.someone@example.com`), and the error body's `details` field
 * can echo row values. We log the path with the query string REMOVED, and only
 * the `code` / `message` / `hint` fields — never `details`. A phantom-column
 * message ("column events.venue does not exist") names schema, not people.
 */

/** PostgREST error envelope. `details` is deliberately NOT read — it can echo row values. */
type PostgrestErrorBody = {
  code?: unknown;
  message?: unknown;
  hint?: unknown;
};

/**
 * Identical failures repeat once per render across a page tree, so collapse them
 * to one line each. Bounded so a pathological loop can't grow this without end;
 * once full we stop deduping rather than stop logging (a missed dedupe is noise,
 * a missed log is the bug we are trying to surface).
 */
const seen = new Set<string>();
const SEEN_CAP = 500;

function shouldLog(key: string): boolean {
  if (seen.has(key)) return false;
  if (seen.size < SEEN_CAP) seen.add(key);
  return true;
}

/** Strip the query string — it carries filter VALUES (emails, ids, names). */
function safePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url.split('?')[0] ?? url;
  }
}

function describe(body: string): string {
  try {
    const parsed = JSON.parse(body) as PostgrestErrorBody;
    const code = typeof parsed.code === 'string' ? parsed.code : null;
    const message = typeof parsed.message === 'string' ? parsed.message : null;
    const hint = typeof parsed.hint === 'string' ? parsed.hint : null;
    return [code, message, hint ? `(hint: ${hint})` : null].filter(Boolean).join(': ');
  } catch {
    // Non-JSON body (HTML error page, gateway timeout). Cap it — we only need
    // enough to recognise the failure, and the body is not guaranteed PII-free.
    return body.slice(0, 200);
  }
}

/**
 * Wrap `fetch` so non-2xx PostgREST responses are reported. The response is
 * returned untouched — we read a `clone()`, so the caller's body is unconsumed.
 *
 * `/auth/v1/` is skipped: a 400 from the token endpoint is the ordinary
 * "refresh token expired" path and is handled by the auth client.
 */
export function createLoggingFetch(label: string): typeof fetch {
  return async function loggingFetch(input, init) {
    const res = await fetch(input as Parameters<typeof fetch>[0], init);
    try {
      if (res.ok) return res;
      const url = typeof input === 'string' ? input : (input as Request | URL).toString();
      if (!url.includes('/rest/v1/') && !url.includes('/storage/v1/')) return res;

      const path = safePath(url);
      const detail = describe(await res.clone().text());
      const key = `${res.status} ${path} ${detail}`;
      if (shouldLog(key)) {
        console.error(
          `[supabase:${label}] ${res.status} ${path} — ${detail}\n` +
            '    ^ this query FAILED. Any `data ?? []` downstream is rendering an ' +
            'empty result for a broken query, not an empty table.',
        );
      }
    } catch {
      // The logger must never change what the caller sees.
    }
    return res;
  } as typeof fetch;
}
