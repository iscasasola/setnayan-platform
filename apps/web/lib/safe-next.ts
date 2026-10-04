/**
 * THE ONE RULE for a user-controlled "where next" path — `?next=`, a form's
 * `return_to`, a deep link the phone app is handed. Pure: no `server-only`, so
 * a client component, the phone bridge and a `node:test` file read the SAME
 * rule. `lib/auth.ts` re-exports `safeNext` from here, so every existing
 * `import { safeNext } from '@/lib/auth'` keeps working.
 *
 * 🔒 WHY A PREFIX CHECK WAS NOT ENOUGH (audit of train #6333, 2026-10-04).
 * The old rule was "starts with `/`, not with `//`". Browsers and the WHATWG
 * URL parser treat a BACKSLASH as a slash and STRIP tabs/newlines anywhere in
 * a URL, so:
 *
 *   new URL('/\\evil.com', origin)   → https://evil.com/
 *   new URL('/\t/evil.com', origin)  → https://evil.com/
 *
 * Both passed the prefix check and left the site. A path is accepted here only
 * if it is unambiguously same-origin by construction AND still same-origin
 * after the real parser resolves it.
 *
 * Accepted: exactly one leading `/`, then anything that is not
 *   · a second `/` or a `\` right after it (`//host`, `/\host`),
 *   · a backslash anywhere,
 *   · an ASCII control character or any whitespace anywhere (TAB, CR, LF, …),
 *   · an encoded form of the above (`/%5c…`, `/%2f%2f…`, `%0d%0a…`), checked
 *     on the decoded value, and malformed / endlessly re-encoded escapes;
 * and whose `new URL(path, origin).origin` is still `origin`.
 *
 * Everything else collapses to the caller's fallback (default `/`). The
 * accepted value is returned VERBATIM — never re-serialised — so a good path
 * lands exactly where it pointed.
 *
 * ⚖ A caller with a narrower allowlist (only `/papic/…`, only this event's
 * guest routes) adds its prefix ON TOP of `isSafeNext`, never instead of it:
 * the prefix says WHICH pages, this says IS IT A PAGE OF OURS.
 */

/** A fixed origin to resolve against: the check is "did the origin change". */
const PROBE_ORIGIN = 'https://safe-next.invalid';

/** Raw: any C0/C1 control character or any whitespace (Unicode `\s`). */
const RAW_FORBIDDEN = /[\s\u0000-\u001f\u007f-\u009f\\]/;
/** Decoded: control characters and backslash. A decoded SPACE (`%20` in a query) is fine. */
const DECODED_FORBIDDEN = /[\u0000-\u001f\u007f-\u009f\\]/;

/** How many rounds of percent-decoding are tried before giving up as hostile. */
const MAX_DECODE_ROUNDS = 3;

function decodedForms(raw: string): string[] | null {
  const forms: string[] = [];
  let current = raw;
  for (let i = 0; i < MAX_DECODE_ROUNDS; i += 1) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      // A malformed escape in the RAW value cannot be judged, so it is refused.
      // After a round of decoding, a stray `%` is data (`?q=100%25` → `100%`),
      // not a hidden escape — the forms so far are the whole story.
      return i === 0 ? null : forms;
    }
    if (next === current) return forms;
    forms.push(next);
    current = next;
  }
  // Still changing after the last round: layered encoding exists to hide something.
  try {
    return decodeURIComponent(current) === current ? forms : null;
  } catch {
    return forms;
  }
}

function leadsOffSite(path: string): boolean {
  // `//host` is "a host" to a browser. So is `/\host` — but a backslash is
  // refused ANYWHERE, raw or decoded, by the two FORBIDDEN classes above.
  return path.startsWith('//');
}

/** True only for a same-origin relative path (see the rule above). */
export function isSafeNext(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length === 0) return false;
  if (!raw.startsWith('/') || leadsOffSite(raw)) return false;
  if (RAW_FORBIDDEN.test(raw)) return false;

  const decoded = decodedForms(raw);
  if (decoded === null) return false;
  for (const form of decoded) {
    if (leadsOffSite(form) || DECODED_FORBIDDEN.test(form)) return false;
  }

  try {
    return new URL(raw, PROBE_ORIGIN).origin === PROBE_ORIGIN;
  } catch {
    return false;
  }
}

/**
 * Sanitize a user-controlled "next" / "return_to" path. A safe path comes back
 * verbatim; anything else is `fallback` (default `/`).
 */
export function safeNext(raw: unknown, fallback = '/'): string {
  return isSafeNext(raw) ? raw : fallback;
}
