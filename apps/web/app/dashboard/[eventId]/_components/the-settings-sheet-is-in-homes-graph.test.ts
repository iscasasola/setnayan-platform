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
import { existsSync, readFileSync, statSync } from 'node:fs';
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
 * ⚠ KNOWN, NOT FIXED HERE — the SAME shape one tap deeper. A parent in the sheet's Parents row (and a walker or parent
 * in the Maker) opens THE guest card through `openGuestCard`, which also RETURNS rendered client pieces (the guest
 * card's invite cell, ticket, Papic camera, access pick…). Neither Home nor the Maker's routes import them from a
 * server file, so by the rule above that answer cannot be sent either. Importing them into those routes would put the
 * whole guest card into their first load, so it is a design call, not a one-line fix — left as a TODO that prints
 * what is missing until it is settled.
 */
test('the guest card a parent opens is in the calling route’s graph (Home, the Maker)', { todo: 'openGuestCard returns client pieces Home and the Maker do not import (see above)' }, () => {
  const card = serverToClientBoundary(['app/dashboard/[eventId]/guests/open-guest-card.tsx']);
  for (const route of [HOME, ['app/layout.tsx', 'app/dashboard/[eventId]/layout.tsx', 'app/dashboard/[eventId]/launch/page.tsx']]) {
    const reached = serverToClientBoundary(route);
    assert.deepEqual([...card].filter((m) => !reached.has(m)), [], `missing from ${route[route.length - 1]}`);
  }
});
