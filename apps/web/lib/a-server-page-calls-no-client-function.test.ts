/**
 * a-server-page-calls-no-client-function.test.ts — THE BOUNDARY IS NOT A FOLDER.
 *
 * 🔴 MEASURED ON PRODUCTION, 2026-09-23, digest 2184633741. The whole website
 * editor returned 500 to the couple:
 *
 *     Attempted to call done() from the server but done is on the client.
 *
 * `done()` and `todo()` were two-line pure helpers exported from
 * `editor-shell.tsx` — which carries `'use client'` — and the server page
 * called them seventeen times. In development that works. In a production build
 * a client export is a REFERENCE, not a function, and React refuses.
 *
 * 🔑 A `'use client'` FILE IS A BOUNDARY. A component may be RENDERED across
 * it; a plain function may not be CALLED across it. Types are fine — erased.
 *
 * ⛔ AND IT FAILS ONLY IN PRODUCTION, which is why a guard earns its keep here:
 * `next dev`, `tsc` and the unit suite all pass. The first thing anybody sees
 * is a customer on a 500.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { stripComments } from './strip-comments';

const APP = join(__dirname, '..', 'app');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = walk(APP);
const isClientModule = (p: string) => {
  try {
    return /^\s*['"]use client['"]/.test(readFileSync(p, 'utf8'));
  } catch {
    return false;
  }
};

/** Resolve a relative import to the file it names, trying the usual endings. */
function resolveLocal(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec);
  for (const c of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    try {
      if (statSync(c).isFile()) return c;
    } catch {
      /* next candidate */
    }
  }
  return null;
}

test('🔴 no SERVER file imports a callable value from a `use client` module', () => {
  const offenders: string[] = [];
  let checked = 0;

  for (const file of FILES) {
    if (isClientModule(file)) continue; // client → client is fine
    /*
      🪤 ROUTE ENTRIES ONLY, and the first version was not. It swept every file
      without `'use client'` — but a plain module imported only BY client
      components joins the client graph and may use hooks quite legally
      (`brand-marks.tsx` calling `useBrandMark`), and a `.test.ts` runs in node
      where the boundary does not exist at all. Both were reported as offences.

      `page.tsx`, `layout.tsx` and `route.ts` are the files that are
      unambiguously server unless they say otherwise, and they are where a
      client call actually 500s a customer. Narrower, and it still catches both
      real instances on the editor page.
    */
    if (!/[/\\](page|layout)\.tsx?$|[/\\]route\.ts$/.test(file)) continue;
    const src = stripComments(readFileSync(file, 'utf8'));

    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(\.[^']+)'/g)) {
      const target = resolveLocal(file, m[2] as string);
      if (!target || !isClientModule(target)) continue;
      checked += 1;

      for (const raw of (m[1] as string).split(',')) {
        const name = raw.trim();
        if (!name) continue;
        // `type X` and `type { X }` are erased — never a runtime call.
        if (/^type\s/.test(name)) continue;
        const local = (name.split(/\s+as\s+/).pop() ?? name).trim();
        // A Component is RENDERED across the boundary, which is allowed. The
        // convention this repo already follows is PascalCase for those.
        if (/^[A-Z]/.test(local)) continue;
        offenders.push(
          `${file.slice(APP.length + 1)} imports '${local}' from '${m[2]}' ('use client')`,
        );
      }
    }
  }

  assert.ok(checked > 0, 'anti-vacuity: server files do import from client modules (components)');
  assert.deepEqual(
    offenders,
    [],
    'a server file imports a non-component value from a client module. In a production ' +
      'build that is a client REFERENCE, not a function, and calling it 500s the route — ' +
      'measured on the website editor, digest 2184633741. Move the value to a module ' +
      `without 'use client':\n${offenders.join('\n')}`,
  );
});

test('⭐ the two helpers that caused it now live outside the boundary', () => {
  const rail = join(
    APP,
    'dashboard',
    '[eventId]',
    'website',
    'editor',
    '_components',
    'rail-rows.ts',
  );
  const src = readFileSync(rail, 'utf8');
  assert.doesNotMatch(stripComments(src), /['"]use client['"]/, 'rail-rows.ts must stay server-safe');
  assert.match(src, /export function done\(/);
  assert.match(src, /export function todo\(/);

  // 🔑 And the old path must NOT re-export them — that would make the broken
  // import work again and put the trap straight back.
  const shell = stripComments(
    readFileSync(join(dirname(rail), 'editor-shell.tsx'), 'utf8'),
  );
  assert.doesNotMatch(shell, /export\s*\{[^}]*\bdone\b[^}]*\}\s*from/, 'no re-export of done');
  assert.doesNotMatch(shell, /export function done\(/, 'and no second definition');
});
