/**
 * tours-stay-on-the-server.test.ts — ⚡ THE DIET (2026-10-01).
 *
 * `lib/tours.ts` holds the words of every tour: ~10.5KB gz once minified. Two
 * client files imported it — the generic carousel (`guided-tour.tsx`, then
 * `'use client'`) and the Maker's `maker-bar.ts` (pulled in by the client shell)
 * — so every dashboard page, the Maker's first load included
 * (`scripts/check-maker-js-budget.mjs`), downloaded all of it to show at most
 * one tour. The server now picks the tour and draws its icons
 * (`app/_components/tour-slide-view.tsx`); the carousels receive just those
 * slides.
 *
 * This fails if a client file, or a module the Maker's client shell imports,
 * takes a VALUE from `lib/tours` again. `import type` is free and allowed.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

const WEB = process.cwd();
const ROOTS = ['app', 'components', 'lib'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** A value import of lib/tours: `import { TOURS } from '@/lib/tours'`, not `import type …`. */
const VALUE_IMPORT = /^\s*import\s+(?!type\b)[^;]*?from\s+['"](?:@\/lib\/tours|(?:\.\.?\/)+(?:lib\/)?tours)['"]/m;

function isClient(src: string): boolean {
  return /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(src);
}

test('no client file imports a value from lib/tours', () => {
  const files = ROOTS.flatMap((r) => walk(join(WEB, r)));
  assert.ok(files.length > 500, `scanned only ${files.length} files — the guard is looking at nothing`);
  const clients = files.filter((f) => isClient(readFileSync(f, 'utf8')));
  assert.ok(clients.length > 100, `found only ${clients.length} client files — the 'use client' detector is blind`);
  const bad = clients.filter((f) => VALUE_IMPORT.test(readFileSync(f, 'utf8'))).map((f) => relative(WEB, f));
  assert.deepEqual(bad, [], 'a client file imports lib/tours — every tour’s words ship to the browser again');
});

test('the Maker bar (imported by the client shell) takes only the tour TYPE', () => {
  const bar = readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/maker-bar.ts'), 'utf8');
  assert.match(bar, /import type \{ TourKey \} from '@\/lib\/tours'/, 'the type import was not found — the scan is blind');
  assert.doesNotMatch(bar, VALUE_IMPORT, 'maker-bar.ts imports lib/tours by value — the Maker’s first load carries every tour');
});

test('GuidedTour stays a server component that hands the carousel one tour', () => {
  const wrapper = readFileSync(join(WEB, 'app/_components/guided-tour.tsx'), 'utf8');
  assert.ok(!isClient(wrapper), 'guided-tour.tsx is a client file again — TOURS rides into every role layout');
  assert.match(wrapper, /<GuidedTourCard\b/, 'the wrapper no longer renders the carousel');
  const card = readFileSync(join(WEB, 'app/_components/guided-tour-card.tsx'), 'utf8');
  assert.ok(isClient(card), 'the carousel is the client half');
  // A client file that imports the WRAPPER drags it — and TOURS — into the
  // browser bundle (the guest page's `guest-guided-tour.tsx` did exactly that).
  const wrapperImport = /from\s+['"](?:@\/app\/_components\/|\.\/)guided-tour['"]/;
  const files = ROOTS.flatMap((r) => walk(join(WEB, r)));
  const bad = files
    .filter((f) => { const src = readFileSync(f, 'utf8'); return isClient(src) && wrapperImport.test(src); })
    .map((f) => relative(WEB, f));
  assert.deepEqual(bad, [], 'a client file imports the server GuidedTour wrapper — use GuidedTourCard with a server-built tour');
});
