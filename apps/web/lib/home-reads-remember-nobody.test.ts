/**
 * home-reads-remember-nobody.test.ts — ⛔ NOTHING ABOUT THE PERSON LOOKING IS
 * REACHABLE FROM A REMEMBERED READ.
 *
 * A remembered read is stored once and handed to every visitor. If one of them
 * could reach the session — `cookies()`, `headers()`, the viewer-scoped
 * Supabase client, `lib/auth`, the view-as-free switch — one person's answer
 * would be shown to the next.
 *
 * ⚠ NEXT DOES NOT CATCH THIS FOR US. Inside `unstable_cache` it throws on
 * `cookies()` — but `resolveProfile` (`lib/event-type-profile.ts`) and the
 * view-as-free switch (`lib/view-as-free.server.ts`) CATCH that throw and
 * answer with a default. A remembered function that reached either would not
 * fail; it would remember the default for everybody, in silence. So the
 * property is held on the IMPORT GRAPH: the two modules that hold the
 * remembered reads may not import, at any depth, a module that can see a
 * session.
 *
 * It is a property of the graph, not a phrasing: a new import three files away
 * fails this the same as one typed into the reads themselves.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');

/** The modules that hold remembered reads. A new one joins this list — and this guard. */
const REMEMBERED_MODULES = [
  'lib/home-public-reads.ts',
  'lib/home-public-reads-core.ts',
  // ⚡ The VIEWER-FREE half of the Discover card's cover (2026-10-11): the body
  // that draws it from remembered public facts, and the two rules it composes
  // with their one read lifted out. They are not remembered themselves — they
  // are what stands between a remembered fact and a card every visitor sees, so
  // they are held to the same graph.
  'lib/event-cover-given.ts',
  'lib/hub-look-given.ts',
  'lib/event-poster-given.ts',
];

/** A module that can see who is looking. */
const SESSION_PACKAGES = ['next/headers'];
const SESSION_MODULES = [
  'lib/supabase/server.ts',
  'lib/supabase/client.ts',
  'lib/auth.ts',
  'lib/view-as-free.server.ts',
  'lib/demo-mode.ts',
];

const IMPORT =
  /(?:import|export)\s+(type\s+)?(?:[^'"`;]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveLocal(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(WEB, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null;
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (existsSync(base + ext)) return base + ext;
  }
  return null;
}

/** Every module reachable from `entry` (static and dynamic imports; type-only imports erased), with how. */
function reach(entry: string): { local: Map<string, string | null>; packages: Map<string, string> } {
  const start = join(WEB, entry);
  const local = new Map<string, string | null>([[start, null]]);
  const packages = new Map<string, string>();
  const queue = [start];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(IMPORT)) {
      if (m[1]) continue; // `import type` — erased at build, carries no code
      const spec = (m[2] ?? m[3]) as string;
      const target = resolveLocal(file, spec);
      if (!target) {
        if (!spec.startsWith('.') && !spec.startsWith('@/') && !packages.has(spec)) packages.set(spec, file);
        continue;
      }
      if (!local.has(target)) {
        local.set(target, file);
        queue.push(target);
      }
    }
  }
  return { local, packages };
}

function pathTo(local: Map<string, string | null>, file: string): string {
  const chain: string[] = [];
  for (let at: string | null | undefined = file; at; at = local.get(at)) chain.push(relative(WEB, at));
  return chain.reverse().join(' → ');
}

function sessionReach(entry: string): string[] {
  const { local, packages } = reach(entry);
  const found: string[] = [];
  for (const pkg of SESSION_PACKAGES) {
    const via = packages.get(pkg);
    if (via) found.push(`${pkg}  via  ${pathTo(local, via)}`);
  }
  for (const mod of SESSION_MODULES) {
    const abs = join(WEB, mod);
    if (local.has(abs)) found.push(pathTo(local, abs));
  }
  return found;
}

test('the walker CAN hit — the viewer half of Discover really does reach the session', () => {
  // Without this, an import pattern the walker cannot parse would read as "clean".
  const found = sessionReach('lib/discover-events.ts');
  assert.ok(
    found.some((f) => f.includes('lib/supabase/server.ts')),
    'the walker no longer finds the session client behind lib/discover-events.ts — it is blind, not clean',
  );
  assert.ok(found.some((f) => f.startsWith('next/headers')), 'the walker no longer finds next/headers anywhere');
});

for (const entry of REMEMBERED_MODULES) {
  test(`${entry} cannot reach a session, at any depth`, () => {
    const { local } = reach(entry);
    assert.ok(local.size >= 3, `${entry}: the walk found only ${local.size} modules — it did not follow the imports`);
    const found = sessionReach(entry);
    assert.deepEqual(
      found,
      [],
      `${entry} can reach a module that sees who is looking. A remembered read is handed to EVERY ` +
        `visitor, so whatever that module answers for one person would be shown to the next:\n  ` +
        found.join('\n  ') +
        `\nMove the per-viewer read out of the remembered function (ask it per request, over the ` +
        `remembered rows), or stop remembering this read.`,
    );
  });
}

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$|\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

test('every remembered read lives in a module this guard walks', () => {
  const files = [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))];
  assert.ok(files.length > 500, `expected the app+lib sources, found ${files.length}`);
  const allowed = new Set(['lib/home-public-reads.ts', 'lib/home-public-reads-core.ts', 'lib/remembered-read.ts']);
  const callers = files
    .filter((f) => /\b(?:rememberPublicRead|rememberWith|makeHomePublicReads)\(/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f))
    .filter((f) => !allowed.has(f) && f !== 'lib/remembered-read-core.ts');
  assert.deepEqual(
    callers,
    [],
    'a read is remembered from a module this guard does not walk. Add the module to ' +
      'REMEMBERED_MODULES here (its import graph must then be free of the session), or do not remember it.',
  );
});

test('a remembered read takes a date, public event ids, a limit or nothing — never a person', () => {
  const core = stripComments(readFileSync(join(WEB, 'lib/home-public-reads-core.ts'), 'utf8'));
  const params = [...core.matchAll(/deps\.remember\(\(([^)]*)\)\s*=>/g)].map((m) => (m[1] as string).trim());
  assert.equal(params.length, 7, `expected the seven remembered reads, found ${params.length}`);
  for (const p of params) {
    assert.ok(
      ['todayISO: string', 'eventIds: string[]', 'limit: number', ''].includes(p),
      `a remembered read takes (${p}). Its arguments are its cache key AND its only inputs — ` +
        'a viewer, a user id or a session there would key one entry per person, or leak one to the next.',
    );
  }
  assert.doesNotMatch(
    core,
    /\.auth\.|getUser\(|getCurrentUser\(|cookies\(|headers\(|follower_user_id|createClient\(/,
    'the remembered reads now touch the session or the viewer’s own rows',
  );
  // The ownership it remembers is the REAL one — never the one a viewer is shown.
  assert.match(core, /eventCoupleWebsiteProActive\(admin, id\)/, 'the remembered ownership is no longer the gate every write uses');
  assert.doesNotMatch(core, /websiteProActiveFor|asViewed|viewingAsFreeCouple/, 'a remembered fact is being read as a viewer is shown it');
});

test('👁 the view-as-free switch still decides: remembered facts dress a card only for a viewer who has it OFF', () => {
  /*
    The remembered ownership is the REAL one. "View as a free couple" is how the
    owner previews the free tier, and it must keep working on the home page's
    cards — so the loader may hand a cover the remembered facts in exactly one
    place, and only after asking the switch for THIS request. Read from the
    source: the loader is server-only and cannot be run here; the body it calls
    is run in `lib/event-cover-given.test.ts`.
  */
  const loader = stripComments(readFileSync(join(WEB, 'lib/discover-events.ts'), 'utf8'));
  const uses = [...loader.matchAll(/publicCoverIo\(r, /g)];
  assert.equal(uses.length, 1, `the remembered facts are handed to a cover in ${uses.length} places — there must be exactly one`);
  assert.match(
    loader,
    /const \[types, viewingAsFree\] = await Promise\.all\(\[publicEventTypes\(\), viewingAsFreeCouple\(\)\.catch\(\(\) => false\)\]\);/,
    'the loader no longer asks whether this viewer is viewing as a free couple',
  );
  assert.match(
    loader,
    /types && !viewingAsFree\s*\? await dressEventCoverGiven\(r, heroConfig, publicCoverIo\(r, rows\.facts\[r\.event_id\], types\)\)\s*: await dressEventCover\(r, heroConfig\)/,
    'a card may be dressed from remembered facts for a viewer who is viewing as a free couple',
  );
  // …and everything else — the event Home's header, and that viewer — is answered as the viewer is shown it.
  assert.match(
    loader,
    /export async function dressEventCover\(r: CoverRow, heroConfig: unknown\): Promise<DressedEventCover> \{\s*return dressEventCoverGiven\(r, heroConfig, viewedCoverIo\(r\)\);\s*\}/,
  );
  assert.match(loader, /ownsPro: \(\) => websiteProActiveFor\(r\.event_id\),/, 'the as-viewed reader no longer goes through the view switch');
});
