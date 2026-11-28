/**
 * 👗 A7: the hand tools and the lace designer stay out of the maker's first load. Nothing imports them statically; a
 * screen that shows them loads them with a dynamic import (next/dynamic or import()). Plan A7: "chunk not in the
 * designer's first load (source guard)".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB = join(__dirname, '../../..');
const LAZY = ['gown-maker/hand-tools', 'gown-maker/lace-designer'];

function files(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next' || n.startsWith('.')) continue;
    const p = join(dir, n), s = statSync(p);
    if (s.isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('nothing imports the hand tools or the lace designer statically', () => {
  const offenders: string[] = [];
  let dynamicUses = 0;
  for (const f of [...files(join(WEB, 'app')), ...files(join(WEB, 'components')), ...files(join(WEB, 'lib'))]) {
    const src = strip(readFileSync(f, 'utf8'));
    for (const m of LAZY) {
      const re = new RegExp(`(?:^|\\n)\\s*import\\s[^;]*?from\\s+['"][^'"]*${m}['"]`, 'g');
      if (re.test(src) && !/^\s*import\s+type\s/m.test(src.match(re)?.[0]?.trim() ?? '')) offenders.push(`${relative(WEB, f)} → ${m}`);
      if (new RegExp(`import\\(\\s*['"][^'"]*${m}['"]\\s*\\)`).test(src)) dynamicUses++;
    }
  }
  assert.deepEqual(offenders, []);
  // Floored: the guard has something to watch (the lab loads both).
  assert.ok(dynamicUses >= 2, `${dynamicUses} dynamic imports`);
});
