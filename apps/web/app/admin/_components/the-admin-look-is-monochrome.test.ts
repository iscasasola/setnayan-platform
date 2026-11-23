/**
 * the-admin-look-is-monochrome.test.ts — ⚫ THE ADMIN DASHBOARD IS BLACK, WHITE AND GREY; ITS BUTTONS KEEP THEIR COLOUR.
 *
 * Owner, 19 Nov 2026, verbatim: "then admin dashboard is the black and white color but buttons will stay colord. just
 * the background. same effects. just monochromatic". Colour by role: events = light terracotta · supplier = light
 * blue · admin = monochrome.
 *
 *   1. The admin shell's template wears `data-admin-look` and loads `admin-look.css`.
 *   2. TOKENS ONLY: every declaration in the file is a custom property — no component rule.
 *   3. MONOCHROME: every colour written in the file is a grey (r = g = b). A hue cannot get in by accident.
 *   4. BUTTONS AND ACCENTS KEEP THEIR COLOUR: the scope names none of the decision, toggle, money, private, status,
 *      category or gold tokens.
 *   5. Every text / surface pair reads at WCAG AA in both themes, computed with the scope layered over the app's
 *      tokens the way the cascade layers it.
 *   6. Dark is written but not switched on: `/admin` joins `DARK_READY` only after its screens are swept.
 *
 * SABOTAGE (each run once, each went red): `--color-page: 247 245 244` → 3 · `--color-mulberry: 80 80 80` → 4 ·
 * `--color-ink-3: 130 130 130` → 5 · a `.x { background: #eee }` rule → 2 · '/admin' added to DARK_READY → 6.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { rawTokens, substitute, toHex, type Theme, type TokenMap } from '@/lib/css-colour-tokens';
import { DARK_READY } from '@/lib/appearance';

const WEB = process.cwd();
const CSS = stripComments(readFileSync(join(WEB, 'app/admin/_components/admin-look.css'), 'utf8'));
const SCOPE: Record<Theme, string> = { light: 'html:not(.dark):has([data-admin-look])', dark: 'html.dark:has([data-admin-look])' };

function rules(): { sel: string; decls: [string, string][] }[] {
  const out: { sel: string; decls: [string, string][] }[] = [];
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls: [string, string][] = [];
    for (const d of (m[2] ?? '').split(';')) {
      const i = d.indexOf(':');
      if (i > 0) decls.push([d.slice(0, i).trim(), d.slice(i + 1).trim().replace(/\s+/g, ' ')]);
    }
    out.push({ sel: (m[1] ?? '').replace(/\s+/g, ' ').trim(), decls });
  }
  return out;
}
const RULES = rules();
const block = (sel: string): TokenMap => Object.fromEntries(RULES.find((r) => r.sel === sel)?.decls ?? []);
const table = (theme: Theme): TokenMap => ({ ...rawTokens(theme), ...block(SCOPE[theme]) });
const hex = (token: string, theme: Theme): string => {
  const t = table(theme);
  const raw = t[token];
  assert.ok(raw !== undefined, `${token} is not set on an admin page (${theme})`);
  const h = toHex(substitute(raw, t) ?? '');
  assert.ok(h, `${token} (“${raw}”) does not resolve to one opaque colour (${theme})`);
  return h;
};
const lum = (h: string) => {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

test('1 · the admin shell wears the look', () => {
  const tpl = readFileSync(join(WEB, 'app/admin/template.tsx'), 'utf8');
  assert.match(tpl, /import '\.\/_components\/admin-look\.css';/);
  assert.match(tpl, /data-admin-look=""/);
});

test('2 · tokens only — no rule sets a property that is not a custom property', () => {
  const all = RULES.flatMap((r) => r.decls.map(([p]) => `${r.sel} { ${p} }`));
  assert.ok(all.length > 60, `anti-vacuity: only ${all.length} declarations were read`);
  assert.deepEqual(all.filter((d) => !/\{ --/.test(d)), [], 'a component rule crept into the admin look');
  for (const r of RULES) assert.match(r.sel, /^html(?::not\(\.dark\)|\.dark):has\(\[data-admin-look\]\)(?: \.fd)?$/, `“${r.sel}” is not one of the look's own scopes`);
});

test('3 · monochrome — every colour written here is a grey', () => {
  const hued: string[] = [];
  let seen = 0;
  for (const r of RULES) {
    for (const [prop, value] of r.decls) {
      const colours: [number, number, number][] = [];
      for (const m of value.matchAll(/#([0-9a-f]{6})\b/gi)) colours.push([0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16)) as [number, number, number]);
      for (const m of value.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/g)) colours.push([Number(m[1]), Number(m[2]), Number(m[3])]);
      const triple = /^(\d{1,3}) (\d{1,3}) (\d{1,3})$/.exec(value);
      if (triple) colours.push([Number(triple[1]), Number(triple[2]), Number(triple[3])]);
      for (const [red, green, blue] of colours) {
        seen += 1;
        if (red !== green || green !== blue) hued.push(`${r.sel} { ${prop}: ${value} }`);
      }
    }
  }
  assert.ok(seen > 50, `anti-vacuity: only ${seen} colours were read`);
  assert.deepEqual(hued, [], 'a hue was written into the monochrome look');
});

test('4 · buttons and accents keep their colour — the look names none of them', () => {
  const KEPT = /^--(?:color-(?:mulberry|on-accent|toggle|ok|warn|danger|info|private|cat-|terracotta|link)|sn-(?:accent|on-accent|decision|on-decision|cat-)|m-(?:mulberry|orange|nav-active)|fd-(?:gold|hi|link|wash))/;
  const named = RULES.flatMap((r) => r.decls.map(([p]) => p)).filter((p) => KEPT.test(p));
  assert.deepEqual(named, [], 'the admin look recolours a button or an accent — only the background is monochrome');
  // …and so they paint exactly what the app paints.
  for (const theme of ['light', 'dark'] as const) {
    for (const t of ['--color-mulberry', '--color-ok', '--color-terracotta', '--color-private']) {
      assert.equal(hex(t, theme), toHex(substitute(rawTokens(theme)[t]!, rawTokens(theme)) ?? ''), `${t} changed on admin (${theme})`);
    }
  }
});

test('5 · every text and surface pair reads at AA, light and dark', () => {
  const SURFACES = ['--color-page', '--color-raised', '--color-raised-2', '--color-wash'];
  let n = 0;
  for (const theme of ['light', 'dark'] as const) {
    for (const s of SURFACES) {
      for (const w of ['--color-ink', '--color-ink-2', '--color-ink-3']) {
        const r = ratio(hex(w, theme), hex(s, theme));
        n += 1;
        assert.ok(r >= 4.5, `${theme}: ${w} (${hex(w, theme)}) on ${s} (${hex(s, theme)}) reads ${r.toFixed(2)}:1`);
      }
    }
    for (const [fg, bg] of [['--color-ink', '--color-band-from'], ['--color-ink', '--color-band-to'], ['--m-slate-3', '--color-raised'], ['--m-ink', '--m-paper'], ['--m-slate-2', '--m-paper-2']] as const) {
      const r = ratio(hex(fg, theme), hex(bg, theme));
      n += 1;
      assert.ok(r >= 4.5, `${theme}: ${fg} on ${bg} reads ${r.toFixed(2)}:1`);
    }
    // the surfaces themselves are grey once every pointer is followed
    for (const s of [...SURFACES, '--m-paper', '--m-paper-2', '--m-ivory', '--sn-page-bg', '--sn-frame-bg', '--color-ink', '--m-ink']) {
      const h = hex(s, theme);
      assert.ok(h.slice(1, 3) === h.slice(3, 5) && h.slice(3, 5) === h.slice(5, 7), `${theme}: ${s} resolves to ${h}, which has a hue`);
    }
  }
  assert.ok(n >= 30, 'anti-vacuity: too few pairs');
  // the dark hero's brightest glow: white at 14 % over the band's base — the ink still reads
  const base = hex('--color-band-from', 'dark');
  const v = Math.round(255 * 0.14 + parseInt(base.slice(1, 3), 16) * 0.86).toString(16).padStart(2, '0');
  assert.ok(ratio(hex('--color-ink', 'dark'), `#${v}${v}${v}`) >= 4.5, 'the hero’s words do not read on its brightest glow');
});

test('6 · admin dark is written, not switched on — it waits for the sweep', () => {
  assert.ok(Object.keys(block(SCOPE.dark)).length >= 12, 'the dark set is gone');
  assert.ok(
    !DARK_READY.some((p) => p === '/admin' || p.startsWith('/admin/')),
    '/admin is on DARK_READY — that is right ONLY once its screens are swept for hard-coded colours; then delete this assertion',
  );
});
