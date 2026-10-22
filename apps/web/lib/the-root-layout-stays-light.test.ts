/**
 * the-root-layout-stays-light.test.ts — 📦 WHAT EVERY PAGE DOWNLOADS STAYS WHAT EVERY PAGE USES (2026-10-22).
 *
 * The root layout (`app/layout.tsx`) is above every page, so every module its CLIENT
 * graph reaches is in every page's first load — the front door, a guest's Event Hub,
 * a supplier's Today. Measured 2026-10-22 (`scripts/check-bundle-size.mjs`, which now
 * counts what a page's HTML actually loads): three static imports there shipped code
 * almost no page runs —
 *   · `posthog-provider.tsx` imported the Supabase browser client for a call that only
 *     runs after an analytics yes → the whole Supabase SDK on every page;
 *   · `desktop-updater-listener.tsx` asked `isTauri()` of `lib/desktop-oauth.ts` → the
 *     desktop app's sign-in flow (and Supabase again) on every page;
 *   · `offline-daemon-mount.tsx` imported the offline daemon (IndexedDB queue, five
 *     service handlers, the Papic drain) though it is only RENDERED behind a flag.
 * Each is now loaded where it runs (`import()` in the effect; the accessor in its own
 * import-free `lib/tauri-global.ts`). This walks the root layout's client graph from
 * source and fails if any of them comes back by a STATIC import, on any path.
 *
 * The byte count is the bundle check's job (it needs a build); this is the cheap,
 * per-commit half that names the file that broke it.
 *
 * SABOTAGE (each seen RED, then restored): a static `createClient` import back in
 * posthog-provider · a static sync-daemon import back in offline-daemon-mount ·
 * the updater listener importing `isTauri` from desktop-oauth again.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { stripComments } from './strip-comments';

const WEB = resolve(dirname(new URL(import.meta.url).pathname), '..');
const ROOT_LAYOUT = join(WEB, 'app/layout.tsx');

/** Never in every page's first load. Files are web-relative; packages are specifier prefixes. */
const BANNED_FILES = ['lib/supabase/client.ts', 'lib/offline/sync-daemon.ts', 'lib/desktop-oauth.ts'];
const BANNED_PACKAGES = ['@supabase/'];

const EXT = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

function resolveSpec(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(WEB, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null; // a package
  for (const e of EXT) {
    const p = base + e;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null; // css, json, an asset — not JavaScript we follow
}

/**
 * The specifiers a module loads AT ONCE: value imports and re-exports (`import type` /
 * all-`type` braces are erased), side-effect imports, and `next/dynamic(() => import(x))`
 * unless it says `ssr: false` (an SSR'd dynamic component's chunk is fetched while the page
 * hydrates). A plain `import()` is a later load and is not followed — that is the fix.
 */
function staticSpecs(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/^\s*(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/gm)) {
    if (m[1]) continue;
    const clause = m[2]!.trim();
    const braces = /^\{([\s\S]*)\}$/.exec(clause);
    if (braces && braces[1]!.split(',').map((s) => s.trim()).filter(Boolean).every((s) => s.startsWith('type '))) continue;
    out.push(m[3]!);
  }
  for (const m of src.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)) out.push(m[1]!);
  for (const m of src.matchAll(/\bdynamic\(\s*(?:async\s*)?\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    // Its options follow within the same call: read up to the next `dynamic(` (or 400 chars).
    const rest = src.slice(m.index! + m[0].length, m.index! + m[0].length + 400).split(/\bdynamic\(/)[0]!;
    if (!/ssr\s*:\s*false/.test(rest)) out.push(m[1]!);
  }
  return out;
}

const isDirective = (src: string, d: string) => new RegExp(`^(?:\\s|;)*['"]${d}['"]`).test(src);

/** The root layout's CLIENT graph: every file a 'use client' boundary below it reaches statically, and every package. */
function rootClientGraph() {
  const client = new Set<string>();
  const packages = new Map<string, string>(); // specifier → first client file that imports it
  const seenServer = new Set<string>();
  const via = new Map<string, string>(); // client file → the file that first pulled it in
  const queue: Array<{ file: string; isClient: boolean; from?: string }> = [{ file: ROOT_LAYOUT, isClient: false }];
  while (queue.length) {
    const { file, isClient: inherited, from } = queue.shift()!;
    const raw = stripComments(readFileSync(file, 'utf8'));
    if (inherited && isDirective(raw, 'use server')) continue; // a server action: the client holds a reference, not the code
    const isClient = inherited || isDirective(raw, 'use client');
    if (isClient ? client.has(file) : seenServer.has(file)) continue;
    (isClient ? client : seenServer).add(file);
    if (isClient && from) via.set(relative(WEB, file), relative(WEB, from));
    for (const spec of staticSpecs(raw)) {
      const to = resolveSpec(file, spec);
      if (to) queue.push({ file: to, isClient, from: file });
      else if (isClient && !spec.startsWith('.') && !spec.startsWith('@/') && !packages.has(spec)) packages.set(spec, relative(WEB, file));
    }
  }
  /** The import chain from the root layout to a client file, for the failure message. */
  const chain = (f: string) => {
    const out = [f];
    for (let at = f; via.has(at) && out.length < 30; ) out.unshift((at = via.get(at)!));
    return out.join(' → ');
  };
  return { client: [...client].map((f) => relative(WEB, f)).sort(), packages, chain };
}

test('the root layout’s client graph is seen (the walk is not blind)', () => {
  const { client, packages } = rootClientGraph();
  assert.ok(client.length > 40, `the walk reached only ${client.length} client files from app/layout.tsx`);
  for (const f of ['app/providers.tsx', 'app/_components/posthog-provider.tsx', 'app/_components/offline-daemon-mount.tsx', 'app/_components/desktop-updater-listener.tsx', 'lib/tauri-global.ts']) {
    assert.ok(client.includes(f), `${f} is mounted by the root layout but the walk did not reach it`);
  }
  assert.ok(packages.has('@tanstack/react-query') || [...packages.keys()].some((p) => p.startsWith('@tanstack/')), 'the walk saw no package imports — the parse is broken');
});

test('no page downloads the Supabase SDK, the offline daemon or the desktop sign-in flow because the root layout imports them', () => {
  const { client, packages, chain } = rootClientGraph();
  const files = client.filter((f) => BANNED_FILES.includes(f)).map(chain);
  assert.deepEqual(files, [], `the root layout's client graph statically reaches:\n  ${files.join('\n  ')}\nload it where it runs (import() inside the effect, or the route that uses it)`);
  const pk = [...packages].filter(([p]) => BANNED_PACKAGES.some((b) => p.startsWith(b))).map(([p, by]) => `${p} (from ${chain(by)})`);
  assert.deepEqual(pk, [], `the root layout's client graph statically imports ${pk.join(', ')}`);
});
