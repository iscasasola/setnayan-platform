// Creator "Adventure Chapter" — AUDIENCE display helpers (owner 2026-07-16).
//
// Pure, isomorphic formatting for the aggregate audience numbers (follower +
// view counts). No PII, no DB access — the counters themselves are maintained
// in the DB (view RPCs + the user_follows trigger) and read via the public
// resolvers; this only turns a raw total into a compact human label.

/**
 * Compact count for public display: 0–999 verbatim, then 1.2k / 3.4m style.
 * Never negative (the DB clamps followers_count at >= 0, but be defensive).
 */
export function formatAudienceCount(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (v < 1000) return String(v);
  if (v < 1_000_000) {
    const k = v / 1000;
    return `${k >= 100 ? Math.round(k) : trim1(k)}k`;
  }
  const m = v / 1_000_000;
  return `${m >= 100 ? Math.round(m) : trim1(m)}m`;
}

function trim1(x: number): string {
  // One decimal, but drop a trailing .0 (1.0k → 1k).
  return x
    .toFixed(1)
    .replace(/\.0$/, '');
}
