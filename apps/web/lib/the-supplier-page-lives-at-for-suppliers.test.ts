/**
 * The supplier page lives at /for-suppliers, and every old address forwards.
 *
 * Owner, DECISION_LOG 2026-09-29 "LANE 2 §2C" (3): "Supplier sign-up moves
 * /vendors → /for-suppliers with a permanent forward from the old address."
 *
 * What would silently undo it, each held below:
 *   · the redirect turning temporary, or chaining through /vendors (search
 *     engines follow a 308 chain reluctantly and a 307 not at all for ranking);
 *   · a page file reappearing at app/vendors/page.tsx, which would SHADOW the
 *     redirect — Next serves the page and never consults redirects();
 *   · a link, sitemap line or canonical still naming /vendors — each costs a
 *     hop, and a canonical pointing at a redirect tells Google to index nothing;
 *   · the old marketplace subpaths (/vendors/*) being swept into the supplier
 *     page. They were the MARKETPLACE and keep their own 308 to /explore.
 *
 * SABOTAGE (run once, 2026-09-30): each assertion was broken by hand and went
 * RED — `permanent: false`; destination '/vendors'; restoring a
 * `href="/vendors"` in reskin-footer.tsx; the sitemap path; the canonical.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('/vendors and /for-vendors are PERMANENT redirects straight to /for-suppliers', () => {
  const config = read('next.config.ts');
  for (const source of ['/vendors', '/for-vendors']) {
    const rule = new RegExp(
      `\\{\\s*source:\\s*'${source}',\\s*destination:\\s*'/for-suppliers',\\s*permanent:\\s*true\\s*\\}`,
    );
    assert.match(config, rule, `${source} must be a permanent redirect to /for-suppliers`);
  }
  assert.doesNotMatch(
    config,
    /destination:\s*'\/vendors'/,
    'something still redirects TO /vendors — a two-hop chain to the supplier page',
  );
});

test('the page is at app/for-suppliers, and nothing shadows the old address', () => {
  assert.ok(existsSync(join(WEB, 'app/for-suppliers/page.tsx')), 'the supplier page is missing');
  assert.ok(
    !existsSync(join(WEB, 'app/vendors/page.tsx')),
    'app/vendors/page.tsx exists again — Next serves it and the permanent redirect never fires',
  );
  const page = read('app/for-suppliers/page.tsx');
  assert.match(page, /canonical: '\/for-suppliers'/, 'the canonical must name the new address');
  assert.doesNotMatch(page, /\$\{SITE_URL\}\/vendors/, 'the structured data still names /vendors');
});

test('the sitemap lists /for-suppliers and never the redirect', () => {
  const sitemap = read('app/sitemap-static.xml/route.ts');
  assert.match(sitemap, /path: '\/for-suppliers'/);
  assert.doesNotMatch(sitemap, /path: '\/vendors'/, 'a sitemap must never list a redirect');
});

test('the old MARKETPLACE subpaths still go to /explore, not to the supplier page', () => {
  const mw = read('middleware.ts');
  assert.match(mw, /pathname\.startsWith\('\/vendors\/'\)/);
  assert.match(mw, /new URL\(`\/explore\$\{rest\}\$\{search\}`/);
});

/** Every app/lib/components source file, tests excluded. */
function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
    }
  };
  for (const root of ['app', 'lib', 'components']) walk(join(WEB, root));
  return out;
}

test('no link, redirect target or listed path still names /vendors', () => {
  // A LINK to /vendors — an href, a url() helper, a route string, a path list
  // entry. `/vendors/…` subpaths and `/dashboard/[eventId]/vendors` are other
  // routes and do not match (the character after `/vendors` must end it).
  const LINK = /(?:href=|url\(|route:\s*|url:\s*|path:\s*|^\s*)["'`]\/vendors(?:[#?][^"'`]*)?["'`]/m;
  const offenders: string[] = [];
  for (const file of sources()) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments may tell history
      if (LINK.test(line)) offenders.push(`${relative(WEB, file)}:${i + 1}  ${line.trim()}`);
    });
  }
  // One file is ALLOWED to name it: the redirect itself.
  const allowed = offenders.filter((o) => !o.startsWith('next.config.ts'));
  assert.deepEqual(allowed, [], 'these still send people to /vendors — point them at /for-suppliers');
});
