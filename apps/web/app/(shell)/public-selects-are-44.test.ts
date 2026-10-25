/**
 * Every native <select> on a public (shelled) page is at least 44px tall in
 * EVERY engine — Safari included.
 *
 * Quality sweep 2026-10-13, item 5: the /explore landing's two filter selects
 * measured 26px tall in WebKit on 60 pages (41 in Chromium). WebKit draws a
 * default-appearance <select> at its own size and ignores vertical padding, so
 * `py-2` made it tall only in Chrome. A select passes when its class carries a
 * real height: `input-field` (h-11 = 44px) / `h-11` / `min-h-[44px]`; and a
 * select sized by min-height must also be `appearance-none` (the only way
 * WebKit lets CSS size the box).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const SHELL = dirname(fileURLToPath(import.meta.url));

function tsx(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const a = join(dir, f);
    if (statSync(a).isDirectory()) tsx(a, out);
    else if (f.endsWith('.tsx')) out.push(a);
  }
  return out;
}

test('every public <select> is 44px tall in Safari as well as Chrome', () => {
  const bad: string[] = [];
  let seen = 0;
  for (const abs of tsx(SHELL)) {
    const src = stripComments(readFileSync(abs, 'utf8'));
    for (const m of src.matchAll(/<select\b([\s\S]*?)>/g)) {
      seen++;
      const attrs = m[1]!;
      let cls = attrs.match(/className="([^"]*)"/)?.[1];
      const ident = attrs.match(/className=\{([A-Z_][A-Z0-9_]*)\}/)?.[1];
      if (cls === undefined && ident) {
        cls = src.match(new RegExp(`const ${ident}\\s*=\\s*\\n?\\s*'([^']*)'`))?.[1];
      }
      const where = `${relative(SHELL, abs)} <select${attrs.slice(0, 60).replace(/\s+/g, ' ')}…>`;
      if (cls === undefined) { bad.push(`${where} — class not readable; use a literal or a CONST`); continue; }
      const tall = /\binput-field\b|\bh-11\b|\bmin-h-\[44px\]|\bmin-h-11\b/.test(cls);
      if (!tall) bad.push(`${where} — no 44px height`);
      else if (/min-h-/.test(cls) && !/\binput-field\b|\bh-11\b/.test(cls) && !/\bappearance-none\b/.test(cls)) {
        bad.push(`${where} — min-height without appearance-none: WebKit ignores it`);
      }
    }
  }
  assert.ok(seen >= 3, `saw ${seen} selects — did the shell pages move?`);
  assert.deepEqual(bad, [], 'A public <select> is under 44px in Safari:\n  ' + bad.join('\n  '));
});
