/**
 * theme-roles-are-todays-colours.test.ts — app/theme.css changes NO pixel today, and is the one
 * file a restyle edits (brand refresh step 1, owner 2026-10-26: "if we choose a different color …
 * it will be easy to make the whole app to look differently").
 *
 * Read from the real files, never a hand-typed list of values:
 *   1. every role has a Light and a Dark value, as an `R G B` triple;
 *   2. every role equals, in BOTH themes, the globals.css token it was measured from — so the
 *      roles are today's colours, byte for byte (the screenshots before/after are identical);
 *   3. the legacy colour words (`--color-cream`, `--color-mulberry`, `--ink-soft` …) are aliased
 *      AT the roles under a selector that out-specifies globals.css in both themes — so editing a
 *      role moves every `bg-cream` / `bg-mulberry` / `text-ink/55` too;
 *   4. every role is a Tailwind colour, and every Tailwind `--role-*` read exists in theme.css;
 *   5. root layout loads theme.css right after globals.css.
 *
 * ⚠ When the flip lands (plan step 16) the role values change on purpose and section 2 is
 * regenerated against the new look in the same PR — see the plan, never hand-edit around it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { stripCssComments } from '../scripts/strip-css-comments.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = (p: string) => readFileSync(join(WEB, p), 'utf8');
const cssNoComments = (s: string) => stripCssComments(s);

type Decls = Map<string, string>;
/** name → value for every `--x: v;` inside blocks whose selector is exactly `sel`. */
function declsOf(css: string, sel: string): Decls {
  const out: Decls = new Map();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    const s = (m[1] ?? '').split(';').pop()!.trim().replace(/\s+/g, ' ');
    if (s !== sel) continue;
    for (const d of (m[2] ?? '').matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) out.set(d[1]!, d[2]!.trim());
  }
  return out;
}

const THEME = cssNoComments(raw('app/theme.css'));
/** Colour roles only — theme.css also holds the font roles (`--font-ui`, step 2), pinned elsewhere. */
const onlyRoles = (m: Decls): Decls => new Map([...m].filter(([k]) => k.startsWith('role-')));
const LIGHT = onlyRoles(declsOf(THEME, ':root'));
const DARK = onlyRoles(declsOf(THEME, 'html.dark'));
const ALIASES = declsOf(THEME, 'html:root, html.dark:root');

/** globals.css's own theme blocks live inside `@layer base { … }`; flatten one level. */
const GLOBALS = cssNoComments(raw('app/globals.css')).replace(/@layer\s+base\s*\{/g, '');
const G_LIGHT = declsOf(GLOBALS, ':root');
const G_DARK = declsOf(GLOBALS, 'html.dark');

const hexToTriple = (v: string) => {
  const h = v.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
};
/** A globals.css value as an `R G B` triple — through `var()` aliases and `#hex`. */
function resolve(map: Decls, name: string, fallback?: Decls): string {
  const v = map.get(name) ?? fallback?.get(name);
  assert.ok(v, `globals.css declares no --${name}`);
  const alias = v.match(/^var\(--([a-z0-9-]+)\)$/);
  if (alias) return resolve(map, alias[1]!, fallback);
  if (/^#[0-9a-f]{6}$/i.test(v)) return hexToTriple(v);
  return v.replace(/\s+/g, ' ');
}

/** Each role, and the globals.css token it was measured from (null = no token held it). */
const MEASURED_FROM: Record<string, string | null> = {
  page: 'color-cream',
  surface: 'color-raised',
  'surface-2': 'surface-soft',
  ink: 'color-ink',
  muted: 'ink-soft',
  line: null,
  primary: 'color-mulberry',
  'on-primary': 'sn-on-accent',
  link: 'color-link',
  selected: 'color-terracotta',
  'selected-soft': 'accent-soft',
  badge: 'ramp-terracotta-100',
  'badge-ink': 'color-terracotta-700',
  success: 'color-ok',
  'success-wash': 'ramp-success-100',
  warning: 'color-warn',
  'warning-wash': 'ramp-warn-100',
  danger: 'color-danger',
  'danger-wash': 'ramp-danger-100',
  info: 'color-info',
  'info-wash': 'ramp-info-100',
  focus: 'color-mulberry',
  masthead: 'color-mulberry',
  'masthead-ink': 'sn-on-accent',
};

test('the readers find what they are meant to find', () => {
  assert.ok(LIGHT.size >= 24, `only ${LIGHT.size} light roles read from theme.css`);
  assert.equal(G_LIGHT.get('color-cream'), '255 255 255', 'globals.css :root --color-cream not read');
  assert.equal(G_DARK.get('color-cream'), '23 22 15', 'globals.css html.dark --color-cream not read');
  assert.ok(ALIASES.size >= 12, `only ${ALIASES.size} legacy aliases read from theme.css`);
});

test('every role has a Light and a Dark value, as an R G B triple', () => {
  const roles = Object.keys(MEASURED_FROM);
  assert.deepEqual([...LIGHT.keys()].map((k) => k.replace(/^role-/, '')).sort(), [...roles].sort());
  for (const r of roles) {
    for (const [mode, map] of [['Light', LIGHT], ['Dark', DARK]] as const) {
      const v = map.get(`role-${r}`);
      assert.ok(v && /^\d{1,3} \d{1,3} \d{1,3}$/.test(v), `--role-${r} has no ${mode} triple (got ${v})`);
    }
  }
});

test('every role IS today\'s colour, in both themes (no pixel moves)', () => {
  const off: string[] = [];
  for (const [role, from] of Object.entries(MEASURED_FROM)) {
    if (!from) continue;
    const light = resolve(G_LIGHT, from);
    const dark = resolve(G_DARK, from, G_LIGHT);
    if (LIGHT.get(`role-${role}`) !== light) off.push(`--role-${role} light ${LIGHT.get(`role-${role}`)} ≠ --${from} ${light}`);
    if (DARK.get(`role-${role}`) !== dark) off.push(`--role-${role} dark ${DARK.get(`role-${role}`)} ≠ --${from} ${dark}`);
  }
  assert.deepEqual(off, [], `\n${off.join('\n')}\n`);
});

test('the line role is today\'s hairline — ink at 10 % over the page', () => {
  const mix = (ink: string, page: string) => {
    const a = ink.split(' ').map(Number);
    const b = page.split(' ').map(Number);
    return a.map((c, i) => Math.round(b[i]! + (c - b[i]!) * 0.1)).join(' ');
  };
  assert.equal(LIGHT.get('role-line'), mix(LIGHT.get('role-ink')!, LIGHT.get('role-page')!));
  assert.equal(DARK.get('role-line'), mix(DARK.get('role-ink')!, DARK.get('role-page')!));
});

test('the legacy colour words follow the roles, out-specifying globals.css in both themes', () => {
  const expected: Record<string, string> = {
    'color-cream': 'var(--role-page)',
    'color-raised': 'var(--role-surface)',
    'color-ink': 'var(--role-ink)',
    'ink-soft': 'var(--role-muted)',
    'color-mulberry': 'var(--role-primary)',
    'sn-on-accent': 'var(--role-on-primary)',
    'color-link': 'var(--role-link)',
    'color-terracotta': 'var(--role-selected)',
    'color-ok': 'var(--role-success)',
    'color-warn': 'var(--role-warning)',
    'color-danger': 'var(--role-danger)',
    'color-info': 'var(--role-info)',
    surface: 'rgb(var(--role-surface))',
    'surface-soft': 'rgb(var(--role-surface-2))',
    'accent-soft': 'rgb(var(--role-selected-soft))',
  };
  assert.deepEqual(Object.fromEntries(ALIASES), expected);
  // Each alias target's value equals what globals.css held for that name (so the alias moves nothing).
  for (const [name, target] of Object.entries(expected)) {
    const role = target.match(/--(role-[a-z0-9-]+)/)![1]!;
    assert.equal(LIGHT.get(role), resolve(G_LIGHT, name), `--${name} light ≠ --${role}`);
    assert.equal(DARK.get(role), resolve(G_DARK, name, G_LIGHT), `--${name} dark ≠ --${role}`);
  }
});

test('every role is a Tailwind colour, and every Tailwind --role-* read exists', () => {
  const tw = stripComments(raw('tailwind.config.ts'));
  const reads = new Set([...tw.matchAll(/var\(--(role-[a-z0-9-]+)\)/g)].map((m) => m[1]!));
  for (const r of reads) assert.ok(LIGHT.has(r), `tailwind.config.ts reads --${r}, which theme.css does not declare`);
  // ink, link and surface are roles reached through their legacy keys (aliased in theme.css).
  const viaLegacy = new Set(['role-ink', 'role-link', 'role-surface']);
  for (const r of LIGHT.keys()) if (!viaLegacy.has(r)) assert.ok(reads.has(r), `--${r} has no Tailwind utility`);
});

test('root layout loads theme.css right after globals.css', () => {
  const layout = raw('app/layout.tsx');
  const g = layout.indexOf("import './globals.css';");
  const t = layout.indexOf("import './theme.css';");
  assert.ok(g >= 0 && t > g, 'app/layout.tsx must import ./theme.css after ./globals.css');
  assert.equal(layout.slice(g, t).split('\n').filter((l) => /^import /.test(l)).length, 1, 'nothing between the two imports');
});
