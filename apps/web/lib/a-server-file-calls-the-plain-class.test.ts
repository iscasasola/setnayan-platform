/**
 * GUARD — a server file calls the shared button's class builder from the PLAIN module, never from the client file.
 *
 * `components/action-button.tsx` is `'use client'`. Next lets a server component RENDER a client component, but it
 * refuses to CALL a function exported from a client file: the page dies with "Attempted to call actionButtonClass()
 * from the server but actionButtonClass is on the client" and the visitor gets the error screen. Nothing else catches
 * it — the types are fine, the unit suite has no server render, and the build succeeds. Found 2026-11-14 when the
 * template wave's public pages (pay, join, claim, the doorways) rendered the error page in the browser while every
 * test was green.
 *
 * So the builder lives in `components/action-button-class.ts` (no directive), the client file re-exports it, and a
 * file without `'use client'` that calls it must import it from the plain module.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

function* tsxFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* tsxFiles(p);
    else if (p.endsWith('.tsx')) yield p;
  }
}

test('the class builder lives in a plain module, and the client file only re-exports it', () => {
  const plain = readFileSync(join(WEB, 'components', 'action-button-class.ts'), 'utf8');
  assert.doesNotMatch(stripComments(plain).trimStart().slice(0, 40), /^['"]use client['"]/, 'the plain module must not become a client file');
  assert.match(stripComments(plain), /export function actionButtonClass\(/);
  const client = stripComments(readFileSync(join(WEB, 'components', 'action-button.tsx'), 'utf8'));
  assert.match(client, /from '\.\/action-button-class'/);
  assert.doesNotMatch(client, /export function actionButtonClass\(/, 'a second copy of the builder in the client file');
});

test('no server file imports actionButtonClass from the client file', () => {
  const bad: string[] = [];
  let checked = 0;
  for (const root of ['app', 'components']) {
    for (const f of tsxFiles(join(WEB, root))) {
      const raw = readFileSync(f, 'utf8');
      if (/^\s*['"]use client['"]/.test(raw)) continue;
      const src = stripComments(raw);
      if (!/actionButtonClass\(/.test(src)) continue;
      checked++;
      const fromClient = /import\s*\{[^}]*\bactionButtonClass\b[^}]*\}\s*from\s*'@\/components\/action-button'/.test(src);
      if (fromClient) bad.push(relative(WEB, f));
    }
  }
  assert.ok(checked > 0, 'premise: no server file calls actionButtonClass — re-anchor this guard');
  assert.deepEqual(bad, [], "import { actionButtonClass } from '@/components/action-button-class' in a server file");
});
