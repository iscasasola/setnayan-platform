/**
 * A path → the app's own ROUTE PATTERN (`/dashboard/[eventId]/guests`).
 *
 * The load-time log stores patterns, never URLs (owner rule, 2026-10-16). The
 * browser already blanks ids (`normalizePath`: a uuid → `[id]`, an event's own
 * address → `[slug]`); this matcher then names the page the way the code does,
 * against the route list the app is built from (the Ugat screens registry + the
 * admin routes registry — both generated from the route tree and held to it by
 * their own guards).
 *
 * A path that matches no pattern keeps only the segments that are LITERAL in
 * some route; every other segment becomes `[…]`. So free text — a shop's name,
 * a person's handle — can never survive, matched or not.
 *
 * Pure: the route list is passed in.
 */

const SAFE_SEGMENT = /^[A-Za-z0-9._-]{1,40}$/;

type Seg = { kind: 'lit'; v: string } | { kind: 'dyn' } | { kind: 'rest'; optional: boolean };

function parse(pattern: string): Seg[] {
  return pattern
    .split('/')
    .filter(Boolean)
    .map((s): Seg => {
      if (/^\[\[\.\.\.[^\]]+\]\]$/.test(s)) return { kind: 'rest', optional: true };
      if (/^\[\.\.\.[^\]]+\]$/.test(s)) return { kind: 'rest', optional: false };
      if (/^\[[^\]]+\]$/.test(s)) return { kind: 'dyn' };
      return { kind: 'lit', v: s };
    });
}

/** A path segment the browser blanked — it can only ever fill a dynamic slot. */
function isBlank(seg: string): boolean {
  return /^\[[^\]]*\]$/.test(seg);
}

/** Score a match (literal 3 · dynamic 2 · catch-all 1 per segment), or -1. */
function score(segs: Seg[], path: string[]): number {
  let s = 0;
  for (let i = 0; i < segs.length; i++) {
    const p = segs[i]!;
    if (p.kind === 'rest') {
      const left = path.length - i;
      if (left < (p.optional ? 0 : 1)) return -1;
      return s + left; // a catch-all is always last
    }
    const seg = path[i];
    if (seg === undefined) return -1;
    if (p.kind === 'lit') {
      if (isBlank(seg) || seg !== p.v) return -1;
      s += 3;
    } else {
      s += 2;
    }
  }
  return path.length === segs.length ? s : -1;
}

export type RouteMatcher = (path: string) => string | null;

/**
 * Build a matcher over `patterns`. The result maps an (already id-blanked) path
 * to its pattern, or to the scrubbed fallback; null only for something that is
 * not a path at all.
 */
export function makeRouteMatcher(patterns: readonly string[]): RouteMatcher {
  const parsed = [...new Set(patterns)]
    .filter((p) => typeof p === 'string' && p.startsWith('/'))
    .map((p) => ({ pattern: p.length > 1 ? p.replace(/\/+$/, '') : p, segs: parse(p) }));
  const literals = new Set<string>();
  for (const p of parsed) for (const s of p.segs) if (s.kind === 'lit') literals.add(s.v);

  return (raw: string) => {
    if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
    const path = raw.split(/[?#]/)[0]!.split('/').filter(Boolean);
    let best: string | null = null;
    let bestScore = -1;
    for (const p of parsed) {
      const sc = score(p.segs, path);
      if (sc > bestScore) {
        bestScore = sc;
        best = p.pattern;
      }
    }
    if (best !== null) return best;
    const kept = path.slice(0, 8).map((seg) => (literals.has(seg) && SAFE_SEGMENT.test(seg) ? seg : '[…]'));
    return `/${kept.join('/')}`;
  };
}
