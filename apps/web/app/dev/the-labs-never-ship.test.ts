/**
 * the-labs-never-ship.test.ts — every `/dev/*` lab sits under ONE production gate (Build 5 fix G2,
 * 2026-11-10). The per-lab `the-lab-never-ships.test.ts` files each hold one page; this holds the WHOLE
 * segment, so a lab added tomorrow cannot ship on the live site by forgetting its own line.
 *
 *   1. `app/dev/layout.tsx` calls `notFound()` in production as its FIRST statement.
 *   2. Every page whose URL starts `/dev` lives in `app/dev/` (a route group such as
 *      `app/(labs)/dev/x/page.tsx` would serve `/dev/x` from OUTSIDE the gated layout).
 *   3. Every `route.ts` handler under `/dev` lives in `app/dev` and refuses production as the FIRST
 *      statement of each exported method — a layout never wraps a route handler, so it must lock itself.
 *   4. Every `'use server'` MODULE under `app/dev` refuses production itself — an exported server
 *      action is its own endpoint, also outside any layout.
 *   5. No production source outside `app/dev` points a link at `/dev` — an `href`, `router.push/replace`
 *      or `redirect` to a `/dev` literal (comments excluded: prose naming the lab a component is drawn in
 *      is not a link; the "never record /dev" lists in `lib/visits`, `lib/page-home`, `lib/ugat` are not
 *      links either).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const DEV = dirname(fileURLToPath(import.meta.url));
const APP = dirname(DEV);
const WEB = dirname(APP);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** The URL a file under `app/` serves: route groups `(x)` and parallel slots `@x` add no segment. */
function urlOf(file: string): string {
  const segs = relative(APP, dirname(file)).split(sep).filter(Boolean);
  return '/' + segs.filter((s) => !(s.startsWith('(') && s.endsWith(')')) && !s.startsWith('@')).join('/');
}

const isTest = (f: string) => /\.(test|spec)\.[cm]?[tj]sx?$/.test(f);
const APP_FILES = walk(APP);
const underDev = (f: string) => f.startsWith(DEV + sep);
const servesDev = (f: string) => /^\/dev(\/|$)/.test(urlOf(f));

test('app/dev/layout.tsx calls notFound() in production before anything else', () => {
  const src = stripComments(readFileSync(join(DEV, 'layout.tsx'), 'utf8'));
  assert.match(src, /import \{ notFound \} from 'next\/navigation';/, 'notFound is not imported');
  const at = src.indexOf('export default function');
  assert.ok(at >= 0, 'the /dev layout has no default export — nothing gates the labs');
  const fn = src.slice(at);
  const body = fn.slice(fn.indexOf('{', fn.indexOf(')')) + 1).trimStart();
  assert.match(
    body,
    /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/,
    'the production 404 is not the first statement of the /dev layout — every lab can render on the live site',
  );
});

test('every page served under /dev lives inside app/dev (under the gated layout)', () => {
  const pages = APP_FILES.filter((f) => /[/\\]page\.[jt]sx?$/.test(f) && servesDev(f));
  assert.ok(pages.length > 0, 'no /dev pages found — the scan is reading the wrong folder');
  const outside = pages.filter((f) => !underDev(f)).map((f) => relative(WEB, f));
  assert.deepEqual(outside, [], `these pages serve /dev/* from outside app/dev/layout.tsx: ${outside.join(', ')}`);
});

test('every route handler under /dev is inside app/dev and refuses production first (a layout never wraps route.ts)', () => {
  const handlers = APP_FILES.filter((f) => /[/\\]route\.[jt]sx?$/.test(f) && servesDev(f));
  const outside = handlers.filter((f) => !underDev(f)).map((f) => relative(WEB, f));
  assert.deepEqual(outside, [], `route handlers serve /dev/* from outside app/dev: ${outside.join(', ')}`);
  const open: string[] = [];
  for (const f of handlers) {
    const src = stripComments(readFileSync(f, 'utf8'));
    const methods = [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g)];
    if (methods.length === 0 || /export\s+(?:const|let|var)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/.test(src)) {
      open.push(`${relative(WEB, f)} (no recognisable method — write each as \`export async function GET(…) {\` with the gate first)`);
      continue;
    }
    for (const m of methods) {
      const from = m.index! + m[0].length;
      const body = src.slice(src.indexOf('{', src.indexOf(')', from)) + 1).trimStart();
      if (!/^if \(process\.env\.NODE_ENV === 'production'\)/.test(body)) open.push(`${relative(WEB, f)} ${m[1]}`);
    }
  }
  assert.deepEqual(open, [], `these /dev route handlers do not refuse production first: ${open.join(', ')}`);
});

test("every 'use server' module under app/dev refuses production itself", () => {
  const modules = APP_FILES.filter((f) => underDev(f) && !isTest(f) && /\.[jt]sx?$/.test(f)).filter((f) =>
    /^['"]use server['"];?/.test(stripComments(readFileSync(f, 'utf8')).trimStart()),
  );
  const open = modules
    .filter((f) => !/process\.env\.NODE_ENV === 'production'\)\s*(throw|notFound\(\)|return)/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  assert.deepEqual(open, [], `these lab server-action modules run in production: ${open.join(', ')}`);
});

test('no production source outside app/dev links into /dev', () => {
  const roots = ['app', 'lib', 'components'].map((d) => join(WEB, d));
  const files = roots
    .flatMap((r) => {
      try {
        return walk(r);
      } catch {
        return [];
      }
    })
    .concat([join(WEB, 'middleware.ts')].filter((f) => {
      try {
        return statSync(f).isFile();
      } catch {
        return false;
      }
    }))
    .filter((f) => /\.[cm]?[jt]sx?$/.test(f) && !isTest(f) && !underDev(f));
  // A link: href= / href: / push( / replace( / redirect( / permanentRedirect( whose target literal starts /dev.
  const LINK = /(?:\bhref\s*[=:]\s*\{?\s*|\b(?:push|replace|redirect|permanentRedirect|prefetch)\(\s*)(['"`])\/dev(?:[/?#]|\1)/;
  const hits = files
    .filter((f) => LINK.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  assert.deepEqual(hits, [], `production code points at a /dev lab: ${hits.join(', ')}`);
});
