/**
 * Leftovers of the "Live Studio Cast" retirement (#4170) — and the three guards
 * that would have caught them.
 *
 * #4170 retired the Cast product: the App Store detail page at
 * `studio/panood` became a redirect and `studio/panood/reviews/**` was deleted.
 * Three references outlived the things they referenced, and CI stayed green for
 * every one of them:
 *
 *   1. `routes.dashboard.addOns.panood.reviews` still built a URL for the
 *      deleted route. `routes.ts`'s own docblock promises that
 *      "scripts/lint-routes.mjs fails the build if a builder points at a folder
 *      that does not exist" — ⚠ THAT SCRIPT IS NOT IN THE REPO. Three files
 *      cite it by name; `node scripts/lint-routes.mjs` is MODULE_NOT_FOUND. The
 *      only thing sweeping `routes.*` against the filesystem is
 *      `suite-doorway-guardrails.test.ts`, and it only walks the handful of
 *      builders the Suite page happens to name — so a builder with NO callers,
 *      which is exactly what a dead one becomes, was unwatched by construction.
 *
 *   2. `scripts/page-masthead-baseline.json` still listed the deleted page. That
 *      ratchet is deliberately non-fatal on stale lines (it prints "remove them
 *      to lock the win in"), so a deleted file quietly widens the exemption
 *      instead of narrowing it.
 *
 *   3. `sku-activation.ts` ran camera-seat provisioning on approval of
 *      PANOOD_SYSTEM / PANOOD_SYSTEM_MOBILE — both is_active=false since
 *      2026-07-25/26, both with zero orders — while LIVE_STUDIO, the SKU
 *      actually on sale, had no hook at all.
 *
 * 🔑 EACH GUARD BELOW IS DERIVED FROM THE FILESYSTEM OR THE IMPORT GRAPH, never
 * from a second hand-typed copy of the same list. A guard that compares two
 * hand-maintained lists drifts with them and stays green while it does.
 *
 * ⚠ What guard 3 does NOT prove: that a paid Live Studio buyer ends up with
 * cameras. It proves the approval path no longer provisions them. The reason
 * that is correct — every camera surface tops up on render, and the unified
 * controller mints a seat per channel — is argued at the removal site in
 * `sku-activation.ts` and is not re-litigated by a source scan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { routes } from '@/lib/routes';

const LIB = dirname(fileURLToPath(import.meta.url));
const WEB = dirname(LIB);
const APP = join(WEB, 'app');

/** Strip block + line comments so a call site is a CALL, not a mention. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/* ── 1 · every add-on route builder addresses a route that exists ──────────── */

/**
 * Resolve a URL path against the App Router tree, honouring `[dynamic]`
 * segments and `(group)` folders (which do not consume a path segment).
 */
function routeExists(dir: string, segments: readonly string[]): boolean {
  if (segments.length === 0) {
    return ['page.tsx', 'page.ts', 'route.ts', 'route.tsx'].some((f) =>
      existsSync(join(dir, f)),
    );
  }
  const [head, ...rest] = segments;
  const literal = join(dir, head!);
  if (existsSync(literal) && statSync(literal).isDirectory() && routeExists(literal, rest)) {
    return true;
  }
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (!existsSync(full) || !statSync(full).isDirectory()) continue;
    // `[id]` / `[...slug]` eat one segment; `(group)` eats none.
    if (/^\[.*\]$/.test(entry) && routeExists(full, rest)) return true;
    if (/^\(.*\)$/.test(entry) && routeExists(full, segments)) return true;
  }
  return false;
}

/** Walk the routes object and call every builder with placeholder segments. */
function builders(node: unknown, prefix: string, out: Array<[string, string]>): void {
  if (typeof node === 'function') {
    out.push([prefix, (node as (...a: string[]) => string)('SEG', 'SEG', 'SEG')]);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      builders(value, prefix ? `${prefix}.${key}` : key, out);
    }
  }
}

test('every routes.dashboard.addOns builder addresses a route that exists on disk', () => {
  const collected: Array<[string, string]> = [];
  builders(routes.dashboard.addOns, 'routes.dashboard.addOns', collected);

  // Sanity: if the walk collects nothing the assertion below is vacuous, which is
  // how a "passing" guard silently stops guarding.
  assert.ok(
    collected.length >= 20,
    `expected the add-on route registry, walked only ${collected.length} builders`,
  );

  const dead = collected
    .filter(([, href]) => {
      const path = href.split('?')[0]!.split('#')[0]!;
      return !routeExists(APP, path.split('/').filter((s) => s.length > 0));
    })
    .map(([ref, href]) => `${ref} → ${href}`);

  assert.deepEqual(
    dead,
    [],
    `Route builder(s) pointing at a route that no longer exists:\n    ${dead.join('\n    ')}`,
  );
});

/* ── 2 · the masthead ratchet may only exempt files that exist ─────────────── */

test('page-masthead-baseline.json lists no file that has been deleted', () => {
  const baselinePath = join(WEB, 'scripts', 'page-masthead-baseline.json');
  const baseline: string[] = JSON.parse(readFileSync(baselinePath, 'utf8'));
  // NON-VACUITY. This asserted `length > 50` — a magic number standing in for
  // "the file was really read". It made the ratchet UN-SHRINKABLE below 50 and
  // so punished the one outcome the lint asks for: its own message reads
  // "migrate to shrink". Porting 94 pages to <PageMasthead> on 2026-08-18 took
  // it 109 → 15 and turned this red for doing the right thing.
  //
  // What it needs to rule out is a baseline that got emptied or garbled, which
  // would make the deleted-file check below pass over nothing. That is what is
  // asserted now, and it stays true at any ratchet size — including 0, the day
  // the last one migrates.
  assert.ok(Array.isArray(baseline), 'the baseline must parse as an array');
  assert.ok(
    baseline.every((rel) => typeof rel === 'string' && rel.endsWith('.tsx')),
    'every baseline entry must be a repo-relative .tsx path',
  );

  const missing = baseline.filter((rel) => !existsSync(join(WEB, rel)));
  assert.deepEqual(
    missing,
    [],
    'The baseline exempts file(s) that no longer exist — a deleted page must ' +
      `shrink the ratchet, never sit in it:\n    ${missing.join('\n    ')}`,
  );
});

/* ── 3 · nothing provisions camera seats at order-approval time ────────────── */

/** Every .ts/.tsx under `lib/` and `app/`, excluding build output. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

test('camera seats are only ever provisioned by a render-time surface, never by an activation hook', () => {
  const definingModule = join(LIB, 'panood-camera-seats.ts');
  const callers = [...sourceFiles(LIB), ...sourceFiles(APP)].filter(
    (file) =>
      file !== definingModule &&
      /\bprovisionPanoodCamerasAdmin\s*\(/.test(code(readFileSync(file, 'utf8'))),
  );

  // Sanity: the camera surfaces DO call it. Zero callers would make the assertion
  // below pass while proving nothing.
  //
  // The floor was 3 and is now 2, and the reason is written down rather than the
  // number quietly lowered: the printable sheet (cameras/print/) STOPPED
  // provisioning seats. It no longer mints anything — it renders the channels the
  // controller has already bound, through the controller's own reader. That is a
  // deliberate removal, not a regression, and `live-studio-cast-retirement.test.ts`
  // asserts the sheet keeps deriving from that shared reader instead of growing a
  // cap of its own again.
  //
  // Two is still a real floor: it keeps the assertion below non-vacuous.
  assert.ok(
    callers.length >= 2,
    `expected the camera surfaces to provision on render, found ${callers.length} caller(s)`,
  );

  const nonRenderCallers = callers
    .filter((file) => !/\/page\.tsx$/.test(file))
    .map((file) => relative(WEB, file));

  assert.deepEqual(
    nonRenderCallers,
    [],
    'Camera seats must be minted where a tier is resolved at render (or per ' +
      'channel by the controller), not fanned out from an order approval:\n    ' +
      nonRenderCallers.join('\n    '),
  );
});

test('no activation hook is registered for a retired Live Studio Cast SKU', () => {
  const src = readFileSync(join(LIB, 'sku-activation.ts'), 'utf8');

  const block = code(src).match(/const EXACT_HOOKS[\s\S]*?\n\}\);/);
  assert.ok(block, 'sku-activation.ts must still declare the EXACT_HOOKS map');

  // Keys of the frozen map: bare identifiers and quoted literals alike.
  const keys = [...block![0].matchAll(/^\s{2}(?:'([A-Z0-9_]+)'|([A-Z0-9_]+)):/gm)].map(
    (m) => m[1] ?? m[2]!,
  );
  assert.ok(keys.length > 10, `expected the hook registry, parsed ${keys.length} key(s)`);

  // PANOOD_SYSTEM (Cast, ₱2,500) and PANOOD_SYSTEM_MOBILE (₱1,500) are both
  // is_active=false with zero orders; LIVE_STUDIO replaced them.
  const retired = keys.filter((k) => k.startsWith('PANOOD_'));
  assert.deepEqual(
    retired,
    [],
    `Activation hook(s) for a retired Cast SKU: ${retired.join(', ')}`,
  );
});
