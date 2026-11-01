/**
 * a-server-file-hands-action-button-an-element.test.ts — no SERVER file anywhere passes
 * `<ActionButton icon={X}>` a component (2026-11-01, live outage).
 *
 * `ActionButton` is `'use client'`. `icon={Plus}` from a server file hands the client a
 * function, which React Server Components refuse ("Functions cannot be passed directly to
 * Client Components"). On live this took down the whole supplier Shop page — "Your shop
 * console is temporarily unavailable." — with digest 2080562659. Render tests stayed green
 * because `renderToStaticMarkup` has no client boundary. The Home already had this guard
 * (`home-hands-the-client-no-functions.test.ts`) for three files; this one covers every
 * server file that renders an ActionButton.
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

test('action-button.tsx is still a client file, so the rule still applies', () => {
  const src = readFileSync(join(WEB, 'components', 'action-button.tsx'), 'utf8');
  assert.match(src.slice(0, 40), /^'use client'/);
});

test('no server file hands <ActionButton> an icon COMPONENT, only an element', () => {
  const bad: string[] = [];
  for (const root of ['app', 'components']) {
    for (const f of tsxFiles(join(WEB, root))) {
      const raw = readFileSync(f, 'utf8');
      if (/^\s*['"]use client['"]/.test(raw)) continue;
      const src = stripComments(raw);
      // Every `icon={…}` inside an <ActionButton …> tag. The value is fine when it builds an element
      // (contains `<`) or calls a helper that returns one (`icon(name)`); a bare name, or a choice
      // between bare names (`a ? Armchair : Footprints`), is a component crossing the boundary.
      for (const tag of src.matchAll(/<ActionButton\b[\s\S]*?\/>/g)) {
        const m = /\bicon=\{([^{}]*)\}/.exec(tag[0]);
        if (!m) continue;
        const v = m[1] ?? '';
        if (v.includes('<') || /\w\s*\(/.test(v)) continue;
        bad.push(`${relative(WEB, f)}: icon={${v.trim()}}`);
      }
    }
  }
  assert.deepEqual(bad, [], 'pass icon={<X />}, never icon={X}: a function cannot cross into a client component');
});
