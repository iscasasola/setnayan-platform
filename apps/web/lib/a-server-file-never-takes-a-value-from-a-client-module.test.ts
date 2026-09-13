/**
 * A SERVER FILE NEVER TAKES A PLAIN VALUE FROM A 'use client' MODULE.
 *
 * Found by the Story's step-8 drive against the live site (2026-09-11): a published story threw
 * React hydration error #418 on ~1 load in 6, and React threw the server's page away to redraw it.
 * Patching production's react-dom in the test browser caught it: `app/layout.tsx` put
 * `<script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />` first in <head>, and
 * `themeBootstrapScript` — a plain string — was exported from `theme-provider.tsx`, a 'use client'
 * module. A server component that imports a value from a client module gets a CLIENT REFERENCE,
 * not the value: the payload carried `"__html":"$12"` and row 12 was an import of that file. When
 * its JavaScript had not arrived by hydration time, the head's first child was a "blocked" lazy
 * element; React paused, REPLAYED the head, and its head bookkeeping ran twice — the saved body
 * position was overwritten with the head's own first tag, and the body was then read against
 * <meta charset>. A React bug (entering a scoped singleton is not replay-safe), but one only a
 * pause inside <head> can trigger — and the pause was ours.
 *
 * ── WHAT THIS GUARD CLAIMS, EXACTLY ────────────────────────────────────────────────────────────
 * No file without 'use client' in app/, lib/ or components/ imports, from a 'use client' module,
 * a name that module declares as a plain VALUE (`export const X = <string | template | number |
 * boolean | object | array literal>`, or `export let/var`). Components and hooks are functions and
 * are fine to import — that is what client references are for. Source read through the repo's one
 * comment stripper; a detector self-test; a population floor proves the resolver still resolves.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');

/*
  Known and reasoned. Each is imported by a server file only on paths that never evaluate the
  value on the server, and each would need its own look — listed so they stay visible, not fixed
  here (step 8 found the pattern; these two are 3D-kit internals, not a page).
*/
const EXEMPT: Record<string, string> = {
  'app/_components/plan3d/kit/booth-templates.ts ← CHASSIS_SPECS':
    '3D kit data read inside functions the client bundle calls; app/v/[slug]/booth/page.tsx imports the module but not this value — TO REVIEW',
  'app/_components/plan3d/kit/outfits.ts ← fabricBumpMap':
    '3D kit texture helper, only called while a client canvas renders — TO REVIEW',
};

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e) && !/\.test\.(tsx?|jsx?)$/.test(e)) out.push(p);
  }
  return out;
}

export const isClientModule = (src: string): boolean =>
  /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(src);

/** Is `name` declared in this module as a plain value rather than a component/function? */
export function declaresValue(src: string, name: string): boolean {
  const s = stripComments(src);
  if (new RegExp(`export\\s+(?:let|var)\\s+${name}\\b`).test(s)) return true;
  const m = new RegExp(`export\\s+const\\s+${name}\\s*(?::[^=]+)?=\\s*([\\s\\S]{0,12})`).exec(s);
  if (!m) return false;
  return /^\s*(?:[`'"\d{[]|-\d|true\b|false\b|\/[^/*])/.test(m[1]!);
}

function resolveSpec(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) if (existsSync(c)) return c;
  return null;
}

test('the detector can fire — a string, an object, a template; never a component', () => {
  assert.equal(declaresValue(`'use client';\nexport const themeBootstrapScript = \`(function(){})()\`;`, 'themeBootstrapScript'), true);
  assert.equal(declaresValue(`export const ANCHOR = 'your-desk';`, 'ANCHOR'), true);
  assert.equal(declaresValue(`export const SPECS: Record<string, number> = { a: 1 };`, 'SPECS'), true);
  assert.equal(declaresValue(`export const Card = ({ a }: P) => <div />;`, 'Card'), false);
  assert.equal(declaresValue(`export function Card() { return null; }`, 'Card'), false);
  assert.equal(isClientModule(`/* x */\n'use client';\nexport const a = 1;`), true);
  assert.equal(isClientModule(`import x from 'y';\nconst s = 'use client';`), false);
});

test('no server file imports a plain value from a use-client module', () => {
  const files = ['app', 'lib', 'components'].flatMap((d) => walk(join(WEB, d)));
  const offenders: string[] = [];
  let resolvedClientImports = 0;
  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    if (isClientModule(raw)) continue;
    const src = stripComments(raw);
    for (const m of src.matchAll(/import\s+(type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)) {
      if (m[1]) continue;
      const target = resolveSpec(file, m[3]!);
      if (!target) continue;
      const tsrc = readFileSync(target, 'utf8');
      if (!isClientModule(tsrc)) continue;
      resolvedClientImports += 1;
      const names = m[2]!
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n && !n.startsWith('type '))
        .map((n) => n.split(/\s+as\s+/)[0]!.trim());
      for (const name of names) {
        if (!declaresValue(tsrc, name)) continue;
        const key = `${relative(WEB, file)} ← ${name}`;
        if (EXEMPT[key]) continue;
        offenders.push(`${key}  (declared as a value in ${relative(WEB, target)}, a 'use client' module)`);
      }
    }
  }
  console.log(`# [client-values] server imports from client modules resolved: ${resolvedClientImports} · plain values among them: ${offenders.length} · reasoned exemptions: ${Object.keys(EXEMPT).length}`);
  // A zero population is a broken guard, not a clean repo.
  assert.ok(resolvedClientImports >= 100, `resolved only ${resolvedClientImports} server→client imports — the scan has stopped seeing them`);
  assert.deepEqual(offenders, [], `\n${offenders.join('\n')}\n— move the value into a module without 'use client' and import it from there`);
});
