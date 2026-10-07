/**
 * home-hands-the-client-no-functions.test.ts — the Home's server files never pass a
 * FUNCTION to a client component (2026-10-07, combined preview).
 *
 * `home-first-screen.tsx` is a server component; `ActionButton` is `'use client'`.
 * `icon={Info}` hands the client a component — a function — which React Server
 * Components refuse ("Functions cannot be passed directly to Client Components"). The
 * render threw, the Home fell back to its last-seen snapshot, and every render test
 * stayed green, because `renderToStaticMarkup` has no client boundary to cross.
 *
 * Held two ways: (1) no `icon={…}` in the Home's server files is anything but an
 * element (`icon={<X … />}`); (2) the files really are server files (no `'use client'`),
 * so the rule applies to them — and the client parts really are client files.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = (rel: string) => readFileSync(join(HERE, ...rel.split('/')), 'utf8');
const SERVER = ['_components/home-first-screen.tsx', '_components/event-dashboard.tsx', 'page.tsx'];

test('the Home\'s server files are server files, and its parts are client files', () => {
  for (const f of SERVER) assert.doesNotMatch(raw(f).slice(0, 200), /^['"]use client['"]/m, `${f} is a client file now — re-check this guard`);
  assert.match(raw('_components/home-parts.tsx').slice(0, 40), /^'use client'/, 'home-parts.tsx must stay the client side');
});

test('no Home server file hands a client component an icon COMPONENT — only an element', () => {
  for (const f of SERVER) {
    const src = stripComments(raw(f));
    const bad = [...src.matchAll(/\bicon=\{(?!\s*<)([^}]*)\}/g)].map((m) => m[0]);
    assert.deepEqual(bad, [], `${f}: pass icon={<X />}, never icon={X} — a function cannot cross into a client component`);
  }
});
