/**
 * A `'use server'` file may export ONLY async functions.
 *
 * 🔑 Why this test exists. A plain `export const ONBOARDING_MUSIC_MAX_TRACKS = 8`
 * was added to `app/admin/onboarding/actions.ts`, which carries `'use server'`.
 * Next refuses that at BUILD time:
 *     Only async functions are allowed to be exported in a "use server" file.
 *
 * It shipped green. `tsc --noEmit` was clean, every unit suite passed, and the
 * DB suites passed — none of them compile the app. Only `next build` sees it,
 * and `next build` cannot run on a dev machine here (~7 GB heap), so CI was the
 * sole detector and the PR sat red.
 *
 * This is the server-side twin of the standing rule about never exporting plain
 * data from a `'use client'` module. Cheap to check, so it is checked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'app';

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Files whose FIRST statement is the 'use server' directive. */
function useServerFiles(): string[] {
  return walk(ROOT).filter((f) => {
    const head = fs.readFileSync(f, 'utf8').slice(0, 400);
    return /^\s*(\/\*[\s\S]*?\*\/\s*)?['"]use server['"]\s*;/.test(head);
  });
}

/** Exports that are NOT async functions — the thing Next rejects. */
function offendingExports(src: string): string[] {
  const bad: string[] = [];
  // export const X = ... / export let / export var  — unless it is an async arrow
  for (const m of src.matchAll(/^export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::[^=]+)?=\s*(.*)$/gm)) {
    const name = m[1] ?? '';
    const rhs = (m[2] ?? '').trim();
    if (!/^async\b/.test(rhs)) bad.push(`const ${name}`);
  }
  // export function foo  — must be async
  for (const m of src.matchAll(/^export\s+(?!async\b)function\s+([A-Za-z0-9_$]+)/gm)) {
    bad.push(`function ${m[1] ?? ''}`);
  }
  // export type/interface are erased at compile time and are fine.
  return bad;
}

test('META: the scan actually finds the use-server files (guards against a vacuous pass)', () => {
  const files = useServerFiles();
  assert.ok(files.length > 5, `expected several 'use server' files, found ${files.length}`);
});

test("no 'use server' file exports anything but async functions", () => {
  const offenders: string[] = [];
  for (const f of useServerFiles()) {
    const bad = offendingExports(fs.readFileSync(f, 'utf8'));
    if (bad.length) offenders.push(`${f} → ${bad.join(', ')}`);
  }
  assert.deepEqual(
    offenders,
    [],
    'A "use server" file may export ONLY async functions. Next fails the production ' +
      'build on anything else, and neither tsc nor the unit suites can see it. Move ' +
      'the value into a plain module and import it back.\n' +
      offenders.join('\n'),
  );
});

test('the onboarding music cap lives in a plain module, not the server-action file', () => {
  const actions = fs.readFileSync('app/admin/onboarding/actions.ts', 'utf8');
  assert.doesNotMatch(
    actions,
    /export const ONBOARDING_MUSIC_MAX_TRACKS/,
    'this exact export broke the production build once',
  );
  assert.match(actions, /from '@\/lib\/onboarding-music-limits'/);
  assert.match(
    fs.readFileSync('lib/onboarding-music-limits.ts', 'utf8'),
    /export const ONBOARDING_MUSIC_MAX_TRACKS = 8;/,
  );
});
