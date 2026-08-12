import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const WEB = join(import.meta.dirname, '..');
const APP = join(WEB, 'app');

/**
 * GUARD — the correction queue must have a DOORWAY, not just a mechanism.
 *
 * `requestProfileCorrection` shipped complete, with an admin queue at
 * /admin/corrections built to resolve what it files — and **zero callers**. No
 * screen anywhere rendered a form for it, so production held ZERO rows: the
 * queue could never receive anything, and a permanently wrong shop address had
 * no remedy a vendor could reach.
 *
 * 🔑 A MECHANISM NOBODY CAN REACH IS NOT A FEATURE — this repo's recurring defect.
 *
 * ⚠ AND THE FIRST VERSION OF THIS GUARD HAD THE SAME DISEASE. It asked "does
 * any file call the action?" — which the CARD satisfies all by itself. Deleting
 * the card's mount from the page left the guard GREEN while the doorway was
 * gone. A component that calls an action but is never MOUNTED is exactly as
 * unreachable as no component at all.
 *
 * So this walks the import graph from the ROUTE ENTRIES Next.js actually
 * renders (`page.tsx` / `layout.tsx` / `route.ts`). That is the property that
 * was missing, and the property a rename or an unmount really breaks.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const ROUTE_ENTRIES = walk(APP).filter((p) => /\/(page|layout|route)\.tsx?$/.test(p));

/** Resolve an import specifier to a file on disk, or null for a package. */
function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(WEB, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

const IMPORT_RE = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/** Every file reachable from a route entry by following imports. */
function reachableFromRoutes(): Set<string> {
  const seen = new Set<string>();
  const queue = [...ROUTE_ENTRIES];
  while (queue.length) {
    const f = queue.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    let src: string;
    try {
      src = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const m of src.matchAll(IMPORT_RE)) {
      const target = resolveImport(f, m[1]!);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return seen;
}

const REACHABLE = reachableFromRoutes();

/**
 * Source with comments removed.
 *
 * ⚠ THE SECOND VERSION OF THIS GUARD MATCHED PROSE. `/admin/corrections`
 * carries comments explaining that nothing can file a request — and those
 * comments contain the symbol, so the guard found a "caller" in the very files
 * documenting its absence. A guard that a paragraph can satisfy is decoration.
 */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => (l.trimStart().startsWith('//') ? '' : l))
    .join('\n');
}

test('PRECONDITION: the import walk actually reaches things', () => {
  // Without this, a broken resolver makes every assertion below vacuous — an
  // empty set trivially contains no unreachable action, and the suite would go
  // green while measuring nothing.
  assert.ok(ROUTE_ENTRIES.length > 100, `only ${ROUTE_ENTRIES.length} route entries found`);
  assert.ok(
    REACHABLE.size > ROUTE_ENTRIES.length,
    'the walk followed no imports at all — the resolver is broken',
  );
});

test('a vendor can actually REACH the correction request action', () => {
  const definer = join(APP, 'vendor-dashboard/actions.ts');
  const callers = [...REACHABLE].filter(
    // Must be REAL code — an import of it or a call to it — not a mention.
    (p) => p !== definer && /\brequestProfileCorrection\b/.test(code(p)),
  );
  assert.ok(
    callers.length > 0,
    'requestProfileCorrection is not reachable from ANY route Next.js renders — so the ' +
      'admin queue that resolves these requests can never receive one, and a permanently ' +
      'wrong shop address has no remedy a vendor can reach. That was true in production.',
  );
});

test('the card is MOUNTED by a page, not merely imported', () => {
  // ⚠ THE IMPORT-GRAPH WALK IS NOT ENOUGH ON ITS OWN. It follows import PATHS,
  // so deleting the JSX element while leaving the import line keeps the card
  // "reachable" and the guard green — with no doorway on the screen. That is
  // the same shape as the two earlier versions of this guard, which both
  // passed while the button was gone.
  const page = readFileSync(join(APP, 'vendor-dashboard/shop/page.tsx'), 'utf8');
  assert.match(
    page,
    /<RequestCorrectionCard\b/,
    'the card is imported but never RENDERED — the vendor has no way to file a request, ' +
      'which is exactly the state that made the whole queue dead for months',
  );
});

test('the vendor-side card offers the WEB ADDRESS to every tier', () => {
  // The address is immutable for EVERYONE, not just verified shops — a signup
  // typo is exactly how a wrong address happens, long before verification. If
  // this field ever falls behind the verified gate, the vendors who most need
  // it are the ones who lose it.
  const src = readFileSync(
    join(APP, 'vendor-dashboard/shop/_components/request-correction-card.tsx'),
    'utf8',
  );
  assert.match(
    src,
    /isVerified\s*\?\s*\[\s*'business_slug'[\s\S]{0,80}\]\s*:\s*\[\s*'business_slug'\s*\]/,
    'the web address must be offered whether or not the shop is verified',
  );
});

test('the admin side can still resolve what the vendor files', () => {
  const admin = readFileSync(join(APP, 'admin/corrections/page.tsx'), 'utf8');
  for (const fn of ['applyCorrectionRequest', 'declineCorrectionRequest']) {
    assert.match(admin, new RegExp(`\\b${fn}\\b`), `${fn} is no longer wired into the queue`);
  }
});
