/**
 * 🔤 AVATAR INITIALS READ — in both themes (owner yes, 2026-10-23).
 *
 * The shell's initials chips (`.fd-avatar` in the top bar, `.fd-ava` on Discover / search / feed cards) drew
 * gold-700 #8C6932 on the gold wash #F3ECDF — 4.27:1, under AA, and recorded as a KNOWN failure in the light
 * contrast baseline since the shell shipped. The /dev labs that every dark-mode render was taken from drew a
 * stand-in chip in white on gold-500 #A9834B — 3.48:1 — so the audit's "AM / IC fail in both themes" was the
 * labs' picture of a chip, not the chip. One house pair now covers every initials chip on gold:
 * `--sn-initials-bg` (gold-100, the wash) under `--sn-initials-ink` (gold-800, the house's own "text on the
 * gold wash"); `.sn-initials` carries it outside the shell.
 *
 * What this pins, read from the real stylesheets (no hand-typed hexes):
 *   1. the pair, and the ink on the shell's own wash, reach 4.5:1 in LIGHT and in DARK;
 *   2. `.fd-avatar` and `.fd-ava` read `--sn-initials-ink`, and `.sn-initials` reads both halves;
 *   3. no round, centred chip anywhere under app/ or components/ puts white/cream on the gold-500 fill again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const GLOBALS = css('app/globals.css');
const FRONT = css('app/_components/frontdoor/front-door.css');

/** Every `--name: value;` in the bodies of rules whose selector is exactly `sel` (last one wins). */
function vars(src: string, sel: RegExp): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!sel.test(m[1]!.trim())) continue;
    for (const d of m[2]!.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out.set(d[1]!, d[2]!.trim());
  }
  return out;
}
const ROOT = /^:root$/;
const DARK = /^html\.dark$/;
function resolve(name: string, theme: 'light' | 'dark'): string {
  const light = new Map([...vars(GLOBALS, ROOT), ...vars(FRONT, /^\.fd$/)]);
  const dark = new Map([...light, ...vars(GLOBALS, DARK), ...vars(FRONT, /^html\.dark \.fd$/)]);
  const table = theme === 'light' ? light : dark;
  let v = table.get(name);
  for (let i = 0; v && i < 8; i++) {
    const alias = v.match(/^var\(--([\w-]+)(?:,[^)]*)?\)$/);
    if (!alias) break;
    v = table.get(alias[1]!);
  }
  assert.ok(v && /^#[0-9a-f]{6}$/i.test(v), `--${name} did not resolve to a hex in ${theme} (got ${v})`);
  return v!;
}
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

test('1. the initials pair — and the ink on the shell’s wash — reach AA in light and dark', () => {
  for (const theme of ['light', 'dark'] as const) {
    const ink = resolve('sn-initials-ink', theme);
    for (const fill of ['sn-initials-bg', 'fd-wash']) {
      const r = ratio(ink, resolve(fill, theme));
      assert.ok(r >= 4.5, `${theme}: initials ${ink} on --${fill} ${resolve(fill, theme)} = ${r.toFixed(2)}:1, under 4.5`);
    }
  }
});

test('2. every initials class reads the pair', () => {
  const rule = (src: string, sel: string) => {
    const m = src.match(new RegExp(`(?:^|\\})\\s*${sel.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
    assert.ok(m, `${sel} is gone`);
    return m![1]!;
  };
  for (const sel of ['.fd-avatar', '.fd-ava']) {
    assert.match(rule(FRONT, sel), /(^|;)\s*color:\s*var\(--sn-initials-ink\)/, `${sel} must read --sn-initials-ink`);
  }
  const shared = rule(GLOBALS, '.sn-initials');
  assert.match(shared, /background:\s*var\(--sn-initials-bg\)/);
  assert.match(shared, /color:\s*var\(--sn-initials-ink\)/);
});

test('3. no round, centred chip puts white or cream on the gold-500 fill (3.48:1)', () => {
  const GOLD_FILL = /(?:^|\s)bg-(?:\[#a9834b\]|gold|gold-500)(?=\s|$)/i;
  const LIGHT_INK = /(?:^|\s)text-(?:white|cream|\[#fff(?:fff)?\]|\[#fffdf8\])(?=\s|$)/i;
  const CHIP = /(?:^|\s)rounded-full(?=\s|$)/;
  const CENTRED = /(?:^|\s)(?:place-items-center|justify-center)(?=\s|$)/;
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) {
        const src = readFileSync(full, 'utf8');
        for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
          const cls = m[1] ?? m[2] ?? '';
          if (CHIP.test(cls) && CENTRED.test(cls) && GOLD_FILL.test(cls) && LIGHT_INK.test(cls)) hits.push(`${relative(WEB, full)}: ${cls.slice(0, 90)}`);
        }
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'components'));
  assert.deepEqual(hits, [], 'white/cream initials on gold-500 — use `.sn-initials` (globals.css)');
});
