/**
 * PHANTOM-COLUMN SCANNER, PART 2 — filters and write payloads.
 *
 * `select-column-scan.ts` guards `.select('…')` column lists. It does not, and
 * structurally cannot, see the other two places a column name is typed:
 *
 *   FILTERS   .eq('col', v) · .in('col', […]) · .order('col') · .not('col', …)
 *   WRITES    .insert({ col: v }) · .update({ col: v }) · .upsert({ col: v })
 *
 * Both fail EXACTLY like a bad select — PostgREST rejects the whole statement
 * with `42703 undefined_column`, supabase-js resolves `{ data: null, error }`,
 * and a downstream `?? []` renders the failure as "no rows". The proof this is
 * not theoretical: `lib/ghosting.ts` named its phantom column in BOTH a select
 * and an `.in()`. The select half is what the part-1 guard caught; had the
 * author only filtered on it, nothing would have.
 *
 * A failed WRITE is worse than a failed read, because there is no empty list to
 * notice — the row simply never lands and the caller usually ignores `error`.
 *
 * ── HONEST LIMITS ──────────────────────────────────────────────────────────
 * Deliberately conservative: this reports a column ONLY when it is certain what
 * was written. Everything ambiguous is DROPPED rather than guessed, because a
 * false positive here trains people to add allow-list entries, which is how a
 * ratchet rots into a rubber stamp. Specifically skipped:
 *   · interpolated literals (`.eq(\`${col}\`, …)`) — unknowable statically
 *   · qualified / embedded references (`.eq('vendor_services.is_active', …)`),
 *     which target a JOINED table, not `from()`'s table
 *   · JSON paths (`.eq('config->>key', …)`)
 *   · object literals containing a spread (`{ ...patch, id }`) or a computed
 *     key (`{ [k]: v }`) — the real key set is not statically known
 *   · `.insert(someVariable)` — no literal to read
 * Attribution is a CHAIN WALK rather than part 1's character window — see
 * `readChain` below for why the window was not good enough here.
 */
import { readFileSync } from 'node:fs';
import {
  APP_ROOT,
  collectSourceFiles,
  isTestFile,
  type SelectSite,
} from './select-column-scan';

const FROM_RE = /\.from\(\s*'([a-z0-9_]+)'\s*\)/gi;

/**
 * ATTRIBUTION IS A CHAIN WALK, NOT A CHARACTER WINDOW.
 *
 * Part 1 scans a fixed 700-character window after `.from('t')`. That is fine for
 * `.select()` (the first one in the window is essentially always the right one)
 * but WRONG for filters, which are numerous and appear in neighbouring
 * statements. A window produced a 67% false-positive rate on first run — every
 * one from a different leak:
 *
 *   · `.from(sourceTable)` — a DYNAMIC table name. The literal-only `.from()`
 *     regex does not match it, so the window never closed and the next
 *     statement's `.eq('moderation_state', …)` was blamed on `photo_tags`.
 *   · `headCount(admin, 'service_categories', (q) => q.eq('tier', 1))` — a
 *     helper taking the table as a STRING ARGUMENT. No `.from()` at all, so
 *     again the window did not close.
 *   · a filter written inside a `//` COMMENT, quoted while explaining the code
 *     below it, counted as if it were the code.
 *
 * So instead: from the end of `.from('t')`, consume only calls that CONTINUE
 * THE SAME METHOD CHAIN — `.method(…)` with balanced parens, whitespace and
 * comments allowed between links. The first token that is not `.identifier(`
 * ends the chain, which is exactly where the statement ends. A dynamic
 * `.from(x)` is itself a chain link and is consumed harmlessly; a separate
 * statement is simply never reached.
 */
function readChain(src: string, start: number): string {
  let i = start;
  const out: string[] = [];
  for (;;) {
    // Skip whitespace and comments between links.
    for (;;) {
      while (i < src.length && /\s/.test(src[i]!)) i++;
      if (src.startsWith('//', i)) {
        const nl = src.indexOf('\n', i);
        if (nl === -1) return out.join('');
        i = nl + 1;
        continue;
      }
      if (src.startsWith('/*', i)) {
        const end = src.indexOf('*/', i);
        if (end === -1) return out.join('');
        i = end + 2;
        continue;
      }
      break;
    }
    const m = /^\.([A-Za-z_$][\w$]*)\(/.exec(src.slice(i, i + 64));
    if (!m) return out.join('');
    const openParen = i + m[0].length - 1;
    // Consume to the matching close paren, respecting nesting, strings AND
    // COMMENTS. Comments matter: an apostrophe in prose (`// the couple's row`)
    // inside a `.insert({…})` argument would otherwise open a string that never
    // closes, so the matcher runs past the statement and the NEXT statement's
    // insert keys get blamed on this table. That is exactly how a single
    // `.from('events')` was credited with 16 columns belonging to
    // `event_members` / `guests`.
    let depth = 0;
    let j = openParen;
    let quote: string | null = null;
    for (; j < src.length; j++) {
      const ch = src[j]!;
      if (quote) {
        if (ch === '\\') j++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '/' && src[j + 1] === '/') {
        const nl = src.indexOf('\n', j);
        if (nl === -1) break;
        j = nl;
        continue;
      }
      if (ch === '/' && src[j + 1] === '*') {
        const end = src.indexOf('*/', j);
        if (end === -1) break;
        j = end + 1;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') quote = ch;
      else if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    if (j >= src.length) return out.join('');
    out.push(src.slice(i, j + 1));
    i = j + 1;
  }
}

/**
 * PostgREST filter builders whose FIRST argument is a column name.
 *
 * `.select` is excluded (part 1 owns it). `.or()` is excluded on purpose: its
 * argument is a mini-language (`a.eq.1,b.is.null`) whose parsing is a separate
 * problem, and half-parsing it would produce exactly the false positives this
 * module refuses to emit.
 */
const FILTER_METHODS = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'like', 'ilike', 'likeAllOf', 'likeAnyOf',
  'is', 'in', 'contains', 'containedBy', 'overlaps',
  'rangeGt', 'rangeGte', 'rangeLt', 'rangeLte', 'rangeAdjacent',
  'order', 'not', 'filter',
] as const;

const FILTER_RE = new RegExp(
  `\\.(${FILTER_METHODS.join('|')})\\(\\s*(?:'([^']*)'|"([^"]*)")`,
  'g',
);

/** `.insert({…})` / `.update({…})` / `.upsert({…})`, optionally array-wrapped. */
const WRITE_RE = /\.(insert|update|upsert)\(\s*(\[\s*)?\{/g;

/**
 * A column name we are CERTAIN about, or null to drop it.
 * See HONEST LIMITS — every rejection here is a deliberate false-negative.
 */
function cleanColumn(raw: string): string | null {
  const c = raw.trim();
  if (!c) return null;
  if (c.includes('${')) return null; // interpolated
  if (c.includes('.')) return null; // embedded/joined table reference
  if (c.includes('->')) return null; // json path
  if (!/^[a-z0-9_]+$/i.test(c)) return null;
  return c;
}

/** Read the balanced `{…}` starting at `open`, or null if it never closes. */
function readObjectLiteral(src: string, open: number): string | null {
  let depth = 0;
  for (let i = open; i < src.length && i < open + 4000; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/**
 * Top-level keys of an object literal. Returns null — meaning "refuse to
 * judge" — when a spread or computed key makes the key set unknowable.
 */
export function parseObjectKeys(objLiteral: string): string[] | null {
  const body = objLiteral.slice(1, -1);
  if (body.includes('...')) return null; // spread: unknown key set
  const keys: string[] = [];
  let depth = 0;
  let buf = '';
  let quote: string | null = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (quote) {
      if (ch === quote && body[i - 1] !== '\\') quote = null;
      buf += ch;
      continue;
    }
    // Comments must be skipped BEFORE the quote check — prose apostrophes
    // ("the couple's row") would otherwise open a string that never closes,
    // swallowing the keys that follow. Same class of bug as in `readChain`.
    if (ch === '/' && body[i + 1] === '/') {
      const nl = body.indexOf('\n', i);
      if (nl === -1) break;
      i = nl;
      continue;
    }
    if (ch === '/' && body[i + 1] === '*') {
      const end = body.indexOf('*/', i);
      if (end === -1) break;
      i = end + 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      keys.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  keys.push(buf);

  const out: string[] = [];
  for (const seg of keys) {
    const s = seg.trim();
    if (!s) continue;
    if (s.startsWith('[')) return null; // computed key: unknown
    // `key: value` — take the key. A bare `key` shorthand has no colon.
    const colon = s.indexOf(':');
    const rawKey = colon === -1 ? s : s.slice(0, colon);
    const cleaned = cleanColumn(rawKey.replace(/^['"`]|['"`]$/g, ''));
    if (cleaned) out.push(cleaned);
  }
  return out;
}

/** Every `.from('t')` → filter-method column reference in one source string. */
export function extractFilterSites(source: string, file: string): SelectSite[] {
  const sites: SelectSite[] = [];
  const fromRe = new RegExp(FROM_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(source))) {
    const table = m[1];
    if (!table) continue;
    const scope = readChain(source, fromRe.lastIndex);

    const columns: string[] = [];
    const filterRe = new RegExp(FILTER_RE.source, 'g');
    let f: RegExpExecArray | null;
    while ((f = filterRe.exec(scope))) {
      const col = cleanColumn(f[2] ?? f[3] ?? '');
      if (col) columns.push(col);
    }
    if (columns.length === 0) continue;
    sites.push({
      file,
      line: source.slice(0, m.index).split('\n').length,
      table,
      columns: [...new Set(columns)],
    });
  }
  return sites;
}

/** Every `.from('t')` → insert/update/upsert payload key in one source string. */
export function extractWriteSites(source: string, file: string): SelectSite[] {
  const sites: SelectSite[] = [];
  const fromRe = new RegExp(FROM_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(source))) {
    const table = m[1];
    if (!table) continue;
    const scope = readChain(source, fromRe.lastIndex);

    const columns: string[] = [];
    const writeRe = new RegExp(WRITE_RE.source, 'g');
    let w: RegExpExecArray | null;
    let unknown = false;
    while ((w = writeRe.exec(scope))) {
      const braceAt = scope.indexOf('{', w.index);
      if (braceAt === -1) continue;
      const obj = readObjectLiteral(scope, braceAt);
      if (!obj) continue;
      const keys = parseObjectKeys(obj);
      if (keys === null) {
        unknown = true; // spread / computed key — refuse to judge this site
        break;
      }
      columns.push(...keys);
    }
    if (unknown || columns.length === 0) continue;
    sites.push({
      file,
      line: source.slice(0, m.index).split('\n').length,
      table,
      columns: [...new Set(columns)],
    });
  }
  return sites;
}

function scanWith(
  extract: (source: string, file: string) => SelectSite[],
  root: string,
): SelectSite[] {
  const out: SelectSite[] = [];
  for (const abs of collectSourceFiles(root)) {
    const rel = abs.slice(root.length + 1);
    if (isTestFile(abs)) continue;
    out.push(...extract(readFileSync(abs, 'utf8'), rel));
  }
  return out;
}

export function scanFilterSites(root: string = APP_ROOT): SelectSite[] {
  return scanWith(extractFilterSites, root);
}

export function scanWriteSites(root: string = APP_ROOT): SelectSite[] {
  return scanWith(extractWriteSites, root);
}
