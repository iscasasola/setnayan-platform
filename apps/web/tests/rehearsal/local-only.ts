/**
 * ⛔ THE REHEARSAL TALKS TO THIS MACHINE AND NOTHING ELSE.
 *
 * Every piece of the release rehearsal (the migration driver, the request
 * counter, the seed, the walk) is handed an address, and every one of them
 * passes it through here first. A rehearsal that could be pointed at the live
 * database by one wrong variable is not a rehearsal — production went down on
 * 2026-10-08 under far less than a migration replay.
 *
 * Loopback only. Not "a host that looks like a test host": a name ending in
 * `.supabase.co`, `.vercel.app` or `setnayan.com` is exactly what must never
 * get through, and an allowlist of one is the only list that cannot rot.
 */
const LOCAL_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export function isLocalUrl(value: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

/** Returns the parsed URL, or throws before anything has been sent anywhere. */
export function assertLocalUrl(value: string, what: string): URL {
  if (!isLocalUrl(value)) {
    let host = '(not a URL)';
    try {
      host = new URL(value).hostname;
    } catch {
      /* keep the placeholder — never echo the raw value, it may carry a password */
    }
    throw new Error(
      `REFUSED: ${what} must be on this machine (127.0.0.1 / localhost). Got host "${host}". ` +
        `The release rehearsal never talks to a live service. Nothing was run.`,
    );
  }
  return new URL(value);
}
