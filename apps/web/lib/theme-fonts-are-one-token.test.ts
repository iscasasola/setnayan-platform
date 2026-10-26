/**
 * theme-fonts-are-one-token.test.ts — the app's face is ONE line in app/theme.css (brand refresh
 * step 2, owner 2026-10-26: "if we choose a different … font, it will be easy to make the whole app
 * look differently"), and today that line still says Hanken Grotesk / Space Mono, loaded as before.
 *
 *   1. theme.css declares exactly two font roles — `--font-ui` and `--font-ui-mono` — at today's faces;
 *   2. every family name app screens still read (`--font-sans` · `--font-display` · `--font-app` ·
 *      `--font-condensed` · the marketing trio · `--font-mono`) is aliased at a role, under `html:root`
 *      (out-specifies globals.css's `:root`), and each alias resolves to the SAME face globals.css gave it;
 *   3. `.app-surface` reads the mono role instead of hard-coding Space Mono (so the flip reaches the
 *      dashboards), while the guest tree's `.sn-editorial` keeps its own editorial faces;
 *   4. Tailwind exposes `font-ui`, and `font-mono` still reads `--font-mono`;
 *   5. no face moved in app/layout.tsx — the loader is untouched by this step (plan step 15 adds Inter Tight).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripCssComments } from '../scripts/strip-css-comments.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = (p: string) => readFileSync(join(WEB, p), 'utf8');

function declsOf(css: string, sel: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if ((m[1] ?? '').split(';').pop()!.trim().replace(/\s+/g, ' ') !== sel) continue;
    for (const d of (m[2] ?? '').matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) out.set(d[1]!, d[2]!.trim());
  }
  return out;
}

const THEME = stripCssComments(raw('app/theme.css'));
const GLOBALS = stripCssComments(raw('app/globals.css')).replace(/@layer\s+(base|components)\s*\{/g, '');
const ROLES = new Map([...declsOf(THEME, ':root')].filter(([k]) => k.startsWith('font-')));
const ALIASES = new Map([...declsOf(THEME, 'html:root')].filter(([k]) => k.startsWith('font-')));
const G_ROOT = declsOf(GLOBALS, ':root');

test('two font roles, at today\'s faces', () => {
  assert.deepEqual(Object.fromEntries(ROLES), { 'font-ui': 'var(--font-hanken)', 'font-ui-mono': 'var(--font-space-mono)' });
});

test('every family name app screens read follows a role, and resolves to the face it had', () => {
  const expected = ['font-sans', 'font-display', 'font-app', 'font-condensed', 'font-sans-marketing', 'font-serif-marketing', 'font-mono', 'font-mono-marketing'];
  assert.deepEqual([...ALIASES.keys()].sort(), [...expected].sort());
  for (const name of expected) {
    const role = ALIASES.get(name)!.match(/^var\(--(font-ui(?:-mono)?)\)$/)?.[1];
    assert.ok(role, `--${name} must alias a font role (got ${ALIASES.get(name)})`);
    assert.equal(ROLES.get(role), G_ROOT.get(name), `--${name}: globals.css gave ${G_ROOT.get(name)}, the role gives ${ROLES.get(role)}`);
  }
});

test('.app-surface reads the mono role; the guest tree keeps its editorial faces', () => {
  const surface = declsOf(GLOBALS, '.app-surface');
  assert.equal(surface.get('font-mono'), 'var(--font-ui-mono)');
  const editorial = declsOf(GLOBALS, '.sn-editorial');
  assert.equal(editorial.get('font-display'), 'var(--font-editorial-display)', 'the guest Hub keeps Cormorant');
  assert.equal(editorial.get('font-mono'), 'var(--font-editorial-mono)', 'the guest Hub keeps DM Mono');
});

test('Tailwind exposes the roles', () => {
  const tw = raw('tailwind.config.ts');
  assert.match(tw, /\bui: \['var\(--font-ui\)'/);
  assert.match(tw, /\bmono: \['var\(--font-mono\)'/);
});

test('the loader is untouched: Hanken + Space Mono load as before, no new face', () => {
  const layout = raw('app/layout.tsx');
  assert.match(layout, /variable: '--font-hanken'/);
  assert.match(layout, /variable: '--font-space-mono'/);
  assert.doesNotMatch(layout, /inter-tight|--font-inter-tight/i, 'Inter Tight arrives in plan step 15, not here');
});
