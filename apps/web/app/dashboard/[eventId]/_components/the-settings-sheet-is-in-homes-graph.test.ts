/**
 * 🔒 HOME'S ⚙ SHEET IS IN HOME'S GRAPH, so the rows its action RETURNS can render (2026-10-29).
 *
 * WHAT BROKE (#7036, live on the owner's real event): Home's ⚙ reads Event Settings with a server action
 * (`openEventSettings`) that returns RENDERED rows: the Maker's editors. Next serialises a client component in an
 * action's answer through the CALLING ROUTE's client manifest, and it builds that manifest only from the route's
 * SERVER imports. The ⚙ reached the action only from the browser (`import()`), which records nothing, so in
 * production the action answered 200 with each editor as an error chunk ("Could not find the module … in the React
 * Client Manifest") and Home fell to "Something on our end didn't work". The Home lab never saw it: its rows were drawn
 * by the lab PAGE, whose own server imports reach the editors.
 *
 * Reproduced on a minimal Next 15.5 build (the repo's own `next`): an action reached only by a client `import()`
 * answers `E{digest}` for its client component; adding the same `import()` of the component on the client does NOT
 * help (the manifest is the route's SERVER graph); a side-effect import of the action from the page's server file
 * makes it answer `I[…, chunks, "Editor"]`.
 *
 * THE PROPERTY: every client module the action's answer mounts directly (the first `'use client'` module on each path
 * out of the action's server graph) is ALSO reached at a server→client boundary from Home's own server files.
 * A plain source walk — relative and `@/` imports, `import type` skipped — is enough: Next's rule is about imports.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';
import { dirname, join, relative, resolve } from 'node:path';

const WEB = resolve(__dirname, '../../../..');
const EXTS = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts'];

function resolveSpec(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(WEB, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null;
  for (const e of EXTS) {
    const p = base + e;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

function directive(src: string): 'client' | 'server' | null {
  const m = src.replace(/^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, '').match(/^['"]use (client|server)['"]/);
  return m ? (m[1] as 'client' | 'server') : null;
}

function importsOf(src: string): string[] {
  const out: string[] = [];
  // Statements only: anchored at a line start, and the specifier list may not cross a `;` or a quote — so a word
  // "import" in a comment can never swallow the next real import (it did, in this test's first draft).
  const statement = /^[ \t]*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
  const dynamic = /import\(\s*(?:\/\*[\s\S]*?\*\/\s*)?['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = statement.exec(src))) if (!m[1] && m[2]) out.push(m[2]);
  while ((m = dynamic.exec(src))) if (m[1]) out.push(m[1]);
  return out;
}

/** The client modules first reached from server code — the ones Next records in the route's client manifest. */
function serverToClientBoundary(starts: string[]): Set<string> {
  const seen = new Set<string>();
  const boundary = new Set<string>();
  const queue = starts.map((f) => resolve(WEB, f));
  while (queue.length) {
    const f = queue.shift()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = readFileSync(f, 'utf8');
    if (directive(src) === 'client') {
      boundary.add(relative(WEB, f));
      continue; // past here it is the client's own bundle, not the manifest
    }
    for (const s of importsOf(src)) {
      const r = resolveSpec(s, f);
      if (r) queue.push(r);
    }
  }
  return boundary;
}

const ACTION = 'app/dashboard/[eventId]/_components/open-event-settings.tsx';
const HOME = ['app/layout.tsx', 'app/dashboard/[eventId]/layout.tsx', 'app/dashboard/[eventId]/template.tsx', 'app/dashboard/[eventId]/page.tsx'];

test('every client piece the Event Settings action returns is in Home’s client manifest (its server graph)', () => {
  const answer = serverToClientBoundary([ACTION]);
  // The walk must see the pieces, or it proves nothing (a broken resolver returns an empty set and passes).
  assert.ok(
    answer.has('app/dashboard/[eventId]/launch/_components/details-lazy.tsx'),
    `the walk did not reach the Maker's editors from ${ACTION} — the walk is broken, not the route`,
  );
  const home = serverToClientBoundary(HOME);
  assert.ok(home.has('app/dashboard/[eventId]/_components/home-settings-gear.tsx'), 'the walk did not reach Home’s ⚙');
  const missing = [...answer].filter((m) => !home.has(m));
  assert.deepEqual(
    missing,
    [],
    `Home's ⚙ would crash Home: its action returns ${missing.join(', ')}, which Home's server files never import, ` +
      `so Next cannot send them ("Could not find the module … in the React Client Manifest"). Keep ` +
      `\`import './_components/open-event-settings'\` in app/dashboard/[eventId]/page.tsx (or import the piece from a ` +
      `Home server file).`,
  );
});


/**
 * 🔒 EVERY ROUTE THAT CAN CALL AN ACTION WHICH ANSWERS DRAWN CLIENT PIECES HAS THOSE PIECES IN ITS OWN GRAPH
 * (2026-10-29 — the `todo` this file carried after #7042, made real for every caller).
 *
 * The same shape one tap deeper: a walker in the Wedding March, a parent in the Parents row or on Studio › Prints opens
 * THE guest card through `openGuestCard`, called from the browser (`guest-card-sheet.tsx`), on the Maker, the Event Hub
 * editor, a Details field and Home's Event settings. Until today it ANSWERED THE CARD DRAWN, and none of those routes
 * import the card's client pieces from a server file (the Maker keeps them out of its first load on purpose), so the
 * production build listed them for those routes with no chunk to load, and the tap fell to "Something on our end didn't
 * work". It now answers the card's DATA and the browser draws the one card (`guests/_components/guest-card-in-place.tsx`).
 *
 * THE PROPERTY, for EVERY production route (every `page.tsx` outside `app/dev` — the labs `notFound()` in production):
 *   1. walk the route's server files to its server→client boundary (the walk above, on a cached parse);
 *   2. walk on through the CLIENT graph from there. A `'use server'` module met on the client side is only a door, so the
 *      walk stops there — unless it is an action that ANSWERS DRAWN PIECES (a `'use server'` `.tsx` whose code renders a
 *      component), whose answer mounts its own boundary in the browser, so the walk goes on from that;
 *   3. every such action the route can reach must have its whole boundary inside the route's own boundary.
 * Nothing is listed by hand but the discovery rules and the one edge below that is drawn but never live — so a new route
 * that mounts the march, or an action that starts answering drawn pieces again, fails here without editing this file.
 */
type Info = { client: boolean; server: boolean; deps: string[] };
const INFO = new Map<string, Info>();
function info(f: string): Info {
  let i = INFO.get(f);
  if (!i) {
    const src = readFileSync(f, 'utf8');
    const d = directive(src);
    i = { client: d === 'client', server: d === 'server', deps: importsOf(src).map((s) => resolveSpec(s, f)).filter((r): r is string => !!r) };
    INFO.set(f, i);
  }
  return i;
}

/** `serverToClientBoundary` on the cached parse — the same rule, fast enough for every route in the app. */
function boundaryOf(starts: string[]): Set<string> {
  const seen = new Set<string>();
  const boundary = new Set<string>();
  const queue = starts.map((f) => resolve(WEB, f));
  while (queue.length) {
    const f = queue.shift()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const i = info(f);
    if (i.client) boundary.add(relative(WEB, f));
    else queue.push(...i.deps);
  }
  return boundary;
}

function filesUnder(dir: string, keep: (name: string) => boolean, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules') filesUnder(p, keep, out);
    } else if (keep(e.name)) out.push(p);
  }
  return out;
}

/** A JSX element in code — not a generic (`Promise<Card>`, preceded by a name) and not a comment. */
const DRAWS = /(?<![\w$.])<[A-Z][\w.]*/;

/** Actions whose ANSWER is drawn: a `'use server'` `.tsx` whose code renders a component. */
const RENDERING_ACTIONS = ['app', 'lib', 'components']
  .filter((d) => existsSync(join(WEB, d)))
  .flatMap((d) => filesUnder(join(WEB, d), (n) => n.endsWith('.tsx') && !/\.test\.tsx$/.test(n)))
  .filter((f) => {
    const src = readFileSync(f, 'utf8');
    return directive(src) === 'server' && DRAWS.test(stripComments(src));
  })
  .map((f) => relative(WEB, f));
const ANSWER = new Map(RENDERING_ACTIONS.map((a) => [a, boundaryOf([a])]));

/**
 * Edges a static walk sees but the app never takes. ONE, and the next test holds it: Home's loading screen draws the cover
 * band for the couple's names only — never with `settingsFor` — so its ⚙ (and through it Event Settings and the march)
 * cannot mount from there. Followed, it would make every event route look like a caller, because the event LAYOUT reaches it.
 */
const INERT: { from: string; to: string }[] = [
  { from: 'app/dashboard/[eventId]/_components/home-loading-cover.tsx', to: 'app/dashboard/[eventId]/_components/home-cover-band.tsx' },
];

/** What a route's browser side can reach: the drawn-answer actions, and every client module (through those answers too). */
function browserReach(boundary: Set<string>): { actions: Set<string>; modules: Set<string> } {
  const modules = new Set<string>();
  const actions = new Set<string>();
  const queue = [...boundary].map((m) => resolve(WEB, m));
  while (queue.length) {
    const f = queue.shift()!;
    const rel = relative(WEB, f);
    if (modules.has(rel) || actions.has(rel)) continue;
    const i = info(f);
    if (i.server) {
      const answer = ANSWER.get(rel);
      if (answer) {
        actions.add(rel);
        queue.push(...[...answer].map((m) => resolve(WEB, m)));
      }
      continue; // any other action is only a door in the browser
    }
    modules.add(rel);
    for (const d of i.deps) if (!INERT.some((e) => e.from === rel && e.to === relative(WEB, d))) queue.push(d);
  }
  return { actions, modules };
}

/** Every production route: its page plus the root-to-leaf layouts, templates, loading and not-found files of its entry. */
const ROUTES = filesUnder(join(WEB, 'app'), (n) => /^page\.(tsx|ts|jsx|js)$/.test(n))
  .filter((p) => !relative(WEB, p).startsWith('app/dev/'))
  .map((p) => {
    const files: string[] = [];
    for (let d = dirname(p); d.startsWith(join(WEB, 'app')); d = dirname(d))
      for (const n of ['layout', 'template', 'loading', 'not-found'])
        for (const x of ['.tsx', '.ts']) if (existsSync(join(d, n + x))) files.unshift(relative(WEB, join(d, n + x)));
    return { page: relative(WEB, p), files: [...files, relative(WEB, p)] };
  });

const SHEET = 'app/dashboard/[eventId]/guests/_components/guest-card-sheet.tsx';
/** The routes a guest's card opens in place on — measured 2026-10-29 with this walk; a floor, not the list under test. */
const OPENS_THE_GUEST_CARD = [
  'app/dashboard/[eventId]/page.tsx', // Home › ⚙ Event settings › the march / the parents
  'app/dashboard/[eventId]/launch/page.tsx', // the Maker
  'app/dashboard/[eventId]/website/editor/page.tsx', // the Event Hub editor
  'app/dashboard/[eventId]/details/field/[row]/page.tsx', // a Details field (and its intercepted sheet)
  'app/dashboard/[eventId]/details/@field/(.)field/[row]/page.tsx',
];

test('every route that can call an action answering drawn pieces has those pieces in its own graph (the guest card, Event Settings)', () => {
  assert.ok(RENDERING_ACTIONS.includes(ACTION), `the walk no longer sees ${ACTION} as an action that answers drawn pieces — the discovery is blind`);
  assert.ok(ROUTES.length > 300, `only ${ROUTES.length} routes — the route discovery is blind`);

  const broken: string[] = [];
  const sheetOn: string[] = [];
  const settingsOn: string[] = [];
  for (const r of ROUTES) {
    const boundary = boundaryOf(r.files);
    const reach = browserReach(boundary);
    if (reach.modules.has(SHEET)) sheetOn.push(r.page);
    if (reach.actions.has(ACTION)) settingsOn.push(r.page);
    for (const a of reach.actions) {
      const missing = [...ANSWER.get(a)!].filter((m) => !boundary.has(m));
      if (missing.length) broken.push(`${r.page} → ${a} answers ${missing.join(', ')}`);
    }
  }
  // The walk must still see where a guest's card opens, or a drawn guest card answer could come back unseen.
  for (const page of OPENS_THE_GUEST_CARD) assert.ok(sheetOn.includes(page), `the walk no longer sees ${page} opening a guest's card — the walk is broken, not the route`);
  assert.ok(sheetOn.length < 30, `the walk says ${sheetOn.length} routes open a guest's card — an inert edge is being followed`);
  assert.ok(settingsOn.includes(HOME[HOME.length - 1]!), 'the walk no longer sees Home calling Event Settings');

  assert.deepEqual(
    broken,
    [],
    `A tap on these routes would fall to "Something on our end didn't work": the action answers client pieces the route's ` +
      `server files never import, so the production build cannot send them there. Answer DATA and draw it in the browser ` +
      `(as \`guests/_components/guest-card-in-place.tsx\` does for the guest card), or import the action from the route's ` +
      `page.tsx (as Home does for Event Settings) if its pieces are small enough for that route's first load.`,
  );
});

test('the one inert edge stays inert: Home’s loading screen never draws the ⚙', () => {
  for (const e of INERT) {
    const src = readFileSync(join(WEB, e.from), 'utf8');
    assert.ok(info(join(WEB, e.from)).deps.includes(join(WEB, e.to)), `${e.from} no longer imports ${e.to} — drop it from INERT`);
    const tags = stripComments(src).match(/<HomeCoverBand\b[^>]*>/g) ?? [];
    assert.ok(tags.length > 0, `${e.from} no longer draws the cover band — drop it from INERT`);
    for (const t of tags) assert.ok(!/settingsFor/.test(t), `${e.from} now hands the band settingsFor — its ⚙ mounts there, so the edge is live: remove it from INERT`);
  }
});
