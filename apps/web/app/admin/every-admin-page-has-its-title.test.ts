/**
 * 🏷 EVERY ADMIN SCREEN NAMES ITSELF, AND BY ONE NAME (L7 · D5, walk 27 Nov 2026 — "admin page titles missing /
 * inconsistent"; CLAUDE.md §3: every page has a `PageMasthead`).
 *
 * In the console the masthead is the page's `sr-only` <h1> (the visible name is the layout's pinned row — owner
 * 21 Aug, `admin-page-starts-at-its-content.test.ts`). Measured on 068460f: five admin pages drew no heading at all
 * (Fees owed, Payouts, Team help, the Root map's Entity map, a Demo inquiry), and fifteen named themselves one thing in
 * the browser tab and another to a screen reader ("Supplier verification documents" vs "Verification documents",
 * "Setnayan channel pool" vs "Live Watch channels", "Demand Radar" vs "Demand radar", …).
 *
 *   1 · every admin `page.tsx` reaches a title — a `PageMasthead`, a record's `RecordHead`, a tab's `TabLanding`, an <h1>, or the
 *       page it renders — itself or through a file it imports from `app/admin`;
 *   2 · where a page carries a typed `metadata.title` and a typed masthead title, the masthead says the tab's first
 *       words (`PageMasthead`'s own docblock: "Prefer the page's own `metadata.title` string so the two cannot drift").
 *
 * No baseline: the list is zero, and stays zero.
 * 🛡 SABOTAGE (seen RED, then restored): `<PageMasthead title="Fees owed" />` removed from booking-fees (red: 1) · the receipts masthead put
 * back to "Transaction receipts" (red: 2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const ADMIN = join(WEB, 'app/admin');

function pages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (name === 'page.tsx') out.push(p);
  }
  return out;
}

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

/** A file this one imports, resolved — only inside `app/admin` (the shared kit's own files are not a page's title). */
function imports(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const m of src.matchAll(/from '((?:\.{1,2}\/|@\/app\/admin\/)[^']+)'/g)) {
    const spec = m[1]!;
    const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : resolve(dirname(file), spec);
    for (const c of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'page.tsx')]) {
      if (existsSync(c) && c.startsWith(ADMIN)) {
        out.push(c);
        break;
      }
    }
  }
  return out;
}

/** A printed filing keeps its visible <h1> on purpose (`compliance/data-sheet`) — a heading is a title too. */
const NAMES_ITSELF = /<PageMasthead\b|<RecordHead\b|<TabLanding\b|<FocusHome\b|<h1\b/;
/** A page that only forwards (a redirect stub, or `notFound`) has no screen to name. */
const FORWARDS_ONLY = /^\s*(?:redirect|permanentRedirect)\(/m;

function reachesATitle(file: string, seen = new Set<string>(), depth = 0): boolean {
  if (seen.has(file) || depth > 3) return false;
  seen.add(file);
  if (NAMES_ITSELF.test(read(file))) return true;
  return imports(file).some((f) => reachesATitle(f, seen, depth + 1));
}

const ALL = pages(ADMIN);

test('1 · every admin page reaches a title', () => {
  assert.ok(ALL.length > 100, `expected the admin pages, found ${ALL.length}`);
  const missing = ALL.filter((p) => {
    const src = read(p);
    if (FORWARDS_ONLY.test(src) && !/return \(/.test(src)) return false;
    return !reachesATitle(p);
  }).map((p) => relative(WEB, p));
  assert.deepEqual(missing, [], `admin pages with no title:\n${missing.join('\n')}`);
});

test('2 · a page’s masthead says what its browser tab says', () => {
  const drift: string[] = [];
  for (const p of ALL) {
    const src = read(p);
    const meta = src.match(/export const metadata = \{ title: '([^']+)' \}/)?.[1];
    const mast = src.match(/<PageMasthead\b[^>]*?\btitle="([^"]+)"/)?.[1];
    if (!meta || !mast) continue;
    const tab = meta.split(' · ')[0]!.trim();
    if (tab !== mast) drift.push(`${relative(WEB, p)}: tab "${tab}" · masthead "${mast}"`);
  }
  assert.deepEqual(drift, [], `admin pages named two ways:\n${drift.join('\n')}`);
});
