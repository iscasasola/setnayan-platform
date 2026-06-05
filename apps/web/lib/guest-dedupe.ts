// Shared guest duplicate-detection — nickname-aware + typo-tolerant fuzzy
// matching used by every "add a guest" surface (quick-add sheet, the
// detailed /guests/new form, and any future entry point). Lifted out of
// quick-add-sheet.tsx so each surface reuses the exact same matcher
// instead of re-implementing it.
//
// Both first AND last name must match so two distinct same-first-name
// guests (two "Marias") never false-fire. Returns up to 3 likely
// matches, sorted exact -> nick -> typo.

export type DupKind = 'exact' | 'nick' | 'typo';

/** Minimal shape the matcher needs; real callers pass richer rows. */
export type NameLike = { first_name: string; last_name: string };

export type DupMatch<T extends NameLike> = { g: T; kind: DupKind };

// Common nickname -> canonical first-name map (Western + Filipino) so
// "Mike" matches "Michael" and "Kiko" matches "Francisco".
const NICKMAP: Record<string, string> = {
  // Western
  mike: 'michael', mick: 'michael', mikey: 'michael',
  bob: 'robert', rob: 'robert', bobby: 'robert',
  bill: 'william', will: 'william', billy: 'william',
  liz: 'elizabeth', beth: 'elizabeth', eliza: 'elizabeth',
  jim: 'james', jimmy: 'james',
  tom: 'thomas', tommy: 'thomas',
  dick: 'richard', rick: 'richard', rich: 'richard',
  dave: 'david',
  chris: 'christopher',
  alex: 'alexander', sandy: 'alexander',
  kate: 'katherine', kathy: 'katherine', katie: 'katherine',
  meg: 'margaret', maggie: 'margaret', peggy: 'margaret',
  // PH
  kiko: 'francisco', paco: 'francisco', pancho: 'francisco',
  pepe: 'jose',
  manny: 'emmanuel', noy: 'emmanuel',
  totoy: 'agustin',
  inday: 'maria',
  ising: 'luisa',
  nene: 'irene',
  boy: 'benjamin', ben: 'benjamin',
  jun: 'junior',
};

/** Lowercase + strip everything but a-z so punctuation/spacing/casing
 *  don't change a match. Exported because the quick-add sheet also keys
 *  its session-dedup pool on this. */
export const norm = (s: string) =>
  (s || '').trim().toLowerCase().replace(/[^a-z]/g, '');

const canonFirst = (s: string) => {
  const n = norm(s);
  return NICKMAP[n] ?? n;
};

// Levenshtein edit distance over the normalized forms.
function lev(a: string, b: string): number {
  a = norm(a);
  b = norm(b);
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const del = (prev[j] ?? 0) + 1;
      const ins = (cur[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      cur[j] = Math.min(del, ins, sub);
    }
    prev = cur;
  }
  return prev[n] ?? 0;
}

// Edit-distance tolerance scales with name length so short names need a
// near-exact match while longer names absorb a typo or two.
const lenTol = (s: string) => {
  const L = norm(s).length;
  return L <= 4 ? 1 : L <= 7 ? 2 : 3;
};

type MatchKind = DupKind | false;

function nameMatch(a: string, b: string, allowNick: boolean): MatchKind {
  const na = norm(a),
    nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return 'exact';
  if (allowNick && canonFirst(a) === canonFirst(b)) return 'nick';
  if (lev(a, b) <= Math.min(lenTol(a), lenTol(b))) return 'typo';
  return false;
}

/**
 * Find up to 3 likely duplicates of `(fn, ln)` in `pool`, sorted
 * exact -> nick -> typo. Requires >= 2 normalized chars in each name so
 * a half-typed entry doesn't warn on everyone. Nickname matching is
 * applied to the FIRST name only (last names don't have nicknames).
 */
export function findDuplicates<T extends NameLike>(
  fn: string,
  ln: string,
  pool: T[],
): DupMatch<T>[] {
  if (norm(fn).length < 2 || norm(ln).length < 2) return [];
  const ord: Record<DupKind, number> = { exact: 0, nick: 1, typo: 2 };
  const out: DupMatch<T>[] = [];
  for (const g of pool) {
    const f = nameMatch(fn, g.first_name, true);
    const l = nameMatch(ln, g.last_name, false);
    if (f && l) {
      const kind: DupKind =
        f === 'exact' && l === 'exact'
          ? 'exact'
          : f === 'nick' || l === 'nick'
            ? 'nick'
            : 'typo';
      out.push({ g, kind });
    }
  }
  return out.sort((a, b) => ord[a.kind] - ord[b.kind]).slice(0, 3);
}

/** Short badge label per match kind, shared across add surfaces. */
export const TAG: Record<DupKind, string> = {
  exact: 'Already added',
  nick: 'Same person?',
  typo: 'Typo?',
};
